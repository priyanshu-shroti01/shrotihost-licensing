/**
 * The install-facing API: activate, heartbeat, deactivate, updates.
 *
 * Route files are thin; everything with a rule in it lives here so the tests
 * exercise it against a real Postgres (PGlite) without an HTTP layer.
 */
import { q, tx, one, toBuffer, type Query, type Row } from "./db.ts";
import { randomToken, seal, sha256hex, unseal } from "./crypto.ts";
import { effectiveStatus, issueToken, type EntStatus } from "./entitlement.ts";
import { recordEvent } from "./events.ts";
import { ApiError } from "./http.ts";
import { isLocalDomain, keyHash, normalizeDir, normalizeDomain } from "./keys.ts";
import { readSignedHeaders, verifySigned, type SignedHeaders } from "./reqauth.ts";

export const DOWNLOAD_TTL_MS = 15 * 60_000;

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || "https://licensing.shrotihost.in").replace(/\/+$/, "");
}

export type ActivateInput = {
  license_key: string;
  product: string;
  domain: string;
  install_dir: string;
  software_version?: string;
  php_version?: string;
  whmcs_version?: string;
};

async function blacklisted(qq: Query, pairs: Array<[string, string]>): Promise<string | null> {
  const live = pairs.filter(([, v]) => v !== "");
  if (live.length === 0) return null;
  const rows = await qq(
    `SELECT kind FROM blacklist WHERE active AND (kind, value) IN (SELECT * FROM unnest($1::text[], $2::text[]))`,
    [live.map((p) => p[0]), live.map((p) => p[1])],
  );
  return rows[0]?.kind ?? null;
}

const NEGATIVE_MESSAGES: Record<string, string> = {
  suspended: "This licence is suspended. Contact ShrotiHost support.",
  terminated: "This licence has been terminated.",
  expired: "This licence has expired. Renew it from your ShrotiHost client area.",
};

export async function activate(input: ActivateInput, ip: string) {
  const domain = normalizeDomain(input.domain);
  const dir = normalizeDir(input.install_dir);
  if (!domain || !dir) throw new ApiError(422, "invalid_request", "domain and install_dir are required.");
  const hash = keyHash(input.license_key);

  const product = await one("SELECT * FROM products WHERE slug = $1 AND status = 'active'", [input.product]);
  // Same answer for "no such product" and "no such key": nothing to enumerate.
  const notFound = new ApiError(404, "license_not_found", "Licence key not recognised for this product.");
  if (!product) throw notFound;

  const bl = await blacklisted(q, [["license", hash], ["domain", domain], ["ip", ip]]);
  if (bl) {
    await recordEvent(q, "blacklist_hit", { severity: "warning", ip, detail: { kind: bl, domain } });
    throw new ApiError(403, "blacklisted", "This installation cannot be activated. Contact ShrotiHost support.");
  }

  // A refusal rolls the transaction back, which would take its audit line
  // with it; refusals are therefore logged after the rollback, outside it.
  let refusal: Parameters<typeof recordEvent> | null = null;
  try {
    return await activateInTx(product, hash, domain, dir, input, ip, (...e) => { refusal = e; });
  } catch (err) {
    if (refusal) await recordEvent(...(refusal as Parameters<typeof recordEvent>));
    throw err;
  }
}

async function activateInTx(
  product: Row, hash: string, domain: string, dir: string, input: ActivateInput, ip: string,
  refuse: (...e: Parameters<typeof recordEvent>) => void,
) {
  const notFound = new ApiError(404, "license_not_found", "Licence key not recognised for this product.");
  return tx(async (t) => {
    const lic = (await t("SELECT * FROM licenses WHERE key_hash = $1 AND product_id = $2 FOR UPDATE", [hash, product.id]))[0];
    if (!lic) {
      refuse(q, "activation_failed", { severity: "warning", ip, detail: { reason: "unknown_key", domain, product: product.slug } });
      throw notFound;
    }
    const status = effectiveStatus(lic);
    if (status !== "active") {
      refuse(q, "activation_refused", { licenseId: lic.id, ip, detail: { status, domain } });
      throw new ApiError(403, `license_${status}`, NEGATIVE_MESSAGES[status] ?? "This licence is not active.");
    }

    const installToken = randomToken("shl_it_");
    const installSecret = randomToken("shl_is_");
    const meta = [input.software_version ?? null, input.php_version ?? null, input.whmcs_version ?? null];

    // Re-activating the same install (same domain + directory) reuses its seat
    // and rotates its credentials; it never consumes a second one.
    const same = (await t(
      `SELECT * FROM activations WHERE license_id = $1 AND status = 'active' AND domain = $2 AND install_dir = $3 LIMIT 1`,
      [lic.id, domain, dir],
    ))[0];

    let act: Row;
    if (same) {
      act = (await t(
        `UPDATE activations SET install_token_hash = $2, install_secret_enc = $3, ip = $4, last_ip = $4,
           software_version = $5, php_version = $6, whmcs_version = $7, last_heartbeat_at = now()
         WHERE id = $1 RETURNING *`,
        [same.id, sha256hex(installToken), seal(installSecret), ip, ...meta],
      ))[0]!;
    } else {
      if (!isLocalDomain(domain) && Number(lic.max_installations) !== -1) {
        // Development installs on localhost never count against the seat limit.
        const used = (await t(
          `SELECT domain FROM activations WHERE license_id = $1 AND status = 'active'`,
          [lic.id],
        )).filter((r) => !isLocalDomain(String(r.domain))).length;
        if (used >= Number(lic.max_installations)) {
          refuse(q, "activation_limit", { severity: "warning", licenseId: lic.id, ip, detail: { domain, dir } });
          throw new ApiError(
            409,
            "activation_limit",
            "This licence is already active on another installation. Reissue it from your ShrotiHost client area to move it.",
          );
        }
      }
      act = (await t(
        `INSERT INTO activations (license_id, instance_id, domain, install_dir, ip, last_ip, software_version, php_version,
           whmcs_version, install_token_hash, install_secret_enc, last_heartbeat_at)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, now()) RETURNING *`,
        [lic.id, randomToken("shl_in_", 16), domain, dir, ip, ...meta, sha256hex(installToken), seal(installSecret)],
      ))[0]!;
    }

    const { token, claims } = await issueToken(t, lic, product, act, { domain, install_dir: dir, instance_id: act.instance_id });
    await recordEvent(t, same ? "reactivated" : "activated", { licenseId: lic.id, activationId: act.id, ip, detail: { domain, dir, version: input.software_version } });
    return {
      instance_id: act.instance_id as string,
      install_token: installToken,
      install_secret: installSecret,
      entitlement: token,
      status: claims.status,
      expires_at: claims.exp,
      grace_until: claims.grace_until,
      server_time: Math.floor(Date.now() / 1000),
    };
  });
}

export type InstallContext = { act: Row; lic: Row; product: Row; skew: number };

/** Authenticate an install request: bearer token + instance header + request HMAC. */
export async function authInstall(
  bearer: string | null,
  instanceId: string | null,
  h: SignedHeaders,
  method: string,
  path: string,
  raw: string,
  ip: string,
): Promise<InstallContext> {
  if (!bearer || !instanceId) throw new ApiError(401, "unauthenticated", "Install credentials are missing.");
  const act = await one("SELECT * FROM activations WHERE install_token_hash = $1", [sha256hex(bearer)]);
  if (!act || act.instance_id !== instanceId) {
    await recordEvent(q, "auth_failure", { severity: "warning", ip, detail: { instance: instanceId.slice(0, 40) } });
    throw new ApiError(401, "unknown_install", "Install credentials were not recognised.");
  }
  let secret: string;
  try {
    secret = unseal(String(act.install_secret_enc));
  } catch {
    throw new ApiError(503, "unavailable", "The licensing service is temporarily unavailable.", true, 60);
  }
  let skew: number;
  try {
    skew = await verifySigned(q, `inst:${act.id}`, secret, h, method, path, raw);
  } catch (e) {
    if (e instanceof ApiError) {
      await recordEvent(q, e.code === "replayed_request" ? "replay_rejected" : "signature_failure", {
        severity: "warning", activationId: act.id, licenseId: act.license_id, ip, detail: { code: e.code },
      });
    }
    throw e;
  }
  const lic = await one("SELECT * FROM licenses WHERE id = $1", [act.license_id]);
  const product = lic ? await one("SELECT * FROM products WHERE id = $1", [lic.product_id]) : null;
  if (!lic || !product) throw new ApiError(401, "unknown_install", "Install credentials were not recognised.");
  return { act, lic, product, skew };
}

export { readSignedHeaders };

export async function heartbeat(ctx: InstallContext, body: Record<string, unknown>, ip: string) {
  const { act, lic, product } = ctx;
  const own = { domain: String(act.domain), install_dir: String(act.install_dir), instance_id: String(act.instance_id) };
  let status: EntStatus = effectiveStatus(lic);
  let reason: string | undefined;
  let bind = own;

  if (act.status !== "active") {
    status = "reissue_required";
    reason = act.status === "revoked" ? "This licence was reissued. Activate it again on this installation." : "This installation was deactivated.";
  } else if (await blacklisted(q, [["license", String(lic.key_hash)], ["domain", own.domain], ["ip", ip]])) {
    status = "suspended";
    reason = "blacklisted";
    await recordEvent(q, "blacklist_hit", { severity: "warning", licenseId: lic.id, activationId: act.id, ip });
  } else {
    const domain = typeof body.domain === "string" && body.domain ? normalizeDomain(body.domain) : own.domain;
    const dir = typeof body.install_dir === "string" && body.install_dir ? normalizeDir(body.install_dir) : own.install_dir;
    const moved = (product.lock_domain && domain !== own.domain) || (product.lock_dir && dir !== own.install_dir);
    if (moved) {
      // A copy of this install somewhere else (a cloned database, a staging
      // site). It gets a signed "re-activate" bound to where it actually is;
      // the original install's activation is left alone.
      status = "reissue_required";
      reason = "This installation has moved. Activate the licence again here.";
      bind = { domain, install_dir: dir, instance_id: own.instance_id };
      await recordEvent(q, "binding_mismatch", {
        severity: "warning", licenseId: lic.id, activationId: act.id, ip,
        detail: { bound: [own.domain, own.install_dir], seen: [domain, dir] },
      });
    }
  }

  if (status === "active" || bind === own) {
    await q(
      `UPDATE activations SET last_heartbeat_at = now(), last_ip = $2, last_clock_skew_seconds = $3,
         software_version = COALESCE($4, software_version), php_version = COALESCE($5, php_version),
         whmcs_version = COALESCE($6, whmcs_version)
       WHERE id = $1`,
      [act.id, ip, ctx.skew, strOrNull(body.software_version), strOrNull(body.php_version), strOrNull(body.whmcs_version)],
    );
  }
  if (Math.abs(ctx.skew) > 120) {
    await recordEvent(q, "clock_skew", { severity: "info", licenseId: lic.id, activationId: act.id, ip, detail: { skew: ctx.skew } });
  }
  const { token, claims } = await issueToken(q, lic, product, act, bind, { status, reason });
  return { entitlement: token, status: claims.status, expires_at: claims.exp, grace_until: claims.grace_until, server_time: Math.floor(Date.now() / 1000) };
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 64) : null;
}

export async function deactivate(ctx: InstallContext, ip: string) {
  if (ctx.act.status === "active") {
    await q("UPDATE activations SET status = 'released', ended_at = now() WHERE id = $1", [ctx.act.id]);
    await recordEvent(q, "deactivated", { licenseId: ctx.lic.id, activationId: ctx.act.id, ip });
  }
  return { ok: true };
}

/* ─────────────────────────────── updates ─────────────────────────────── */

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[^0-9]+/).filter(Boolean).map(Number);
  const pb = b.split(/[^0-9]+/).filter(Boolean).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

const RELEASE_COLS = `id, product_id, version, channel, changelog, is_security, min_php, min_whmcs, filename,
  package_size, package_sha256, manifest_jws, published, created_at`;

export async function latestRelease(productId: number, channel = "stable"): Promise<Row | null> {
  const channels = channel === "beta" ? ["stable", "beta"] : ["stable"];
  const rows = await q(
    `SELECT ${RELEASE_COLS} FROM releases WHERE product_id = $1 AND published AND channel = ANY($2::text[])`,
    [productId, channels],
  );
  rows.sort((a, b) => compareVersions(String(b.version), String(a.version)));
  return rows[0] ?? null;
}

export function releaseView(r: Row) {
  return {
    version: r.version,
    channel: r.channel,
    changelog: r.changelog,
    is_security: r.is_security,
    min_php: r.min_php,
    min_whmcs: r.min_whmcs,
    filename: r.filename,
    package_size: r.package_size,
    package_sha256: r.package_sha256,
    released_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

export async function updatesCheck(ctx: InstallContext, body: Record<string, unknown>) {
  const current = typeof body.current_version === "string" ? body.current_version : "0";
  const channel = body.channel === "beta" ? "beta" : "stable";
  const rel = await latestRelease(ctx.product.id, channel);
  if (!rel || compareVersions(String(rel.version), current) <= 0) {
    return { available: false, current_version: current };
  }
  const active = effectiveStatus(ctx.lic) === "active" && ctx.act.status === "active";
  const updatesValid = !ctx.lic.updates_expires_at || new Date(ctx.lic.updates_expires_at).getTime() > Date.now();
  // Security releases go to every install, lapsed update entitlement or not.
  const eligible = active && (updatesValid || Boolean(rel.is_security));
  return { available: true, eligible, current_version: current, release: releaseView(rel), manifest: rel.manifest_jws };
}

/** Mint a one-time, 15-minute download URL for a release. */
export async function issueDownload(lic: Row, product: Row, activationId: number | null, version: string | null, opts: { admin?: boolean } = {}) {
  const rel = version
    ? await one(`SELECT ${RELEASE_COLS} FROM releases WHERE product_id = $1 AND version = $2 AND published ORDER BY channel = 'stable' DESC LIMIT 1`, [product.id, version])
    : await latestRelease(product.id);
  if (!rel) throw new ApiError(404, "no_release", "No release is available for this product.");
  if (!opts.admin) {
    const status = effectiveStatus(lic);
    const updatesValid = !lic.updates_expires_at || new Date(lic.updates_expires_at).getTime() > Date.now();
    if (status !== "active") throw new ApiError(403, `license_${status}`, NEGATIVE_MESSAGES[status] ?? "This licence is not active.");
    if (!updatesValid && !rel.is_security) throw new ApiError(403, "updates_expired", "Update entitlement has expired. Renew to download new versions.");
  }
  const token = randomToken("shl_dl_", 24);
  const expires = new Date(Date.now() + DOWNLOAD_TTL_MS);
  await q(
    `INSERT INTO download_tokens (token_hash, release_id, license_id, activation_id, expires_at) VALUES ($1, $2, $3, $4, $5::timestamptz)`,
    [sha256hex(token), rel.id, lic.id, activationId, expires.toISOString()],
  );
  return {
    url: `${publicBaseUrl()}/api/updates/download/${token}`,
    expires_at: expires.toISOString(),
    release: releaseView(rel),
    manifest: rel.manifest_jws,
  };
}

/** Redeem a download token exactly once. */
export async function consumeDownload(token: string, ip: string): Promise<{ filename: string; body: Buffer; sha256: string } | null> {
  if (!/^shl_dl_[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const used = await one(
    `UPDATE download_tokens SET used_at = now(), used_ip = $2
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING release_id, license_id, activation_id`,
    [sha256hex(token), ip],
  );
  if (!used) return null;
  const rel = await one("SELECT filename, package, package_sha256, version FROM releases WHERE id = $1", [used.release_id]);
  if (!rel) return null;
  await recordEvent(q, "downloaded", { licenseId: used.license_id, activationId: used.activation_id, ip, detail: { version: rel.version } });
  return { filename: String(rel.filename), body: toBuffer(rel.package), sha256: String(rel.package_sha256) };
}
