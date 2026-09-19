import type { Query } from "./db.ts";

export type Severity = "info" | "warning" | "critical";

/**
 * Append to the audit/security log. Never throws: losing an audit line is bad,
 * failing a customer's activation because of it is worse.
 */
export async function recordEvent(
  q: Query,
  kind: string,
  e: { severity?: Severity; licenseId?: number | null; activationId?: number | null; actor?: string; ip?: string; detail?: object } = {},
): Promise<void> {
  try {
    await q(
      `INSERT INTO events (kind, severity, license_id, activation_id, actor, ip, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [kind, e.severity ?? "info", e.licenseId ?? null, e.activationId ?? null, e.actor ?? null, e.ip ?? null, JSON.stringify(e.detail ?? {})],
    );
  } catch (err) {
    console.error("[licensing] event write failed", kind, err instanceof Error ? err.message : err);
  }
}
