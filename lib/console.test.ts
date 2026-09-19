/**
 * Console sign-in, sessions and profile — the rules that keep an internet-facing
 * licence console from being the weak point.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { freshDb, setupEnv, testSigner } from "./testkit.ts";
import { q } from "./db.ts";
import { hashPassword, makeSession, requireOperator, signIn, updateProfile, SESSION_COOKIE } from "./operator.ts";
import { buildSnapshot } from "./console.ts";
import * as admin from "./admin.ts";
import { activate } from "./install.ts";

setupEnv();
beforeEach(async () => {
  await freshDb();
  testSigner();
  await q("INSERT INTO operators (email, password_hash) VALUES ($1, $2)", ["support@shrotihost.in", hashPassword("password")]);
});
const reqWith = (cookie: string, method = "GET", headers: Record<string, string> = {}) =>
  new Request("https://licensing.shrotihost.in/api/console/session", { method, headers: { cookie: `${SESSION_COOKIE}=${cookie}`, host: "licensing.shrotihost.in", ...headers } });

test("the seeded owner signs in and is flagged to change the password", async () => {
  const op = await signIn("Support@ShrotiHost.in ", "password", "1.1.1.1");
  assert.equal(op.must_change_password, true);
});

test("a wrong password and an unknown email give the same error", async () => {
  await assert.rejects(signIn("support@shrotihost.in", "nope", "1.1.1.1"), (e: any) => e.code === "bad_credentials");
  await assert.rejects(signIn("nobody@example.com", "password", "1.1.1.1"), (e: any) => e.code === "bad_credentials");
});

test("eight failures lock the address out, even for the right password", async () => {
  for (let i = 0; i < 8; i++) await assert.rejects(signIn("support@shrotihost.in", "wrong", "2.2.2.2"));
  await assert.rejects(signIn("support@shrotihost.in", "password", "2.2.2.2"), (e: any) => e.code === "locked");
  await signIn("support@shrotihost.in", "password", "3.3.3.3"); // another address is unaffected
});

test("a session cookie authenticates reads; writes also need same-origin + the console header", async () => {
  const op = await signIn("support@shrotihost.in", "password", "1.1.1.1");
  const c = makeSession(op);
  assert.equal((await requireOperator(reqWith(c))).email, "support@shrotihost.in");
  await assert.rejects(requireOperator(reqWith(c, "POST")), (e: any) => e.code === "bad_origin");
  await assert.rejects(requireOperator(reqWith(c, "POST", { origin: "https://evil.example", "x-shl-console": "1" })), (e: any) => e.code === "bad_origin");
  assert.ok(await requireOperator(reqWith(c, "POST", { origin: "https://licensing.shrotihost.in", "x-shl-console": "1" })));
});

test("a forged or tampered cookie is refused", async () => {
  const op = await signIn("support@shrotihost.in", "password", "1.1.1.1");
  const c = makeSession(op);
  await assert.rejects(requireOperator(reqWith(c.slice(0, -2) + "xx")), (e: any) => e.code === "signed_out");
  await assert.rejects(requireOperator(reqWith("")), (e: any) => e.code === "signed_out");
});

test("changing the password needs the current one, rejects weak ones, and ends other sessions", async () => {
  const op = await signIn("support@shrotihost.in", "password", "1.1.1.1");
  const old = makeSession(op);
  await assert.rejects(updateProfile(op, { current_password: "x", new_password: "a-strong-new-pass" }), (e: any) => e.code === "bad_password");
  await assert.rejects(updateProfile(op, { current_password: "password", new_password: "short" }), (e: any) => e.code === "weak_password");
  await assert.rejects(updateProfile(op, { current_password: "password", new_password: "password123" }), (e: any) => e.code === "weak_password");
  const updated = await updateProfile(op, { current_password: "password", new_password: "a-strong-new-pass" });
  assert.equal(updated.must_change_password, false);
  await assert.rejects(requireOperator(reqWith(old)), (e: any) => e.code === "signed_out");
  await signIn("support@shrotihost.in", "a-strong-new-pass", "1.1.1.1");
  await assert.rejects(signIn("support@shrotihost.in", "password", "4.4.4.4"));
});

test("the email can be changed and must be valid and unused", async () => {
  const op = await signIn("support@shrotihost.in", "password", "1.1.1.1");
  await q("INSERT INTO operators (email, password_hash) VALUES ('ops@shrotihost.in', $1)", [hashPassword("x")]);
  await assert.rejects(updateProfile(op, { current_password: "password", email: "not-an-email" }), (e: any) => e.code === "invalid_email");
  await assert.rejects(updateProfile(op, { current_password: "password", email: "ops@shrotihost.in" }), (e: any) => e.code === "email_taken");
  const u = await updateProfile(op, { current_password: "password", email: "Admin@ShrotiHost.in" });
  assert.equal(u.email, "admin@shrotihost.in");
});

test("the snapshot reflects live rows and asks for the password change first", async () => {
  await admin.upsertProduct({ slug: "shrotihost-whatsapp-manager-whmcs", name: "WhatsApp Manager", key_prefix: "SHROTI-WM" });
  const r = await admin.createLicense({ product_slug: "shrotihost-whatsapp-manager-whmcs", whmcs_service_id: 342, client_name: "Shroti Host" });
  await activate({ license_key: r.license_key!, product: "shrotihost-whatsapp-manager-whmcs", domain: "portal.shrotihost.in", install_dir: "/home/x", software_version: "2.0" }, "141.95.16.140");
  const op = (await q("SELECT * FROM operators LIMIT 1"))[0]!;
  const s = await buildSnapshot(op);
  assert.equal(s.licences.length, 1);
  assert.equal(s.installs.length, 1);
  assert.equal(s.installs[0]!.p, "wa");
  assert.equal(s.attention[0]!.lv, "bad");
  assert.match(s.attention[0]!.title, /password/);
  assert.ok(s.keys[0]!.fp.startsWith("SHA256:"));
});
