/**
 * GET /api/keys — the public keys installs trust, by kid. Informational:
 * modules ship with these bundled and never fetch them at runtime, because a
 * key fetched over the network is a key an attacker can substitute.
 */
import { publicKeys } from "@/lib/sign";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => json({ alg: "EdDSA", crv: "Ed25519", keys: publicKeys() }));
}
