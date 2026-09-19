/**
 * Signed requests, for both the admin API (WHMCS) and installs.
 *
 *   X-SHL-Timestamp: unix seconds, within ±300 s of server time
 *   X-SHL-Nonce:     16–64 url-safe chars, never reused
 *   X-SHL-Signature: hex HMAC-SHA256(secret, canonical)
 *
 *   canonical = ts \n nonce \n METHOD \n path?query \n sha256hex(body)
 *
 * v1's admin HMAC covered ts|method|path|body but had no nonce, so a captured
 * request could be replayed for five minutes. Method and path are in the
 * canonical string so a signature for one endpoint is useless on another.
 *
 * Install HMAC is not anti-piracy (the secret sits on the customer's server).
 * It stops a stolen install token being usable from somewhere else, and stops
 * a captured heartbeat being replayed.
 */
import { hmacHex, safeEqual, sha256hex } from "./crypto.ts";
import { ApiError } from "./http.ts";
import type { Query } from "./db.ts";

export const SKEW_SECONDS = 300;

export function canonical(ts: string, nonce: string, method: string, pathAndQuery: string, body: string): string {
  return [ts, nonce, method.toUpperCase(), pathAndQuery, sha256hex(body)].join("\n");
}

export function signRequest(secret: string, ts: string, nonce: string, method: string, pathAndQuery: string, body: string): string {
  return hmacHex(secret, canonical(ts, nonce, method, pathAndQuery, body));
}

export type SignedHeaders = { ts: string; nonce: string; signature: string };

export function readSignedHeaders(req: Request): SignedHeaders {
  const ts = req.headers.get("x-shl-timestamp") ?? "";
  const nonce = req.headers.get("x-shl-nonce") ?? "";
  const signature = (req.headers.get("x-shl-signature") ?? "").toLowerCase();
  if (!ts || !nonce || !signature) throw new ApiError(401, "unsigned_request", "Request signature headers are missing.");
  return { ts, nonce, signature };
}

/** Returns clock skew in seconds (server − client). Throws on any failure. */
export async function verifySigned(
  q: Query,
  scope: string,
  secret: string,
  h: SignedHeaders,
  method: string,
  pathAndQuery: string,
  body: string,
  now = Date.now(),
): Promise<number> {
  if (!/^\d{9,11}$/.test(h.ts)) throw new ApiError(401, "bad_timestamp", "Request timestamp is invalid.");
  const skew = Math.round(now / 1000) - Number(h.ts);
  if (Math.abs(skew) > SKEW_SECONDS) {
    throw new ApiError(401, "clock_skew", "Request timestamp is outside the allowed window. Check the server clock.");
  }
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(h.nonce)) throw new ApiError(401, "bad_nonce", "Request nonce is invalid.");
  const expected = signRequest(secret, h.ts, h.nonce, method, pathAndQuery, body);
  if (!/^[0-9a-f]{64}$/.test(h.signature) || !safeEqual(expected, h.signature)) {
    throw new ApiError(401, "bad_signature", "Request signature does not match.");
  }
  // Recorded only after the signature checks out, so garbage cannot fill the table.
  const fresh = await q(
    "INSERT INTO request_nonces (scope, nonce) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING 1 AS ok",
    [scope, h.nonce],
  );
  if (fresh.length === 0) throw new ApiError(401, "replayed_request", "Request nonce has already been used.");
  return skew;
}

export function pathAndQuery(req: Request): string {
  const u = new URL(req.url);
  return u.pathname + u.search;
}
