#!/usr/bin/env node
/**
 * Generate an Ed25519 signing key for the licensing server.
 *
 *   node scripts/keygen.mjs <kid> <out-dir>
 *
 * Writes <out-dir>/<kid>.pkcs8.b64 (private, mode 600) and prints the public
 * key. The private key goes into Vercel as LICENSE_SIGNING_KEY; the public key
 * is bundled into every module's ShrotiLicensing client under the same kid.
 */
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [kid, dir] = process.argv.slice(2);
if (!kid || !dir || !/^[a-z0-9-]{3,40}$/.test(kid)) {
  console.error("usage: node scripts/keygen.mjs <kid> <out-dir>   (kid: lowercase, e.g. shl-2026-09)");
  process.exit(1);
}
const file = join(dir, `${kid}.pkcs8.b64`);
if (existsSync(file)) {
  console.error(`${file} already exists; refusing to overwrite a signing key.`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true, mode: 0o700 });
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
writeFileSync(file, privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"), { mode: 0o600 });
const x = publicKey.export({ format: "jwk" }).x;
writeFileSync(join(dir, `${kid}.public.txt`), `${kid} ${x}\n`, { mode: 0o644 });
console.log(JSON.stringify({ kid, public_key_b64url: x, private_key_file: file }, null, 2));
