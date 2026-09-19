/**
 * Fixed-window limiter, per server instance (from claude-fleet).
 *
 * The real budget is roughly limit × instances. That is deliberate: a database
 * round trip on every request is the cost this exists to bound. It stops a
 * runaway loop or a crude flood; it is not an authorisation control.
 */
import { ApiError } from "./http.ts";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfter: number } {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const r = rateLimit(key, limit, windowMs);
  if (!r.ok) throw new ApiError(429, "rate_limited", "Too many requests.", true, r.retryAfter);
}

export function resetRateLimits(): void {
  buckets.clear();
}
