/**
 * POST /api/activate — the one call that fails closed.
 * Body: { license_key, product, domain, install_dir, software_version?, php_version?, whmcs_version? }
 */
import { activate } from "@/lib/install";
import { clientIp, handle, json, parseObject, readRaw, str } from "@/lib/http";
import { enforceRateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export function POST(req: Request) {
  return handle(async () => {
    const ip = clientIp(req);
    enforceRateLimit(`activate:${ip}`, 20, 3_600_000);
    const b = parseObject(await readRaw(req));
    const result = await activate({
      license_key: str(b, "license_key", { required: true, max: 120 }),
      product: str(b, "product", { required: true, max: 120 }),
      domain: str(b, "domain", { required: true, max: 255 }),
      install_dir: str(b, "install_dir", { required: true, max: 500 }),
      software_version: str(b, "software_version", { max: 40 }) || undefined,
      php_version: str(b, "php_version", { max: 40 }) || undefined,
      whmcs_version: str(b, "whmcs_version", { max: 40 }) || undefined,
    }, ip);
    return json(result);
  });
}
