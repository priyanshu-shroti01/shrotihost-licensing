/**
 * Admin API router. One auth point for every admin operation: nothing below
 * runs until the request's HMAC, timestamp and nonce have been verified.
 */
import * as admin from "@/lib/admin";
import { requireAdmin } from "@/lib/adminauth";
import { ApiError, clientIp, handle, json, parseObject, readRaw, str } from "@/lib/http";
import { pathAndQuery } from "@/lib/reqauth";
import { enforceRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ path: string[] }> };

function id(s: string | undefined): number {
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(404, "not_found", "No such resource.");
  return n;
}

async function route(req: Request, ctx: Ctx): Promise<Response> {
  const ip = clientIp(req);
  enforceRateLimit(`admin:${ip}`, 600, 60_000);
  const { path } = await ctx.params;
  const [a, b, c, d, e] = path;
  const isUpload = req.method === "POST" && a === "releases" && path.length === 1;
  const raw = await readRaw(req, isUpload ? 4_400_000 : 64 * 1024);
  await requireAdmin(req, pathAndQuery(req), raw, ip);
  const body = req.method === "POST" ? parseObject(raw) : {};
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (a === "products" && !b) return json({ products: await admin.listProducts() });
    if (a === "licenses" && b && !c) return json({ license: await admin.getLicense(id(b)) });
    if (a === "releases" && !b) return json({ releases: await admin.listReleases(url.searchParams.get("product")) });
    if (a === "events" && !b) {
      const lic = url.searchParams.get("license_id");
      return json({ events: await admin.listEvents(lic ? id(lic) : null, Number(url.searchParams.get("limit") ?? 100) || 100) });
    }
    if (a === "stats" && !b) return json(await admin.stats());
    if (a === "ping" && !b) return json({ ok: true, server_time: Math.floor(Date.now() / 1000) });
  }

  if (req.method === "POST") {
    if (a === "products" && !b) return json({ product: await admin.upsertProduct(body) });
    if (a === "licenses" && !b) {
      const r = await admin.createLicense(body);
      return json(r, r.created ? 201 : 200);
    }
    if (a === "licenses" && b === "lookup" && !c) return json({ license: await admin.lookupLicense(body) });
    if (a === "licenses" && b && c && !d) {
      const lid = id(b);
      const reason = str(body, "reason", { max: 300 });
      switch (c) {
        case "suspend": return json({ license: await admin.setStatus(lid, "suspended", reason) });
        case "unsuspend": return json({ license: await admin.setStatus(lid, "active", reason) });
        case "terminate": return json({ license: await admin.setStatus(lid, "terminated", reason) });
        case "update": return json({ license: await admin.updateLicense(lid, body) });
        case "reissue": return json(await admin.reissueLicense(lid, body.count === true));
        case "regenerate-key": return json(await admin.regenerateKey(lid));
        case "download": return json(await admin.downloadForLicense(lid, str(body, "version", { max: 40 }) || null));
      }
    }
    if (a === "licenses" && b && c === "activations" && d && e === "revoke") {
      return json({ license: await admin.revokeActivation(id(b), id(d)) });
    }
    if (a === "releases" && !b) return json({ release: await admin.createRelease(body) }, 201);
    if (a === "releases" && b && (c === "publish" || c === "unpublish")) return json(await admin.setReleasePublished(id(b), c === "publish"));
    if (a === "blacklist" && !b) return json(await admin.addBlacklist(body));
  }

  throw new ApiError(404, "not_found", "No such admin endpoint.");
}

export function GET(req: Request, ctx: Ctx) {
  return handle(() => route(req, ctx));
}
export function POST(req: Request, ctx: Ctx) {
  return handle(() => route(req, ctx));
}
