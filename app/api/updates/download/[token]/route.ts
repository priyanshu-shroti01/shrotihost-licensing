/** GET /api/updates/download/:token — redeem a one-time download token. */
import { consumeDownload } from "@/lib/install";
import { ApiError, clientIp, handle } from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const ip = clientIp(req);
    enforceRateLimit(`dl:${ip}`, 30, 3_600_000);
    const { token } = await ctx.params;
    const file = await consumeDownload(token, ip);
    if (!file) throw new ApiError(404, "download_expired", "This download link has expired or was already used. Request a new one.");
    return new Response(new Uint8Array(file.body), {
      headers: {
        "content-type": "application/zip",
        "content-length": String(file.body.length),
        "content-disposition": `attachment; filename="${file.filename}"`,
        "x-package-sha256": file.sha256,
        "cache-control": "no-store",
      },
    });
  });
}
