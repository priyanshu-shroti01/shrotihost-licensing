/** GET /api/console/session — who is signed in (401 when nobody). */
import { operatorView, requireOperator } from "@/lib/operator";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handle(async () => json({ operator: operatorView(await requireOperator(req)) }));
}
