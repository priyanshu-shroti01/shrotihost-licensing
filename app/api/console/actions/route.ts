/**
 * POST /api/console/actions — the console's state-changing operations.
 * WHMCS stays the authority for licence status and dates: status changes made
 * here are overwritten by WHMCS's next sync, and the console says so before
 * the operator confirms.
 */
import * as admin from "@/lib/admin";
import { requireOperator } from "@/lib/operator";
import { recordEvent } from "@/lib/events";
import { q, one } from "@/lib/db";
import { ApiError, clientIp, handle, int, json, parseObject, readRaw, str } from "@/lib/http";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const op = await requireOperator(req);
    if (op.role === "viewer") throw new ApiError(403, "forbidden", "Your role can view but not change licences.");
    const b = parseObject(await readRaw(req));
    const action = str(b, "action", { required: true, max: 40 });
    const id = int(b, "id");
    const ip = clientIp(req);
    let result: unknown;
    switch (action) {
      case "suspend": result = await admin.setStatus(need(id), "suspended", `Suspended from console by ${op.email}`, true); break;
      case "unsuspend": result = await admin.setStatus(need(id), "active", `Unsuspended from console by ${op.email}`, true); break;
      case "reissue": result = await admin.reissueLicense(need(id), false); break;
      case "revoke-activation": {
        const a = await one("SELECT license_id FROM activations WHERE id = $1", [need(id)]);
        if (!a) throw new ApiError(404, "not_found", "No such installation.");
        result = await admin.revokeActivation(Number(a.license_id), need(id));
        break;
      }
      case "withdraw-release": result = await admin.setReleasePublished(need(id), false); break;
      case "publish-release": result = await admin.setReleasePublished(need(id), true); break;
      case "download": result = await admin.downloadForLicense(need(id), null); break;
      default: throw new ApiError(404, "unknown_action", "Unknown action.");
    }
    await recordEvent(q, "console_action", { actor: `console:${op.email}`, ip, licenseId: ["suspend", "unsuspend", "reissue", "download"].includes(action) ? id : null, detail: { action, id } });
    return json({ ok: true, result });
  });
}

function need(id: number | null): number {
  if (!id || id <= 0) throw new ApiError(422, "invalid_request", "An id is required.");
  return id;
}
