/**
 * Entitlement tokens: what an install is allowed to do, signed.
 *
 * Timing (licensing-server-v2.md §3): a token lives 7 days, and an install
 * that cannot reach us keeps working for a further 14 (grace_until). Installs
 * heartbeat daily, so a suspension reaches a connected install within a day,
 * while a Vercel or network outage has three weeks before anyone notices.
 *
 * A negative status (suspended, terminated, expired, reissue_required) is also
 * a signed token. That is the only thing a module will ever downgrade on: a
 * timeout, a 5xx or an unsigned 401 changes nothing on the install.
 */
import { randomBytes } from "node:crypto";
import type { Query, Row } from "./db.ts";
import { getSigner, signJws } from "./sign.ts";

export const ISSUER = "licensing.shrotihost.in";

export type EntStatus = "active" | "suspended" | "terminated" | "expired" | "reissue_required";

export type EntitlementClaims = {
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  nbf: number;
  exp: number;
  grace_until: number;
  jti: string;
  status: EntStatus;
  reason?: string;
  plan: string;
  features: string[];
  limits: Record<string, number>;
  bind: { domain: string; install_dir: string; instance_id: string };
  support_valid: boolean;
  updates_valid: boolean;
  support_expires_at: string | null;
  updates_expires_at: string | null;
  subscription_expires_at: string | null;
  license_hint: string;
};

function iso(v: unknown): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function notPassed(v: unknown, now: number): boolean {
  if (!v) return true; // NULL = lifetime
  const t = (v instanceof Date ? v : new Date(String(v))).getTime();
  return Number.isNaN(t) ? false : t > now;
}

/** Status as a module should see it. Expiry is computed, never stored. */
export function effectiveStatus(lic: Row, now = Date.now()): Exclude<EntStatus, "reissue_required"> {
  if (lic.status === "suspended" || lic.status === "terminated") return lic.status;
  if (!notPassed(lic.subscription_expires_at, now)) return "expired";
  return "active";
}

export function buildClaims(
  lic: Row,
  product: Row,
  bind: { domain: string; install_dir: string; instance_id: string },
  opts: { status?: EntStatus; reason?: string; now?: number } = {},
): EntitlementClaims {
  const now = opts.now ?? Date.now();
  const iat = Math.floor(now / 1000);
  const status = opts.status ?? effectiveStatus(lic, now);
  const exp = iat + Number(product.token_ttl_hours) * 3600;
  // Grace exists for connectivity trouble. A negative status has none.
  const grace = status === "active" ? exp + Number(product.grace_hours) * 3600 : exp;
  return {
    iss: ISSUER,
    aud: String(product.slug),
    sub: `lic_${lic.id}`,
    iat,
    nbf: iat - 60,
    exp,
    grace_until: grace,
    jti: randomBytes(16).toString("base64url"),
    status,
    ...(opts.reason ? { reason: opts.reason } : {}),
    plan: String(lic.plan ?? "standard"),
    features: (lic.features ?? product.features ?? []) as string[],
    limits: (lic.limits ?? product.limits ?? {}) as Record<string, number>,
    bind,
    support_valid: notPassed(lic.support_expires_at, now),
    updates_valid: notPassed(lic.updates_expires_at, now),
    support_expires_at: iso(lic.support_expires_at),
    updates_expires_at: iso(lic.updates_expires_at),
    subscription_expires_at: iso(lic.subscription_expires_at),
    license_hint: String(lic.key_hint),
  };
}

export async function issueToken(
  q: Query,
  lic: Row,
  product: Row,
  activation: Row | null,
  bind: { domain: string; install_dir: string; instance_id: string },
  opts: { status?: EntStatus; reason?: string; now?: number } = {},
): Promise<{ token: string; claims: EntitlementClaims }> {
  const claims = buildClaims(lic, product, bind, opts);
  const token = signJws(claims, "shl-entitlement+jwt");
  await q(
    `INSERT INTO entitlement_tokens (jti, license_id, activation_id, kid, status, issued_at, expires_at, grace_until)
     VALUES ($1, $2, $3, $4, $5, to_timestamp($6), to_timestamp($7), to_timestamp($8))`,
    [claims.jti, lic.id, activation?.id ?? null, getSigner().kid, claims.status, claims.iat, claims.exp, claims.grace_until],
  );
  return { token, claims };
}
