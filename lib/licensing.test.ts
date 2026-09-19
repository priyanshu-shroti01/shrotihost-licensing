/**
 * Business rules of the licensing server, run against a real Postgres (PGlite)
 * and a throwaway Ed25519 key. Named for the rule; the comment says which bug
 * or attack the assertion exists to stop.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { freshDb, setupEnv, testSigner } from "./testkit.ts";
import { q, one } from "./db.ts";
import { publicKeys, verifyJws, signJws, type Signer } from "./sign.ts";
import { signRequest } from "./reqauth.ts";
import * as admin from "./admin.ts";
import { activate, consumeDownload, issueDownload, compareVersions } from "./install.ts";
import { keyHash, normalizeDir, normalizeDomain } from "./keys.ts";
import { POST as heartbeatPOST } from "../app/api/heartbeat/route.ts";
import { POST as updatesPOST } from "../app/api/updates/check/route.ts";
import { GET as adminGET, POST as adminPOST } from "../app/api/admin/[...path]/route.ts";

setupEnv();
let signer: Signer;
const BASE = "https://licensing.shrotihost.in";

beforeEach(async () => {
  await freshDb();
  signer = testSigner();
  await admin.upsertProduct({ slug: "shrotihost-whatsapp-manager-whmcs", name: "WhatsApp Manager", key_prefix: "SHROTI-WM", features: ["bulk_send"] });
});

const nonce = () => randomBytes(12).toString("base64url");
const now = () => String(Math.floor(Date.now() / 1000));

function installReq(path: string, act: { instance_id: string; install_token: string; install_secret: string }, body: object, opts: { ts?: string; nonce?: string; secret?: string } = {}) {
  const raw = JSON.stringify(body);
  const ts = opts.ts ?? now();
  const n = opts.nonce ?? nonce();
  return new Request(BASE + path, {
    method: "POST",
    body: raw,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${act.install_token}`,
      "x-shl-instance": act.instance_id,
      "x-shl-timestamp": ts,
      "x-shl-nonce": n,
      "x-shl-signature": signRequest(opts.secret ?? act.install_secret, ts, n, "POST", path, raw),
    },
  });
}

function adminReq(method: "GET" | "POST", path: string, body?: object, opts: { nonce?: string; secret?: string } = {}) {
  const raw = body ? JSON.stringify(body) : "";
  const ts = now();
  const n = opts.nonce ?? nonce();
  return new Request(BASE + path, {
    method,
    ...(method === "POST" ? { body: raw } : {}),
    headers: {
      "x-shl-key": "shl_ak_test",
      "x-shl-timestamp": ts,
      "x-shl-nonce": n,
      "x-shl-signature": signRequest(opts.secret ?? "admin-secret-for-tests", ts, n, method, path, raw),
    },
  });
}
const ctxFor = (path: string) => ({ params: Promise.resolve({ path: path.replace("/api/admin/", "").split("/").filter(Boolean) }) });

async function newLicense(extra: Record<string, unknown> = {}) {
  const r = await admin.createLicense({ product_slug: "shrotihost-whatsapp-manager-whmcs", whmcs_service_id: 347, ...extra });
  return { key: r.license_key as string, id: r.license.id as number };
}

async function activated(key: string, domain = "portal.shrotihost.in", dir = "/home/shrotihost/portal.shrotihost.in") {
  return activate({ license_key: key, product: "shrotihost-whatsapp-manager-whmcs", domain, install_dir: dir, software_version: "2.1" }, "141.95.16.140");
}

/* ─────────────────────────────── signing ─────────────────────────────── */

test("an entitlement verifies with the published public key and carries the binding", async () => {
  const { key } = await newLicense();
  const a = await activated(key);
  const v = verifyJws<any>(a.entitlement, publicKeys());
  assert.ok(v);
  assert.equal(v.payload.status, "active");
  assert.equal(v.payload.aud, "shrotihost-whatsapp-manager-whmcs");
  assert.equal(v.payload.bind.domain, "portal.shrotihost.in");
  assert.equal(v.payload.bind.instance_id, a.instance_id);
  assert.ok(v.payload.grace_until > v.payload.exp, "active tokens get offline grace");
});

test("a token with one changed byte is rejected (v1's forged-cache bypass)", async () => {
  const { key } = await newLicense();
  const a = await activated(key);
  const [h, p, s] = a.entitlement.split(".");
  const payload = JSON.parse(Buffer.from(p!, "base64url").toString());
  payload.status = "active";
  payload.limits = { messages_per_day: 999999 };
  const forged = `${h}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${s}`;
  assert.equal(verifyJws(forged, publicKeys()), null);
});

test("a token signed by any other key is rejected, even with our kid (the /etc/hosts bypass)", () => {
  const trusted = publicKeys();
  testSigner(signer.kid); // attacker's own key, claiming our kid
  const fake = signJws({ status: "active" }, "shl-entitlement+jwt");
  assert.equal(verifyJws(fake, trusted), null);
});

test("an unknown kid is rejected rather than fetched", () => {
  const fake = signJws({ status: "active" }, "x");
  assert.equal(verifyJws(fake, { "other-kid": signer.publicKeyB64url() }), null);
});

/* ─────────────────────────────── activation ─────────────────────────────── */

test("the same install re-activating reuses its seat instead of taking a second", async () => {
  const { key, id } = await newLicense();
  const a1 = await activated(key);
  const a2 = await activated(key, "https://www.portal.shrotihost.in/", "/home/shrotihost/portal.shrotihost.in/");
  assert.equal(a1.instance_id, a2.instance_id);
  assert.notEqual(a1.install_token, a2.install_token, "credentials rotate");
  const n = await one("SELECT count(*)::int AS n FROM activations WHERE license_id = $1 AND status = 'active'", [id]);
  assert.equal(n!.n, 1);
});

test("a second production install is refused at the seat limit", async () => {
  const { key } = await newLicense();
  await activated(key);
  await assert.rejects(activated(key, "codemarket.in", "/home/codemarket/whmcs"), (e: any) => e.code === "activation_limit");
});

test("localhost installs never consume a seat", async () => {
  const { key } = await newLicense();
  await activated(key, "localhost", "/var/www/whmcs");
  await activated(key); // production still fits
});

test("unknown key and unknown product give the same answer", async () => {
  await assert.rejects(activated("SHROTI-WM-NOPE"), (e: any) => e.code === "license_not_found");
  await assert.rejects(
    activate({ license_key: "x", product: "nope", domain: "a.com", install_dir: "/x" }, "1.1.1.1"),
    (e: any) => e.code === "license_not_found",
  );
});

test("a suspended licence cannot activate", async () => {
  const { key, id } = await newLicense();
  await admin.setStatus(id, "suspended", "unpaid");
  await assert.rejects(activated(key), (e: any) => e.code === "license_suspended");
});

test("a passed subscription date reads as expired without any status write", async () => {
  const { key } = await newLicense({ subscription_expires_at: "2020-01-01" });
  await assert.rejects(activated(key), (e: any) => e.code === "license_expired");
});

test("a blacklisted domain cannot activate", async () => {
  const { key } = await newLicense();
  await admin.addBlacklist({ kind: "domain", value: "https://portal.shrotihost.in" });
  await assert.rejects(activated(key), (e: any) => e.code === "blacklisted");
});

test("an adopted v1 key keeps working and its plaintext is never stored", async () => {
  const r = await admin.createLicense({ product_slug: "shrotihost-whatsapp-manager-whmcs", whmcs_service_id: 1, license_key: "SHROTI-WM-ABCDE-FGHJK" });
  assert.equal(r.license_key, null);
  const row = await one("SELECT * FROM licenses WHERE id = $1", [r.license.id]);
  assert.equal(row!.key_hash, keyHash(" shroti-wm-abcde-fghjk "));
  assert.ok(!JSON.stringify(row).includes("ABCDE-FGHJK"));
  await activated("SHROTI-WM-ABCDE-FGHJK");
});

test("CreateAccount retried for the same WHMCS service returns the existing licence", async () => {
  const a = await newLicense();
  const b = await admin.createLicense({ product_slug: "shrotihost-whatsapp-manager-whmcs", whmcs_service_id: 347 });
  assert.equal(b.created, false);
  assert.equal(b.license.id, a.id);
  assert.equal(b.license_key, null);
});

/* ─────────────────────────────── heartbeat ─────────────────────────────── */

test("heartbeat refreshes the entitlement", async () => {
  const { key } = await newLicense();
  const a = await activated(key);
  const res = await heartbeatPOST(installReq("/api/heartbeat", a, { software_version: "2.1.1", domain: "portal.shrotihost.in", install_dir: "/home/shrotihost/portal.shrotihost.in" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(verifyJws<any>(body.entitlement, publicKeys())!.payload.status, "active");
});

test("a replayed heartbeat (same nonce) is rejected", async () => {
  const { key } = await newLicense();
  const a = await activated(key);
  const n = nonce();
  assert.equal((await heartbeatPOST(installReq("/api/heartbeat", a, {}, { nonce: n }))).status, 200);
  const again = await heartbeatPOST(installReq("/api/heartbeat", a, {}, { nonce: n }));
  assert.equal(again.status, 401);
  assert.equal((await again.json()).error.code, "replayed_request");
});

test("a heartbeat outside the ±300 s window is rejected", async () => {
  const { key } = await newLicense();
  const a = await activated(key);
  const res = await heartbeatPOST(installReq("/api/heartbeat", a, {}, { ts: String(Math.floor(Date.now() / 1000) - 400) }));
  assert.equal((await res.json()).error.code, "clock_skew");
});

test("a stolen install token without its secret is useless", async () => {
  const { key } = await newLicense();
  const a = await activated(key);
  const res = await heartbeatPOST(installReq("/api/heartbeat", a, {}, { secret: "guessed" }));
  assert.equal((await res.json()).error.code, "bad_signature");
});

test("a signature for one endpoint cannot be replayed against another", async () => {
  const { key } = await newLicense();
  const a = await activated(key);
  const req = installReq("/api/heartbeat", a, { current_version: "1" });
  const moved = new Request(BASE + "/api/updates/check", { method: "POST", headers: req.headers, body: JSON.stringify({ current_version: "1" }) });
  assert.equal((await (await updatesPOST(moved)).json()).error.code, "bad_signature");
});

test("suspension reaches the install as a SIGNED negative status", async () => {
  const { key, id } = await newLicense();
  const a = await activated(key);
  await admin.setStatus(id, "suspended", "unpaid");
  const body = await (await heartbeatPOST(installReq("/api/heartbeat", a, {}))).json();
  const v = verifyJws<any>(body.entitlement, publicKeys())!;
  assert.equal(v.payload.status, "suspended");
  assert.equal(v.payload.grace_until, v.payload.exp, "no grace on a negative status");
});

test("a copy of the install on another domain is told to re-activate, and the original is untouched", async () => {
  const { key, id } = await newLicense();
  const a = await activated(key);
  const body = await (await heartbeatPOST(installReq("/api/heartbeat", a, { domain: "staging.example.com", install_dir: "/home/shrotihost/portal.shrotihost.in" }))).json();
  const v = verifyJws<any>(body.entitlement, publicKeys())!;
  assert.equal(v.payload.status, "reissue_required");
  assert.equal(v.payload.bind.domain, "staging.example.com");
  const act = await one("SELECT status FROM activations WHERE license_id = $1", [id]);
  assert.equal(act!.status, "active");
});

test("after a reissue the old install gets a signed reissue_required, not an unsigned 401", async () => {
  const { key, id } = await newLicense();
  const a = await activated(key);
  await admin.reissueLicense(id, true);
  const res = await heartbeatPOST(installReq("/api/heartbeat", a, {}));
  assert.equal(res.status, 200);
  const v = verifyJws<any>((await res.json()).entitlement, publicKeys())!;
  assert.equal(v.payload.status, "reissue_required");
  await activated(key, "codemarket.in", "/home/codemarket/whmcs"); // the seat is free again
  assert.equal((await one("SELECT reissues_used FROM licenses WHERE id = $1", [id]))!.reissues_used, 1);
});

test("regenerating a key revokes installs and the old key stops activating", async () => {
  const { key, id } = await newLicense();
  await activated(key);
  const r = await admin.regenerateKey(id);
  assert.match(r.license_key, /^SHROTI-WM-/);
  await assert.rejects(activated(key), (e: any) => e.code === "license_not_found");
  await activated(r.license_key);
});

test("a terminated licence cannot be unsuspended back to life", async () => {
  const { id } = await newLicense();
  await admin.setStatus(id, "terminated", "");
  await assert.rejects(admin.setStatus(id, "active", ""), (e: any) => e.code === "license_terminated");
  assert.equal((await admin.setStatus(id, "active", "re-activated in WHMCS", true)).status, "active");
});

/* ─────────────────────────────── releases ─────────────────────────────── */

function fakeZip(size = 64): string {
  const b = Buffer.alloc(size, 1);
  b.writeUInt32LE(0x04034b50, 0);
  return b.toString("base64");
}

test("a release manifest is signed and pins the package hash", async () => {
  const rel = await admin.createRelease({ product_slug: "shrotihost-whatsapp-manager-whmcs", version: "2.1", package_b64: fakeZip(), changelog: "x" });
  const row = await one("SELECT manifest_jws FROM releases WHERE version = '2.1'");
  const v = verifyJws<any>(row!.manifest_jws, publicKeys())!;
  assert.equal(v.payload.package_sha256, rel.package_sha256);
  assert.equal(v.payload.version, "2.1");
});

test("a published version cannot be re-uploaded with different bytes", async () => {
  await admin.createRelease({ product_slug: "shrotihost-whatsapp-manager-whmcs", version: "2.1", package_b64: fakeZip() });
  await assert.rejects(
    admin.createRelease({ product_slug: "shrotihost-whatsapp-manager-whmcs", version: "2.1", package_b64: fakeZip(80) }),
    (e: any) => e.code === "release_exists",
  );
});

test("a non-zip upload is refused", async () => {
  await assert.rejects(
    admin.createRelease({ product_slug: "shrotihost-whatsapp-manager-whmcs", version: "2.2", package_b64: Buffer.alloc(64).toString("base64") }),
    (e: any) => e.code === "invalid_request",
  );
});

test("a download token works exactly once", async () => {
  const { id } = await newLicense();
  await admin.createRelease({ product_slug: "shrotihost-whatsapp-manager-whmcs", version: "2.1", package_b64: fakeZip() });
  const d = await admin.downloadForLicense(id, null);
  const token = d.url.split("/").pop()!;
  const first = await consumeDownload(token, "1.1.1.1");
  assert.ok(first && first.body.length === 64);
  assert.equal(await consumeDownload(token, "1.1.1.1"), null);
});

test("an expired download token is refused", async () => {
  const { id } = await newLicense();
  await admin.createRelease({ product_slug: "shrotihost-whatsapp-manager-whmcs", version: "2.1", package_b64: fakeZip() });
  const d = await admin.downloadForLicense(id, null);
  await q("UPDATE download_tokens SET expires_at = now() - interval '1 minute'");
  assert.equal(await consumeDownload(d.url.split("/").pop()!, "1.1.1.1"), null);
});

test("lapsed update entitlement blocks downloads, except security releases", async () => {
  const { id } = await newLicense({ updates_expires_at: "2020-01-01" });
  const lic = await one("SELECT * FROM licenses WHERE id = $1", [id]);
  const product = await one("SELECT * FROM products LIMIT 1");
  await admin.createRelease({ product_slug: "shrotihost-whatsapp-manager-whmcs", version: "2.1", package_b64: fakeZip() });
  await assert.rejects(issueDownload(lic!, product!, null, null), (e: any) => e.code === "updates_expired");
  await admin.createRelease({ product_slug: "shrotihost-whatsapp-manager-whmcs", version: "2.1.1", package_b64: fakeZip(70), is_security: true });
  const d = await issueDownload(lic!, product!, null, null);
  assert.equal(d.release.version, "2.1.1");
});

test("updates/check offers the newest version by version order, not upload order", async () => {
  const { key } = await newLicense();
  const a = await activated(key);
  await admin.createRelease({ product_slug: "shrotihost-whatsapp-manager-whmcs", version: "2.10", package_b64: fakeZip() });
  await admin.createRelease({ product_slug: "shrotihost-whatsapp-manager-whmcs", version: "2.9", package_b64: fakeZip(70) });
  const body = await (await updatesPOST(installReq("/api/updates/check", a, { current_version: "2.1" }))).json();
  assert.equal(body.available, true);
  assert.equal(body.release.version, "2.10");
  assert.ok(verifyJws(body.manifest, publicKeys()));
});

/* ─────────────────────────────── admin API ─────────────────────────────── */

test("the admin API rejects an unsigned request", async () => {
  const res = await adminGET(new Request(BASE + "/api/admin/stats", { headers: { "x-shl-key": "shl_ak_test" } }), ctxFor("/api/admin/stats"));
  assert.equal(res.status, 401);
});

test("the admin API rejects a replayed request (v1 had no nonce)", async () => {
  const n = nonce();
  const body = { product_slug: "shrotihost-whatsapp-manager-whmcs", whmcs_service_id: 9 };
  assert.equal((await adminPOST(adminReq("POST", "/api/admin/licenses", body, { nonce: n }), ctxFor("/api/admin/licenses"))).status, 201);
  const replay = await adminPOST(adminReq("POST", "/api/admin/licenses", body, { nonce: n }), ctxFor("/api/admin/licenses"));
  assert.equal(replay.status, 401);
});

test("the admin API rejects a wrong secret", async () => {
  const res = await adminGET(adminReq("GET", "/api/admin/stats", undefined, { secret: "nope" }), ctxFor("/api/admin/stats"));
  assert.equal((await res.json()).error.code, "bad_signature");
});

test("admin create → suspend → lookup round trip over HTTP", async () => {
  const created = await (await adminPOST(adminReq("POST", "/api/admin/licenses", { product_slug: "shrotihost-whatsapp-manager-whmcs", whmcs_service_id: 5 }), ctxFor("/api/admin/licenses"))).json();
  assert.match(created.license_key, /^SHROTI-WM-[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/);
  const lid = created.license.id;
  const p = `/api/admin/licenses/${lid}/suspend`;
  assert.equal((await (await adminPOST(adminReq("POST", p, { reason: "overdue" }), ctxFor(p))).json()).license.status, "suspended");
  const look = await (await adminPOST(adminReq("POST", "/api/admin/licenses/lookup", { whmcs_service_id: 5 }), ctxFor("/api/admin/licenses/lookup"))).json();
  assert.equal(look.license.id, lid);
  assert.equal(look.license.effective_status, "suspended");
});

/* ─────────────────────────────── helpers ─────────────────────────────── */

test("domain and directory normalisation", () => {
  assert.equal(normalizeDomain("HTTPS://WWW.Portal.ShrotiHost.in:443/whmcs/?x=1"), "portal.shrotihost.in");
  assert.equal(normalizeDir("/home/x//whmcs/"), "/home/x/whmcs");
  assert.equal(normalizeDir("C:\\www\\whmcs\\"), "C:/www/whmcs");
});

test("version comparison is numeric", () => {
  assert.equal(compareVersions("2.10", "2.9"), 1);
  assert.equal(compareVersions("2.1", "2.1.0"), 0);
  assert.equal(compareVersions("2.0", "2.1"), -1);
});

test("a refused activation is still in the audit log after the rollback", async () => {
  await assert.rejects(activated("SHROTI-WM-WRONG-KEY"));
  const ev = await one("SELECT kind, severity FROM events WHERE kind = 'activation_failed'");
  assert.equal(ev?.severity, "warning");
});
