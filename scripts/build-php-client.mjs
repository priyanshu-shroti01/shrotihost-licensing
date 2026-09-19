#!/usr/bin/env node
/**
 * Emit a module's copy of the PHP client.
 *
 *   node scripts/build-php-client.mjs <Namespace\\Path> <out-file> [--keys kid=x,kid=x]
 *
 * Each module gets its own namespace so two modules carrying different client
 * versions never share a class. --keys replaces the bundled public keys (tests).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [ns, out, flag, keys] = process.argv.slice(2);
if (!ns || !out || !/^[A-Za-z_][A-Za-z0-9_]*(\\[A-Za-z_][A-Za-z0-9_]*)*$/.test(ns)) {
  console.error("usage: build-php-client.mjs <Namespace\\\\Path> <out-file> [--keys kid=x,...]");
  process.exit(1);
}
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let src = readFileSync(join(root, "php/ShrotiLicensing.php"), "utf8").replace("namespace __NS__;", `namespace ${ns};`);
if (flag === "--keys" && keys) {
  const entries = keys.split(",").map((kv) => kv.split("=")).map(([k, v]) => `        '${k}' => '${v}',`).join("\n");
  src = src.replace(/const PUBLIC_KEYS = \[[\s\S]*?\];/, `const PUBLIC_KEYS = [\n${entries}\n    ];`);
}
writeFileSync(out, src);
console.log(`wrote ${out} (namespace ${ns})`);
