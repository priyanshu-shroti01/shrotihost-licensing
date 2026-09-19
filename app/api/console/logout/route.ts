/** POST /api/console/logout — clears the cookie. { everywhere: true } also ends every other session. */
import { requireOperator, sessionCookie } from "@/lib/operator";
import { q } from "@/lib/db";
import { handle, json, parseObject, readRaw } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const op = await requireOperator(req).catch(() => null);
    const b = parseObject(await readRaw(req));
    if (op && b.everywhere === true) await q("UPDATE operators SET session_version = session_version + 1 WHERE id = $1", [op.id]);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  });
}
