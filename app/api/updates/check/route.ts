/** POST /api/updates/check — body { current_version, channel? }. Returns a signed manifest. */
import { updatesCheck } from "@/lib/install";
import { installRequest } from "@/lib/installroute";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const { ctx, body } = await installRequest(req, 30);
    return json(await updatesCheck(ctx, body));
  });
}
