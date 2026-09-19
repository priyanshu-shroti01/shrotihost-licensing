/**
 * POST /api/console/profile — { current_password, email?, name?, new_password? }.
 * Any change ends every other session; this one gets a fresh cookie.
 */
import { makeSession, operatorView, requireOperator, sessionCookie, SESSION_TTL_MS, updateProfile } from "@/lib/operator";
import { recordEvent } from "@/lib/events";
import { q } from "@/lib/db";
import { clientIp, handle, json, parseObject, readRaw } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const op = await requireOperator(req);
    const b = parseObject(await readRaw(req)) as Record<string, string>;
    const updated = await updateProfile(op, b);
    const changed = [b.email && b.email.trim().toLowerCase() !== op.email ? "email" : "", b.new_password ? "password" : "", b.name !== undefined ? "name" : ""].filter(Boolean);
    await recordEvent(q, "console_profile_updated", { actor: `console:${updated.email}`, ip: clientIp(req), detail: { changed } });
    return json({ operator: operatorView(updated) }, 200, { "set-cookie": sessionCookie(makeSession(updated), Math.floor(SESSION_TTL_MS / 1000)) });
  });
}
