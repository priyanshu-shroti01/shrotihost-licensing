/** POST /api/updates/download — body { version? }. Returns a one-time URL valid for 15 minutes. */
import { issueDownload } from "@/lib/install";
import { installRequest } from "@/lib/installroute";
import { ApiError, handle, json, str } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const { ctx, body } = await installRequest(req, 20);
    if (ctx.act.status !== "active") throw new ApiError(403, "reissue_required", "Activate this installation again first.");
    return json(await issueDownload(ctx.lic, ctx.product, ctx.act.id, str(body, "version", { max: 40 }) || null));
  });
}
