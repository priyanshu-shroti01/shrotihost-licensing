/**
 * The admin API, called by the WHMCS licensing module on portal.shrotihost.in.
 * WHMCS is the management surface; this is the system of record behind it.
 */
import { q, one, tx, type Row } from "./db.ts";
import { sha256hex } from "./crypto.ts";
import { effectiveStatus } from "./entitlement.ts";
import { recordEvent } from "./events.ts";
import { ApiError, bool, date, int, str } from "./http.ts";
import { generateLicenseKey, keyHash, keyHint, normalizeDomain } from "./keys.ts";
import { compareVersions, issueDownload, releaseView } from "./install.ts";
import { signJws, getSigner } from "./sign.ts";

const ACTOR = "whmcs";

function isoOrNull(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function productView(p: Row) {
  return {
    id: p.id, slug: p.slug, name: p.name, key_prefix: p.key_prefix, lock_domain: p.lock_domain, lock_dir: p.lock_dir,
    default_max_installations: p.default_max_installations, token_ttl_hours: p.token_ttl_hours, grace_hours: p.grace_hours,
    features: p.features, limits: p.limits, status: p.status,
  };
}

export function activationView(a: Row) {
  return {
    id: a.id, instance_id: a.instance_id, status: a.status, domain: a.domain, install_dir: a.install_dir, ip: a.last_ip ?? a.ip,
    software_version: a.software_version, php_version: a.php_version, whmcs_version: a.whmcs_version,
    last_heartbeat_at: isoOrNull(a.last_heartbeat_at), created_at: isoOrNull(a.created_at), ended_at: isoOrNull(a.ended_at),
  };
}

export async function licenseView(lic: Row) {
  const product = await one("SELECT slug, name FROM products WHERE id = $1", [lic.product_id]);
  const acts = await q("SELECT * FROM activations WHERE license_id = $1 ORDER BY status = 'active' DESC, id DESC LIMIT 50", [lic.id]);
  return {
    id: lic.id,
    product: product?.slug,
    product_name: product?.name,
    key_hint: lic.key_hint,
    status: lic.status,
    effective_status: effectiveStatus(lic),
    status_reason: lic.status_reason,
    plan: lic.plan,
    max_installations: lic.max_installations,
    active_installations: acts.filter((a) => a.status === "active").length,
    features: lic.features,
    limits: lic.limits,
    subscription_expires_at: isoOrNull(lic.subscription_expires_at),
    support_expires_at: isoOrNull(lic.support_expires_at),
    updates_expires_at: isoOrNull(lic.updates_expires_at),
    reissues_used: lic.reissues_used,
    whmcs_service_id: lic.whmcs_service_id,
    whmcs_client_id: lic.whmcs_client_id,
    whmcs_order_id: lic.whmcs_order_id,
    client_name: lic.client_name,
    client_email: lic.client_email,
    created_at: isoOrNull(lic.created_at),
    updated_at: isoOrNull(lic.updated_at),
    activations: acts.map(activationView),
  };
}

async function licenseOr404(id: number): Promise<Row> {
  const lic = await one("SELECT * FROM licenses WHERE id = $1", [id]);
  if (!lic) throw new ApiError(404, "license_not_found", "No such licence.");
  return lic;
}

async function productOr404(slug: string): Promise<Row> {
  const p = await one("SELECT * FROM products WHERE slug = $1", [slug]);
  if (!p) throw new ApiError(404, "product_not_found", `No product "${slug}".`);
  return p;
}

/* ─────────────────────────────── products ─────────────────────────────── */

export async function listProducts() {
  return (await q("SELECT * FROM products ORDER BY id")).map(productView);
}

export async function upsertProduct(b: Record<string, unknown>) {
  const slug = str(b, "slug", { required: true, max: 120 });
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new ApiError(422, "invalid_request", "slug must be lowercase kebab-case.");
  const name = str(b, "name", { required: true, max: 200 });
  const features = Array.isArray(b.features) ? b.features.map(String) : null;
  const limits = b.limits && typeof b.limits === "object" && !Array.isArray(b.limits) ? b.limits : null;
  const row = (await q(
    `INSERT INTO products (slug, name, key_prefix, lock_domain, lock_dir, default_max_installations, token_ttl_hours, grace_hours, features, limits)
     VALUES ($1, $2, COALESCE($3, 'SHROTI'), COALESCE($4, true), COALESCE($5, true), COALESCE($6, 1), COALESCE($7, 168), COALESCE($8, 336),
             COALESCE($9::jsonb, '[]'::jsonb), COALESCE($10::jsonb, '{}'::jsonb))
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name,
       key_prefix = COALESCE($3, products.key_prefix), lock_domain = COALESCE($4, products.lock_domain),
       lock_dir = COALESCE($5, products.lock_dir), default_max_installations = COALESCE($6, products.default_max_installations),
       token_ttl_hours = COALESCE($7, products.token_ttl_hours), grace_hours = COALESCE($8, products.grace_hours),
       features = COALESCE($9::jsonb, products.features), limits = COALESCE($10::jsonb, products.limits), updated_at = now()
     RETURNING *`,
    [slug, name, str(b, "key_prefix", { max: 20 }) || null, bool(b, "lock_domain"), bool(b, "lock_dir"), int(b, "default_max_installations"),
      int(b, "token_ttl_hours"), int(b, "grace_hours"), features ? JSON.stringify(features) : null, limits ? JSON.stringify(limits) : null],
  ))[0]!;
  await recordEvent(q, "product_saved", { actor: ACTOR, detail: { slug } });
  return productView(row);
}

/* ─────────────────────────────── licences ─────────────────────────────── */

/**
 * Create a licence for a WHMCS service, or adopt an existing key
 * (`license_key` given) — the migration path for keys WHMCS already issued.
 *
 * Idempotent per WHMCS service: a retried CreateAccount gets the licence that
 * already exists (with `license_key: null`, since the key is only ever shown
 * once) instead of a second licence.
 */
export async function createLicense(b: Record<string, unknown>) {
  const product = await productOr404(str(b, "product_slug", { required: true, max: 120 }));
  const serviceId = int(b, "whmcs_service_id");
  const adopt = str(b, "license_key", { max: 120 });

  // Reads inside the transaction go through `t` only; licenseView runs after
  // commit, on the shared connection, so it sees what was just written.
  const r = await tx(async (t) => {
    if (serviceId !== null) {
      const existing = (await t("SELECT * FROM licenses WHERE whmcs_service_id = $1", [serviceId]))[0];
      if (existing) {
        if (adopt && existing.key_hash !== keyHash(adopt)) {
          throw new ApiError(409, "service_has_license", `WHMCS service ${serviceId} already has a different licence (#${existing.id}).`);
        }
        return { created: false, license_key: null as string | null, lic: existing };
      }
    }
    const key = adopt || generateLicenseKey(str(b, "key_prefix", { max: 20 }) || String(product.key_prefix));
    const hash = keyHash(key);
    const clash = (await t("SELECT id, whmcs_service_id FROM licenses WHERE key_hash = $1", [hash]))[0];
    if (clash) throw new ApiError(409, "key_exists", `That key already belongs to licence #${clash.id}.`);

    const maxInst = int(b, "max_installations") ?? Number(product.default_max_installations);
    const features = Array.isArray(b.features) ? JSON.stringify(b.features.map(String)) : null;
    const limits = b.limits && typeof b.limits === "object" && !Array.isArray(b.limits) ? JSON.stringify(b.limits) : null;
    const status = str(b, "status") || "active";
    if (!["active", "suspended", "terminated"].includes(status)) throw new ApiError(422, "invalid_request", "Invalid status.");

    const lic = (await t(
      `INSERT INTO licenses (product_id, key_hash, key_hint, status, plan, max_installations, features, limits,
         subscription_expires_at, support_expires_at, updates_expires_at, whmcs_service_id, whmcs_client_id, whmcs_order_id,
         client_name, client_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::timestamptz, $10::timestamptz, $11::timestamptz, $12, $13, $14, $15, $16)
       RETURNING *`,
      [product.id, hash, keyHint(key), status, str(b, "plan", { max: 60 }) || "standard", maxInst, features, limits,
        date(b, "subscription_expires_at") ?? null, date(b, "support_expires_at") ?? null, date(b, "updates_expires_at") ?? null,
        serviceId, int(b, "whmcs_client_id"), int(b, "whmcs_order_id"), str(b, "client_name", { max: 200 }) || null,
        str(b, "client_email", { max: 200 }) || null],
    ))[0]!;
    await recordEvent(t, adopt ? "license_adopted" : "license_created", { actor: ACTOR, licenseId: lic.id, detail: { service: serviceId, product: product.slug } });
    // The plaintext key leaves this server exactly once, here, for a new key.
    return { created: true, license_key: adopt ? null : key, lic };
  });
  return { created: r.created, license_key: r.license_key, license: await licenseView(r.lic) };
}

export async function getLicense(id: number) {
  return licenseView(await licenseOr404(id));
}

export async function lookupLicense(b: Record<string, unknown>) {
  const key = str(b, "license_key", { max: 120 });
  const serviceId = int(b, "whmcs_service_id");
  let lic: Row | null = null;
  if (key) lic = await one("SELECT * FROM licenses WHERE key_hash = $1", [keyHash(key)]);
  else if (serviceId !== null) lic = await one("SELECT * FROM licenses WHERE whmcs_service_id = $1", [serviceId]);
  else throw new ApiError(422, "invalid_request", "Give license_key or whmcs_service_id.");
  if (!lic) throw new ApiError(404, "license_not_found", "No such licence.");
  return licenseView(lic);
}

/**
 * `force` lets WHMCS bring a terminated licence back when an admin re-activates
 * the service there; without it a terminated licence stays terminated, so a
 * stray unsuspend can never resurrect one.
 */
export async function setStatus(id: number, status: "active" | "suspended" | "terminated", reason: string, force = false) {
  const lic = await licenseOr404(id);
  if (lic.status === "terminated" && status !== "terminated" && !force) {
    throw new ApiError(409, "license_terminated", "A terminated licence cannot be reactivated without force.");
  }
  const row = (await q(
    "UPDATE licenses SET status = $2, status_reason = $3, updated_at = now() WHERE id = $1 RETURNING *",
    [id, status, reason || null],
  ))[0]!;
  const kind = status === "active" ? "license_unsuspended" : status === "suspended" ? "license_suspended" : "license_terminated";
  await recordEvent(q, kind, { actor: ACTOR, licenseId: id, detail: { reason } });
  return licenseView(row);
}

/** Change entitlements: renewal dates, seats, plan, features, WHMCS linkage. */
export async function updateLicense(id: number, b: Record<string, unknown>) {
  await licenseOr404(id);
  const sets: string[] = [];
  const params: unknown[] = [id];
  const put = (col: string, v: unknown, cast = "") => {
    params.push(v);
    sets.push(`${col} = $${params.length}${cast}`);
  };
  for (const col of ["subscription_expires_at", "support_expires_at", "updates_expires_at"]) {
    const d = date(b, col);
    if (d !== undefined) put(col, d, "::timestamptz");
  }
  const maxInst = int(b, "max_installations");
  if (maxInst !== null) {
    if (maxInst < -1 || maxInst === 0) throw new ApiError(422, "invalid_request", "max_installations must be -1 or at least 1.");
    put("max_installations", maxInst);
  }
  if ("plan" in b) put("plan", str(b, "plan", { max: 60 }) || "standard");
  if ("features" in b) put("features", Array.isArray(b.features) ? JSON.stringify(b.features.map(String)) : null, "::jsonb");
  if ("limits" in b) put("limits", b.limits && typeof b.limits === "object" ? JSON.stringify(b.limits) : null, "::jsonb");
  for (const col of ["whmcs_service_id", "whmcs_client_id", "whmcs_order_id"]) {
    if (col in b) put(col, int(b, col));
  }
  for (const col of ["client_name", "client_email"]) {
    if (col in b) put(col, str(b, col, { max: 200 }) || null);
  }
  if (sets.length === 0) throw new ApiError(422, "invalid_request", "Nothing to update.");
  const row = (await q(`UPDATE licenses SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`, params))[0]!;
  await recordEvent(q, "license_updated", { actor: ACTOR, licenseId: id, detail: { fields: Object.keys(b) } });
  return licenseView(row);
}

/**
 * Release every seat so the key can be activated somewhere new. Revoked
 * installs learn this through a signed `reissue_required` on their next
 * heartbeat. `count` is false for admin-initiated reissues.
 */
export async function reissueLicense(id: number, count: boolean) {
  await licenseOr404(id);
  const n = (await q(
    "UPDATE activations SET status = 'revoked', ended_at = now() WHERE license_id = $1 AND status = 'active' RETURNING id",
    [id],
  )).length;
  const row = (await q(
    `UPDATE licenses SET reissues_used = reissues_used + $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, count ? 1 : 0],
  ))[0]!;
  await recordEvent(q, "license_reissued", { actor: ACTOR, licenseId: id, detail: { released: n, counted: count } });
  return { released: n, license: await licenseView(row) };
}

export async function regenerateKey(id: number) {
  const lic = await licenseOr404(id);
  const product = await one("SELECT key_prefix FROM products WHERE id = $1", [lic.product_id]);
  const prefix = String(lic.key_hint).split("-…-")[0] || String(product?.key_prefix ?? "SHROTI");
  const key = generateLicenseKey(prefix);
  await q("UPDATE activations SET status = 'revoked', ended_at = now() WHERE license_id = $1 AND status = 'active'", [id]);
  const row = (await q(
    "UPDATE licenses SET key_hash = $2, key_hint = $3, updated_at = now() WHERE id = $1 RETURNING *",
    [id, keyHash(key), keyHint(key)],
  ))[0]!;
  await recordEvent(q, "license_key_regenerated", { actor: ACTOR, licenseId: id, severity: "warning" });
  return { license_key: key, license: await licenseView(row) };
}

export async function revokeActivation(id: number, activationId: number) {
  const n = (await q(
    "UPDATE activations SET status = 'revoked', ended_at = now() WHERE id = $1 AND license_id = $2 AND status = 'active' RETURNING id",
    [activationId, id],
  )).length;
  if (n === 0) throw new ApiError(404, "activation_not_found", "No active installation with that id on this licence.");
  await recordEvent(q, "activation_revoked", { actor: ACTOR, licenseId: id, activationId });
  return getLicense(id);
}

export async function downloadForLicense(id: number, version: string | null) {
  const lic = await licenseOr404(id);
  const product = await one("SELECT * FROM products WHERE id = $1", [lic.product_id]);
  return issueDownload(lic, product!, null, version);
}

/* ─────────────────────────────── releases ─────────────────────────────── */

export const MAX_PACKAGE_BYTES = 3 * 1024 * 1024;

export async function createRelease(b: Record<string, unknown>) {
  const product = await productOr404(str(b, "product_slug", { required: true, max: 120 }));
  const version = str(b, "version", { required: true, max: 40 });
  if (!/^\d+(\.\d+){0,3}([-+][0-9A-Za-z.-]+)?$/.test(version)) throw new ApiError(422, "invalid_request", "version must look like 2.1 or 2.1.0.");
  const channel = str(b, "channel") || "stable";
  if (!["stable", "beta"].includes(channel)) throw new ApiError(422, "invalid_request", "channel must be stable or beta.");
  const b64 = typeof b.package_b64 === "string" ? b.package_b64 : "";
  const pkg = Buffer.from(b64, "base64");
  if (pkg.length < 22 || pkg.length > MAX_PACKAGE_BYTES) throw new ApiError(422, "invalid_request", "package_b64 must be a zip under 3 MB.");
  if (pkg.readUInt32LE(0) !== 0x04034b50) throw new ApiError(422, "invalid_request", "package is not a zip file.");
  const filename = (str(b, "filename", { max: 120 }) || `${product.slug}-${version}.zip`).replace(/[^A-Za-z0-9._-]/g, "_");
  const sha = sha256hex(pkg);
  const isSecurity = bool(b, "is_security") ?? false;
  const minPhp = str(b, "min_php", { max: 20 }) || null;
  const minWhmcs = str(b, "min_whmcs", { max: 20 }) || null;
  const releasedAt = new Date().toISOString();
  const manifest = signJws({
    iss: "licensing.shrotihost.in",
    product: product.slug,
    version,
    channel,
    released_at: releasedAt,
    is_security: isSecurity,
    min_php: minPhp,
    min_whmcs: minWhmcs,
    filename,
    package_sha256: sha,
    package_size: pkg.length,
    kid: getSigner().kid,
  }, "shl-manifest+jwt");
  const row = (await q(
    `INSERT INTO releases (product_id, version, channel, changelog, is_security, min_php, min_whmcs, filename, package, package_size, package_sha256, manifest_jws)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (product_id, version, channel) DO NOTHING
     RETURNING id, product_id, version, channel, changelog, is_security, min_php, min_whmcs, filename, package_size, package_sha256, manifest_jws, published, created_at`,
    [product.id, version, channel, str(b, "changelog", { max: 20000 }), isSecurity, minPhp, minWhmcs, filename, pkg, pkg.length, sha, manifest],
  ))[0];
  // Releases are immutable: re-uploading a version would change what a
  // signed manifest already promised.
  if (!row) throw new ApiError(409, "release_exists", `${product.slug} ${version} (${channel}) already exists. Publish a new version.`);
  await recordEvent(q, "release_created", { actor: ACTOR, detail: { product: product.slug, version, channel, sha256: sha } });
  return releaseView(row);
}

export async function listReleases(slug: string | null) {
  const rows = await q(
    `SELECT r.id, r.version, r.channel, r.changelog, r.is_security, r.min_php, r.min_whmcs, r.filename, r.package_size,
            r.package_sha256, r.published, r.created_at, p.slug AS product
     FROM releases r JOIN products p ON p.id = r.product_id
     WHERE ($1::text IS NULL OR p.slug = $1) ORDER BY r.created_at DESC LIMIT 200`,
    [slug],
  );
  return rows.map((r) => ({ id: r.id, product: r.product, published: r.published, ...releaseView(r) }));
}

export async function setReleasePublished(id: number, published: boolean) {
  const n = (await q("UPDATE releases SET published = $2 WHERE id = $1 RETURNING id", [id, published])).length;
  if (n === 0) throw new ApiError(404, "release_not_found", "No such release.");
  await recordEvent(q, published ? "release_published" : "release_unpublished", { actor: ACTOR, detail: { id } });
  return { ok: true };
}

/* ─────────────────────────── blacklist, events, stats ─────────────────────────── */

export async function addBlacklist(b: Record<string, unknown>) {
  const kind = str(b, "kind", { required: true });
  if (!["license", "domain", "ip"].includes(kind)) throw new ApiError(422, "invalid_request", "kind must be license, domain or ip.");
  const raw = str(b, "value", { required: true, max: 200 });
  const value = kind === "license" ? keyHash(raw) : kind === "domain" ? normalizeDomain(raw) : raw;
  await q(
    `INSERT INTO blacklist (kind, value, reason, active) VALUES ($1, $2, $3, true)
     ON CONFLICT (kind, value) DO UPDATE SET active = true, reason = EXCLUDED.reason`,
    [kind, value, str(b, "reason", { max: 300 }) || null],
  );
  await recordEvent(q, "blacklist_added", { actor: ACTOR, severity: "warning", detail: { kind } });
  return { ok: true };
}

export async function listEvents(licenseId: number | null, limit: number) {
  const rows = await q(
    `SELECT id, kind, severity, license_id, activation_id, actor, ip, detail, created_at FROM events
     WHERE ($1::int IS NULL OR license_id = $1) ORDER BY id DESC LIMIT $2`,
    [licenseId, Math.min(Math.max(limit, 1), 500)],
  );
  return rows.map((r) => ({ ...r, created_at: isoOrNull(r.created_at) }));
}

export async function stats() {
  const byStatus = await q(
    `SELECT p.slug, l.status, count(*)::int AS n FROM licenses l JOIN products p ON p.id = l.product_id GROUP BY 1, 2 ORDER BY 1, 2`,
  );
  const acts = (await q(
    `SELECT count(*) FILTER (WHERE status = 'active')::int AS active,
            count(*) FILTER (WHERE status = 'active' AND (last_heartbeat_at IS NULL OR last_heartbeat_at < now() - interval '3 days'))::int AS stale
     FROM activations`,
  ))[0]!;
  const security = (await q(
    `SELECT count(*)::int AS n FROM events WHERE severity <> 'info' AND created_at > now() - interval '7 days'`,
  ))[0]!;
  const latest = await q(
    `SELECT DISTINCT ON (p.slug) p.slug, r.version, r.created_at FROM releases r JOIN products p ON p.id = r.product_id
     WHERE r.published AND r.channel = 'stable' ORDER BY p.slug, r.created_at DESC`,
  );
  latest.sort((a, b) => String(a.slug).localeCompare(String(b.slug)) || compareVersions(String(b.version), String(a.version)));
  return {
    licenses: byStatus,
    activations: acts,
    security_events_7d: security.n,
    latest_releases: latest.map((r) => ({ product: r.slug, version: r.version, released_at: isoOrNull(r.created_at) })),
    signing_kid: getSigner().kid,
  };
}

export async function prune() {
  const nonces = (await q("DELETE FROM request_nonces WHERE seen_at < now() - interval '1 day' RETURNING 1")).length;
  const downloads = (await q("DELETE FROM download_tokens WHERE expires_at < now() - interval '30 days' RETURNING 1")).length;
  const tokens = (await q("DELETE FROM entitlement_tokens WHERE grace_until < now() - interval '90 days' RETURNING 1")).length;
  const events = (await q("DELETE FROM events WHERE severity = 'info' AND created_at < now() - interval '180 days' RETURNING 1")).length;
  return { nonces, downloads, tokens, events };
}
