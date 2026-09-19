/**
 * Shared plumbing for the authenticated install routes.
 */
import { bearerFrom } from "./bearer.ts";
import { authInstall, readSignedHeaders, type InstallContext } from "./install.ts";
import { clientIp, parseObject, readRaw } from "./http.ts";
import { pathAndQuery } from "./reqauth.ts";
import { enforceRateLimit } from "./ratelimit.ts";

export async function installRequest(req: Request, perHour: number): Promise<{ ctx: InstallContext; body: Record<string, unknown>; ip: string }> {
  const ip = clientIp(req);
  const instance = req.headers.get("x-shl-instance");
  enforceRateLimit(`inst:${instance ?? ip}:${new URL(req.url).pathname}`, perHour, 3_600_000);
  const raw = await readRaw(req);
  const ctx = await authInstall(bearerFrom(req), instance, readSignedHeaders(req), req.method, pathAndQuery(req), raw, ip);
  return { ctx, body: parseObject(raw), ip };
}
