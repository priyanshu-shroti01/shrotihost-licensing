/** GET /api/health — liveness for uptime checks: database reachable, signing key loads. */
import { q } from "@/lib/db";
import { getSigner } from "@/lib/sign";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = { database: false, signing_key: false };
  try {
    await q("SELECT 1 FROM products LIMIT 1");
    checks.database = true;
  } catch { /* reported below */ }
  try {
    getSigner();
    checks.signing_key = true;
  } catch { /* reported below */ }
  const ok = Object.values(checks).every(Boolean);
  return json({ ok, service: "shrotihost-licensing", version: "2.0.0", checks, server_time: Math.floor(Date.now() / 1000) }, ok ? 200 : 503);
}
