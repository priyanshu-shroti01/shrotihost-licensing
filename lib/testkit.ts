/**
 * Test harness: a fresh in-process Postgres (PGlite) with the real schema,
 * and a throwaway Ed25519 key. Not imported by any route.
 */
import { generateKeyPairSync } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { setDb, type Query } from "./db.ts";
import { SCHEMA_SQL } from "./schema.ts";
import { setSigner, signerFromPkcs8, type Signer } from "./sign.ts";
import { resetRateLimits } from "./ratelimit.ts";

let shared: PGlite | null = null;

/** One PGlite per test file (boot is ~1 s); tables are emptied between tests. */
export async function freshDb(): Promise<PGlite> {
  if (shared) {
    await shared.exec(
      "TRUNCATE events, request_nonces, download_tokens, releases, blacklist, entitlement_tokens, activations, licenses, products, operators, login_attempts RESTART IDENTITY CASCADE",
    );
    resetRateLimits();
    return shared;
  }
  const pg = new PGlite();
  shared = pg;
  await pg.exec(SCHEMA_SQL);
  const run = (db: { query: PGlite["query"] }): Query => async (text, params = []) => (await db.query(text, params as any[])).rows as any[];
  setDb({ query: run(pg), transaction: (fn) => pg.transaction((t) => fn(run(t as any))) });
  resetRateLimits();
  return pg;
}

export function testSigner(kid = "test-1"): Signer {
  const { privateKey } = generateKeyPairSync("ed25519");
  const der = privateKey.export({ format: "der", type: "pkcs8" }) as Buffer;
  const s = signerFromPkcs8(kid, der.toString("base64"));
  setSigner(s);
  return s;
}

export function setupEnv(): void {
  process.env.SERVER_SECRET = "test-server-secret-0123456789abcdef0123456789";
  process.env.ADMIN_API_KEY = "shl_ak_test";
  process.env.ADMIN_API_SECRET = "admin-secret-for-tests";
  process.env.SESSION_SECRET = "session-secret-for-tests-0123456789abcdef";
}
