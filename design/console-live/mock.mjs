// Local stand-in for /api/console/* using a real snapshot; for QA only.
import http from "node:http";
import { readFileSync } from "node:fs";
const SNAP = JSON.parse(readFileSync(new URL("../../snapshot.json", import.meta.url)));
let op = { id: 1, email: "support@shrotihost.in", name: "Priyanshu Shroti", role: "owner", must_change_password: true, last_login_at: null, created_at: null };
let password = "password", sessions = new Set(), fail = process.env.FAIL === "1";
const send = (res, code, body, headers = {}) => { res.writeHead(code, { "content-type": "application/json", ...headers }); res.end(JSON.stringify(body)); };
const err = (res, code, c, m) => send(res, code, { error: { code: c, message: m } });
const cookie = (req) => /shl_console=([^;]+)/.exec(req.headers.cookie || "")?.[1];
http.createServer(async (req, res) => {
  let body = ""; for await (const ch of req) body += ch;
  const b = body ? JSON.parse(body) : {};
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/console" || u.pathname === "/console/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(readFileSync(new URL("./index.html", import.meta.url))); }
  if (u.pathname === "/api/health") return send(res, 200, { ok: true });
  if (u.pathname === "/__reset") { op = { ...op, email: "support@shrotihost.in", must_change_password: true, name: "Priyanshu Shroti" }; password = "password"; sessions.clear(); return send(res, 200, { ok: true }); }
  if (req.method !== "GET" && req.headers["x-shl-console"] !== "1" && u.pathname !== "/api/console/login") return err(res, 403, "bad_origin", "Request did not come from the console.");
  if (u.pathname === "/api/console/login") {
    if (b.email?.toLowerCase() !== op.email || b.password !== password) return err(res, 401, "bad_credentials", "Email or password is incorrect.");
    const t = Math.random().toString(36).slice(2); sessions.add(t);
    return send(res, 200, { operator: op }, { "set-cookie": `shl_console=${t}; Path=/; HttpOnly; SameSite=Strict` });
  }
  if (!sessions.has(cookie(req))) return err(res, 401, "signed_out", "Sign in to continue.");
  if (u.pathname === "/api/console/session") return send(res, 200, { operator: op });
  if (u.pathname === "/api/console/snapshot") {
    if (fail || process.env.FAIL_AFTER && ++global.n > +process.env.FAIL_AFTER) return err(res, 503, "unavailable", "The licensing service is temporarily unavailable.");
    const s = structuredClone(SNAP); s.operators = [op];
    if (!op.must_change_password) s.attention = s.attention.filter((a) => !a.to.includes("profile"));
    return send(res, 200, s);
  }
  if (u.pathname === "/api/console/logout") { sessions.clear(); return send(res, 200, { ok: true }, { "set-cookie": "shl_console=; Path=/; Max-Age=0" }); }
  if (u.pathname === "/api/console/profile") {
    if (b.current_password !== password) return err(res, 403, "bad_password", "Current password is incorrect.");
    if (b.new_password) { if (b.new_password.length < 10) return err(res, 422, "weak_password", "Use at least 10 characters."); password = b.new_password; op.must_change_password = false; }
    if (b.email) op.email = b.email.toLowerCase(); if (b.name !== undefined) op.name = b.name;
    return send(res, 200, { operator: op });
  }
  if (u.pathname === "/api/console/actions") return send(res, 200, { ok: true, result: b.action === "download" ? { url: "https://licensing.shrotihost.in/api/updates/download/shl_dl_test", expires_at: new Date(Date.now() + 9e5).toISOString(), release: { version: "2.0" } } : {} });
  err(res, 404, "not_found", "Not found");
}).listen(+process.env.PORT || 8791, () => console.log("mock on", process.env.PORT || 8791));
global.n = 0;
