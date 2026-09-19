/**
 * Console operators: password hashing, the signed session cookie, sign-in
 * throttling and the request guard every /api/console route goes through.
 *
 * The session cookie is `base64url(claims).hmac` signed with SESSION_SECRET.
 * Claims carry the operator id and their session_version; the guard re-reads
 * the operator on every request, so changing the password or email (which
 * bumps session_version) signs out every other session immediately.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { q, one, type Row } from "./db.ts";
import { ApiError } from "./http.ts";

export const SESSION_COOKIE = "shl_console";
export const SESSION_TTL_MS = 12 * 60 * 60_000;
const LOCK_WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 8;

/* ── passwords ── */
const N = 16384, R = 8, P = 1, KEYLEN = 32;
export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  return `scrypt$${salt}$${scryptSync(password, salt, KEYLEN, { N, r: R, p: P }).toString("hex")}`;
}
export function passwordMatches(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const got = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}
/** Checked against on unknown emails too, so response time does not reveal which emails exist. */
const DUMMY_HASH = hashPassword("not-a-real-password", "00000000000000000000000000000000");

/* ── session cookie ── */
type Claims = { oid: number; sv: number; iat: number; exp: number };
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new ApiError(503, "not_configured", "Console sign-in is not configured.", true, 300);
  return s;
}
const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");
export function makeSession(op: Row, now = Date.now()): string {
  const claims: Claims = { oid: Number(op.id), sv: Number(op.session_version), iat: now, exp: now + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${sign(body)}`;
}
export function readSession(value: string | undefined, now = Date.now()): Claims | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot), sig = Buffer.from(value.slice(dot + 1));
  const want = Buffer.from(sign(body));
  if (sig.length !== want.length || !timingSafeEqual(sig, want)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Claims;
    return typeof c.exp === "number" && c.exp > now ? c : null;
  } catch {
    return null;
  }
}
export function sessionCookie(value: string, maxAgeSec: number): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`;
}
function cookieFrom(req: Request): string | undefined {
  const m = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(req.headers.get("cookie") ?? "");
  return m?.[1];
}

/* ── guard ── */
/**
 * Every console request: a valid, unexpired cookie for an operator whose
 * session_version still matches. State-changing requests must also come from
 * this origin (CSRF): SameSite=Strict plus an Origin check plus a custom header.
 */
export async function requireOperator(req: Request): Promise<Row> {
  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host || req.headers.get("x-shl-console") !== "1") {
      throw new ApiError(403, "bad_origin", "Request did not come from the console.");
    }
  }
  const claims = readSession(cookieFrom(req));
  if (!claims) throw new ApiError(401, "signed_out", "Sign in to continue.");
  const op = await one("SELECT * FROM operators WHERE id = $1", [claims.oid]);
  if (!op || Number(op.session_version) !== claims.sv) throw new ApiError(401, "signed_out", "Your session has ended. Sign in again.");
  return op;
}
export const operatorView = (op: Row) => ({
  id: op.id, email: op.email, name: op.name, role: op.role, must_change_password: op.must_change_password,
  last_login_at: op.last_login_at, created_at: op.created_at,
});

/* ── sign-in throttle ── */
export async function assertNotLocked(key: string): Promise<void> {
  const r = await one("SELECT blocked_until FROM login_attempts WHERE client_key = $1", [key]);
  const until = r?.blocked_until ? new Date(r.blocked_until).getTime() : 0;
  if (until > Date.now()) {
    throw new ApiError(429, "locked", "Too many failed sign-ins. Try again in a few minutes.", true, Math.ceil((until - Date.now()) / 1000));
  }
}
export async function recordFailure(key: string): Promise<void> {
  await q(
    `INSERT INTO login_attempts (client_key, attempts, first_at) VALUES ($1, 1, now())
     ON CONFLICT (client_key) DO UPDATE SET
       attempts = CASE WHEN login_attempts.first_at < now() - ($2::int * interval '1 millisecond') THEN 1 ELSE login_attempts.attempts + 1 END,
       first_at = CASE WHEN login_attempts.first_at < now() - ($2::int * interval '1 millisecond') THEN now() ELSE login_attempts.first_at END,
       blocked_until = CASE WHEN login_attempts.first_at >= now() - ($2::int * interval '1 millisecond') AND login_attempts.attempts + 1 >= $3
                            THEN now() + ($2::int * interval '1 millisecond') ELSE login_attempts.blocked_until END`,
    [key, LOCK_WINDOW_MS, MAX_FAILURES],
  );
}
export async function clearFailures(key: string): Promise<void> {
  await q("DELETE FROM login_attempts WHERE client_key = $1", [key]);
}

export async function signIn(email: string, password: string, ip: string): Promise<Row> {
  const key = `ip:${ip}`;
  await assertNotLocked(key);
  const op = await one("SELECT * FROM operators WHERE email = $1", [email.trim().toLowerCase()]);
  const ok = passwordMatches(password, op ? String(op.password_hash) : DUMMY_HASH) && !!op;
  if (!ok) {
    await recordFailure(key);
    throw new ApiError(401, "bad_credentials", "Email or password is incorrect.");
  }
  await clearFailures(key);
  const row = (await q("UPDATE operators SET last_login_at = now(), last_login_ip = $2 WHERE id = $1 RETURNING *", [op.id, ip]))[0]!;
  return row;
}

/* ── profile ── */
export const MIN_PASSWORD = 10;
export async function updateProfile(op: Row, b: { current_password?: string; email?: string; new_password?: string; name?: string }): Promise<Row> {
  if (!b.current_password || !passwordMatches(b.current_password, String(op.password_hash))) {
    throw new ApiError(403, "bad_password", "Current password is incorrect.");
  }
  const sets: string[] = [];
  const params: unknown[] = [op.id];
  const put = (sql: string, v: unknown) => { params.push(v); sets.push(sql.replace("?", `$${params.length}`)); };
  if (b.email !== undefined && b.email.trim().toLowerCase() !== op.email) {
    const email = b.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) throw new ApiError(422, "invalid_email", "Enter a valid email address.");
    if (await one("SELECT 1 FROM operators WHERE email = $1 AND id <> $2", [email, op.id])) throw new ApiError(409, "email_taken", "Another operator already uses that email.");
    put("email = ?", email);
  }
  if (b.name !== undefined) put("name = ?", String(b.name).trim().slice(0, 120));
  if (b.new_password) {
    const pw = b.new_password;
    if (pw.length < MIN_PASSWORD) throw new ApiError(422, "weak_password", `Use at least ${MIN_PASSWORD} characters.`);
    if (["password", "password1", "password123", "shrotihost", "licensing"].includes(pw.toLowerCase()) || pw.toLowerCase() === String(op.email)) {
      throw new ApiError(422, "weak_password", "That password is too easy to guess.");
    }
    if (passwordMatches(pw, String(op.password_hash))) throw new ApiError(422, "same_password", "Choose a password you have not used here.");
    put("password_hash = ?", hashPassword(pw));
    sets.push("must_change_password = false");
  }
  if (!sets.length) throw new ApiError(422, "nothing_to_change", "Nothing to change.");
  sets.push("session_version = session_version + 1", "updated_at = now()");
  return (await q(`UPDATE operators SET ${sets.join(", ")} WHERE id = $1 RETURNING *`, params))[0]!;
}
