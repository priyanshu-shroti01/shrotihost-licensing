/** Daily retention job (vercel.json cron). Vercel sends Authorization: Bearer $CRON_SECRET. */
import { prune } from "@/lib/admin";
import { bearerFrom } from "@/lib/bearer";
import { safeEqual } from "@/lib/crypto";
import { ApiError, handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    const presented = bearerFrom(req);
    if (!secret || !presented || !safeEqual(presented, secret)) throw new ApiError(401, "unauthenticated", "Not allowed.");
    return json({ ok: true, pruned: await prune() });
  });
}
