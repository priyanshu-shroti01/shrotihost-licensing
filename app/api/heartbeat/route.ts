/** POST /api/heartbeat — refresh the signed entitlement. Installs call this daily. */
import { heartbeat } from "@/lib/install";
import { installRequest } from "@/lib/installroute";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const { ctx, body, ip } = await installRequest(req, 60);
    return json(await heartbeat(ctx, body, ip));
  });
}
