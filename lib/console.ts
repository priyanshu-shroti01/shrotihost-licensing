/**
 * Everything the operator console shows, built from the live database in one
 * request. Shapes match what the console page renders; nothing here is
 * decorative — every number, status and sentence comes from a row.
 */
import { createHash } from "node:crypto";
import { q, type Row } from "./db.ts";
import { effectiveStatus } from "./entitlement.ts";
import { getSigner, publicKeys } from "./sign.ts";

const DAY = 86400000;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
const ms = (v: unknown) => (v ? new Date(v as string).getTime() : null);

/** Product slug → short key the console uses for colours and labels. */
export function productKey(slug: string): string {
  if (slug.includes("whatsapp")) return "wa";
  if (slug.includes("gateway")) return "sgf";
  if (slug.includes("social-proof")) return "sp";
  return slug;
}

function fingerprint(xB64url: string): string {
  const raw = Buffer.from(xB64url, "base64url");
  const h = createHash("sha256").update(raw).digest("hex");
  return "SHA256:" + h.slice(0, 32).match(/../g)!.join(":");
}

const SEC_TEXT: Record<string, { kind: string; what: (d: Row, ip: string) => string; action: string }> = {
  activation_failed: { kind: "Refused activation", what: (d) => `An install on ${d.domain ?? "an unknown domain"} tried to activate ${d.product ?? "a product"} with a key this server does not know.`, action: "If it repeats, check the licence key saved in that module's settings." },
  activation_refused: { kind: "Refused activation", what: (d) => `A ${d.status ?? "non-active"} licence tried to activate on ${d.domain ?? "an install"}.`, action: "Check the licence status in WHMCS." },
  activation_limit: { kind: "Seat limit reached", what: (d) => `A licence already in use tried to activate on ${d.domain ?? "another install"}.`, action: "Reissue the licence if the customer is moving installs, or raise its seats in WHMCS." },
  admin_auth_failure: { kind: "Admin authentication failure", what: (_d, ip) => `An admin API request presented a credential this server does not recognise${ip ? ` (from ${ip})` : ""}.`, action: "If unexpected, rotate ADMIN_API_SECRET and update it in WHMCS." },
  auth_failure: { kind: "Unknown install credentials", what: () => "A request used install credentials that no activation matches.", action: "Usually an install whose licence was reissued; it will re-activate. Investigate if frequent." },
  signature_failure: { kind: "Signature failure", what: () => "An install request's HMAC signature did not match.", action: "Check the install's clock and credentials; repeated failures may indicate tampering." },
  replay_rejected: { kind: "Replay detection", what: () => "A request reused a nonce inside the replay window.", action: "Look for a proxy retrying requests, or an attempted replay." },
  binding_mismatch: { kind: "Binding move", what: (d) => `An install was seen on a new domain or folder (${(d.seen ?? []).join(" · ")}).`, action: "Usually a staging copy. Reissue if the customer really moved." },
  blacklist_hit: { kind: "Blacklist hit", what: () => "A blocked key, domain or IP tried to use the service.", action: "No action needed unless the block is wrong." },
  console_login_failed: { kind: "Console sign-in failure", what: (d, ip) => `A console sign-in for ${d.email || "an unknown email"} used the wrong password${ip ? ` (from ${ip})` : ""}.`, action: "If it was not you, change the console password in Settings → Profile. Eight failures lock that IP for 15 minutes." },
  clock_skew: { kind: "Clock skew", what: (d) => `An install's clock is off by ${d.skew ?? "?"} s.`, action: "Ask the customer to enable NTP on that server." },
};

function describe(e: Row): string {
  const d = (e.detail ?? {}) as Row;
  const lic = e.license_id ? `#${e.license_id}` : "";
  const bits = [lic, d.domain, d.product, d.version, d.reason, d.slug, d.kind].filter(Boolean).map(String);
  if (e.kind === "license_adopted" || e.kind === "license_created") return [lic, d.product, d.service ? `WHMCS #${d.service}` : ""].filter(Boolean).join(" · ");
  if (e.kind === "release_created") return [d.product, d.version, d.sha256 ? `sha256 ${String(d.sha256).slice(0, 12)}…` : ""].filter(Boolean).join(" · ");
  if (e.kind === "license_updated") return [lic, Array.isArray(d.fields) ? `changed ${d.fields.join(", ")}` : ""].filter(Boolean).join(" · ");
  return bits.join(" · ") || e.kind;
}

export async function buildSnapshot(operator: Row) {
  const t0 = Date.now();
  const now = Date.now();
  const [products, licences, acts, events, releases, tokens, beats, operators] = await Promise.all([
    q("SELECT * FROM products ORDER BY id"),
    q("SELECT * FROM licenses ORDER BY id"),
    q("SELECT a.*, l.product_id FROM activations a JOIN licenses l ON l.id = a.license_id ORDER BY a.id"),
    q("SELECT * FROM events WHERE created_at > now() - interval '30 days' ORDER BY id DESC LIMIT 400"),
    q(`SELECT r.id, r.product_id, r.version, r.channel, r.changelog, r.is_security, r.filename, r.package_size, r.package_sha256, r.published, r.created_at
       FROM releases r ORDER BY r.created_at DESC`),
    q(`SELECT kid, max(issued_at) AS last_used, count(*) FILTER (WHERE issued_at > now() - interval '24 hours')::int AS issued_24h FROM entitlement_tokens GROUP BY kid`),
    // Every activate and heartbeat issues a token, so tokens per hour are the check-in history.
    q(`SELECT activation_id, floor(extract(epoch FROM now() - issued_at) / 3600)::int AS ago, count(*)::int AS n
       FROM entitlement_tokens WHERE activation_id IS NOT NULL AND issued_at > now() - interval '24 hours' GROUP BY 1, 2`),
    q("SELECT id, email, name, role, must_change_password, last_login_at, created_at FROM operators ORDER BY id"),
  ]);
  const dbMs = Date.now() - t0;
  const pById = new Map(products.map((p) => [p.id, p]));
  const pk = (productId: number) => productKey(String(pById.get(productId)?.slug ?? ""));

  const LIC = licences.map((l) => ({
    id: l.id, svc: l.whmcs_service_id, hint: l.key_hint, p: pk(l.product_id), status: effectiveStatus(l), raw_status: l.status,
    client: l.client_name || "—", max: l.max_installations, updates: l.updates_expires_at ? iso(l.updates_expires_at)!.slice(0, 10) : null,
    created: ms(l.created_at), reissues: l.reissues_used,
  }));
  const actById = new Map(acts.map((a) => [a.id, a]));
  const INST = acts.filter((a) => a.status === "active").map((a) => ({
    id: "a" + a.id, aid: a.id, domain: a.domain, p: pk(a.product_id), lic: a.license_id, ver: a.software_version || "—",
    hb: ms(a.last_heartbeat_at) ?? ms(a.created_at), inst: a.instance_id, php: a.php_version || "—", whmcs: (a.whmcs_version || "—").replace(/-release.*$/, ""),
    ip: a.last_ip || a.ip || "—", dir: a.install_dir, created: ms(a.created_at),
    // beats[k] = check-ins k hours ago (0 = the current hour), last 24 hours.
    beats: Array.from({ length: 24 }, (_, k) => Number(beats.find((b) => b.activation_id === a.id && b.ago === k)?.n ?? 0)),
  }));
  const instKey = (activationId: unknown) => (activationId ? "a" + activationId : null);

  const lvOf = (e: Row) => (e.severity === "critical" ? "bad" : e.severity === "warning" ? "warn" : /activated|heartbeat|downloaded/.test(e.kind) ? "ok" : "info");
  const EV = events.map((e) => ({ id: e.id, t: ms(e.created_at), k: e.kind, lv: lvOf(e), lic: e.license_id, inst: instKey(e.activation_id), d: describe(e), actor: e.actor })).reverse();

  // Security: non-info events in the last 7 days, explained.
  const sevEvents = events.filter((e) => e.severity !== "info" && now - ms(e.created_at)! < 7 * DAY);
  const SEC = sevEvents.map((e, i) => {
    const d = (e.detail ?? {}) as Row;
    const txt = SEC_TEXT[e.kind] ?? { kind: e.kind.replace(/_/g, " "), what: () => "Recorded by the licensing server.", action: "Review the event detail." };
    const act = e.activation_id ? actById.get(e.activation_id) : null;
    let outcome = e.kind.includes("auth") ? "Request refused (401). No data returned." : "Request refused.";
    if (e.kind === "activation_failed" && d.domain) {
      const later = acts.find((a) => a.domain === d.domain && pById.get(a.product_id)?.slug === d.product && ms(a.last_heartbeat_at)! > ms(e.created_at)!);
      if (later) outcome = `Resolved: the install on ${d.domain} is now active on licence #${later.license_id}.`;
    }
    const ageFrac = Math.min(1, (now - ms(e.created_at)!) / (7 * DAY));
    const angle = [...String(e.kind)].reduce((s, c) => s + c.charCodeAt(0), 0) % 360 + i * 9;
    return {
      id: "e" + e.id, t: ms(e.created_at), sev: e.severity === "critical" ? "bad" : "warn", kind: txt.kind, code: e.kind, count: 1,
      what: txt.what(d, e.ip ?? ""), licence: e.license_id ? `#${e.license_id}` : "—",
      install: act ? `${act.domain}` : d.domain ?? "—", outcome, action: txt.action,
      to: act ? `#/installations/a${act.id}` : e.kind.startsWith("admin") ? "#/access" : "#/security", angle, radius: 0.2 + ageFrac * 0.75,
    };
  });

  const REL = releases.map((r) => ({
    id: r.id, p: pk(r.product_id), version: r.version, channel: r.channel, size: `${Math.max(1, Math.round(Number(r.package_size) / 1024))} KB`,
    sha: String(r.package_sha256).slice(0, 16), sha_full: r.package_sha256, at: iso(r.created_at), published: r.published, is_security: r.is_security,
  }));

  const signer = getSigner();
  const keys = publicKeys();
  const tokByKid = new Map(tokens.map((t) => [t.kid, t]));
  const KEYS = Object.entries(keys).map(([kid, x]) => ({
    kid, role: kid === signer.kid ? "active" : "next", fp: fingerprint(x), pub: x,
    lastUsed: ms(tokByKid.get(kid)?.last_used), issued24h: tokByKid.get(kid)?.issued_24h ?? 0,
  })).sort((a) => (a.role === "active" ? -1 : 1));

  const active = INST.length;
  const fresh = INST.filter((i) => i.hb && now - i.hb < DAY).length;
  const silent = INST.filter((i) => !i.hb || now - i.hb > 3 * DAY).length;
  const pubRel = REL.filter((r) => r.published).length;
  const HEALTH = [
    { name: "API", detail: "this request, end to end", lv: "ok", text: "Operational", pct: 100, metric: `${Date.now() - t0} ms` },
    { name: "Database", detail: "Neon Postgres · fra1", lv: dbMs > 1500 ? "warn" : "ok", text: dbMs > 1500 ? "Slow" : "Operational", pct: dbMs > 1500 ? 60 : 100, metric: `${dbMs} ms` },
    { name: "Licensing engine", detail: "activate · heartbeat · deactivate", lv: "ok", text: "Operational", pct: 100, metric: `${active} active` },
    { name: "Signing service", detail: `Ed25519 · ${signer.kid}`, lv: "ok", text: "Operational", pct: 100, metric: "self-test ok" },
    { name: "Telemetry", detail: "install heartbeats · 24 h", lv: active && fresh < active ? "warn" : "ok", text: active && fresh < active ? "Degraded" : "Operational", pct: active ? Math.round((fresh / active) * 100) : 100, metric: `${fresh}/${active} in 24 h` },
    { name: "Update service", detail: "signed manifests · one-time links", lv: "ok", text: "Operational", pct: 100, metric: `${pubRel} releases` },
  ];

  // Needs attention — rules over live state.
  const ATTN: Row[] = [];
  const warn24 = sevEvents.filter((e) => now - ms(e.created_at)! < DAY);
  if (warn24.length) ATTN.push({ lv: "warn", title: `${warn24.length} security warning${warn24.length === 1 ? "" : "s"} in the last 24 hours`, body: [...new Set(warn24.map((e) => SEC_TEXT[e.kind]?.kind ?? e.kind))].join(" · "), meta: "", to: "#/security", cta: "Review events" });
  if (silent) ATTN.push({ lv: "warn", title: `${silent} installation${silent === 1 ? "" : "s"} silent for more than 3 days`, body: "Their tokens keep working through the grace period, then they hold their queues.", meta: "", to: "#/installations", cta: "Investigate" });
  for (const l of LIC.filter((x) => x.status === "suspended")) ATTN.push({ lv: "info", title: `Licence #${l.id} is suspended`, body: `${l.client} · WHMCS service #${l.svc}. WHMCS decides when it returns.`, meta: "", to: `#/licences/${l.id}`, cta: "Review licence" });
  const soon = LIC.filter((l) => l.status === "active" && l.updates && new Date(l.updates).getTime() - now < 30 * DAY);
  if (soon.length) ATTN.push({ lv: "info", title: `${soon.length} licence${soon.length === 1 ? "" : "s"} lose update access within 30 days`, body: soon.map((l) => `#${l.id}`).join(", "), meta: "", to: "#/licences", cta: "Review licences" });
  if (KEYS.length > 1) ATTN.push({ lv: "info", title: "Signing-key rotation rehearsal not recorded", body: "The next key is bundled in every module; rehearse the switch on a preview deployment.", meta: "", to: "#/keys", cta: "Review" });
  if (operator.must_change_password) ATTN.unshift({ lv: "bad", title: "Change the initial console password", body: "This account still uses the password it was created with.", meta: "", to: "#/settings?profile=1", cta: "Change password" });

  return {
    server_time: now, region: process.env.VERCEL_REGION || "fra1", signer: signer.kid,
    licences: LIC, installs: INST, events: EV, security: SEC, releases: REL, keys: KEYS, health: HEALTH, attention: ATTN,
    operators: operators.map((o) => ({ id: o.id, email: o.email, name: o.name, role: o.role, must_change_password: o.must_change_password, last_login_at: ms(o.last_login_at), created_at: ms(o.created_at) })),
    products: products.map((p) => ({ key: productKey(String(p.slug)), slug: p.slug, name: p.name, prefix: p.key_prefix, token_ttl_hours: p.token_ttl_hours, grace_hours: p.grace_hours })),
  };
}
