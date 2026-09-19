/** GET /api/console/snapshot — everything the console renders, from the live database. */
import { buildSnapshot } from "@/lib/console";
import { operatorView, requireOperator } from "@/lib/operator";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => {
    const op = await requireOperator(req);
    return json({ ...(await buildSnapshot(op)), operator: operatorView(op) });
  });
}
