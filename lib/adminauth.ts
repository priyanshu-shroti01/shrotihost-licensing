import { safeEqual } from "./crypto.ts";
import { ApiError } from "./http.ts";
import { q } from "./db.ts";
import { readSignedHeaders, verifySigned } from "./reqauth.ts";
import { recordEvent } from "./events.ts";

/**
 * Admin requests come from one caller, the WHMCS licensing module, signed with
 * ADMIN_API_SECRET. The key id travels in X-SHL-Key so a request names which
 * credential it claims before anything is compared.
 */
export async function requireAdmin(req: Request, path: string, raw: string, ip: string): Promise<void> {
  const keyId = process.env.ADMIN_API_KEY;
  const secret = process.env.ADMIN_API_SECRET;
  if (!keyId || !secret) throw new ApiError(503, "not_configured", "Admin API is not configured.", true, 300);
  const presented = req.headers.get("x-shl-key") ?? "";
  if (!presented || !safeEqual(presented, keyId)) {
    await recordEvent(q, "admin_auth_failure", { severity: "warning", ip, detail: { reason: "key" } });
    throw new ApiError(401, "unauthenticated", "Admin credentials were not recognised.");
  }
  try {
    await verifySigned(q, "admin", secret, readSignedHeaders(req), req.method, path, raw);
  } catch (e) {
    if (e instanceof ApiError) await recordEvent(q, "admin_auth_failure", { severity: "warning", ip, detail: { reason: e.code } });
    throw e;
  }
}
