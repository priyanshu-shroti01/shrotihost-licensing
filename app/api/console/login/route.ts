/** POST /api/console/login — { email, password } → session cookie. */
import { makeSession, operatorView, sessionCookie, signIn, SESSION_TTL_MS } from "@/lib/operator";
import { recordEvent } from "@/lib/events";
import { q } from "@/lib/db";
import { ApiError, clientIp, handle, json, parseObject, readRaw, str } from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const origin = req.headers.get("origin"), host = req.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) throw new ApiError(403, "bad_origin", "Sign in from the console page.");
    const ip = clientIp(req);
    enforceRateLimit(`login:${ip}`, 30, 15 * 60_000);
    const b = parseObject(await readRaw(req));
    let op;
    try {
      op = await signIn(str(b, "email", { required: true, max: 200 }), str(b, "password", { required: true, max: 200 }), ip);
    } catch (e) {
      if (e instanceof ApiError && e.code === "bad_credentials") await recordEvent(q, "console_login_failed", { severity: "warning", ip, detail: { email: String(b.email ?? "").slice(0, 80) } });
      throw e;
    }
    await recordEvent(q, "console_login", { actor: `console:${op.email}`, ip });
    return json({ operator: operatorView(op) }, 200, { "set-cookie": sessionCookie(makeSession(op), Math.floor(SESSION_TTL_MS / 1000)) });
  });
}
