#!/usr/bin/env node
/**
 * Mirror db/schema.sql into lib/schema.ts.
 *
 * The SQL is the file people edit; the TypeScript copy is what ships, because
 * serverless bundles do not reliably include arbitrary files and a migration
 * endpoint that cannot find its own schema is worse than none. Deriving the
 * copy stops the two drifting -- the test that catches drift had to be
 * satisfied by hand on every schema change.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(root, "db/schema.sql"), "utf8");
const target = join(root, "lib/schema.ts");
const escaped = sql.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

const src = readFileSync(target, "utf8");
// A function replacement, not a string: the SQL contains $ sequences that
// String.replace would otherwise interpret as capture-group references.
let found = false;
const next = src.replace(/(export const SCHEMA_SQL = `)[\s\S]*?(`;)/, (_m, open, close) => {
  found = true;
  return open + escaped + close;
});
if (!found) throw new Error("SCHEMA_SQL template not found in lib/schema.ts");
writeFileSync(target, next);
console.log("lib/schema.ts synced from db/schema.sql");
