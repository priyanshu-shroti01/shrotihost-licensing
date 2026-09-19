/** POST /api/deactivate — release this install's seat. */
import { deactivate } from "@/lib/install";
import { installRequest } from "@/lib/installroute";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const { ctx, ip } = await installRequest(req, 20);
    return json(await deactivate(ctx, ip));
  });
}
