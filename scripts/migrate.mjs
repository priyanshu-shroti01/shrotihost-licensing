#!/usr/bin/env node
/**
 * Apply db/schema.sql to DATABASE_URL.
 *
 * Exists so setting up a database does not require psql on the operator's
 * machine. The schema is idempotent (every statement is IF NOT EXISTS), so
 * running this twice is safe.
 *
 *   DATABASE_URL='postgresql://...' node scripts/migrate.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set.\n\n  DATABASE_URL='postgresql://...' node scripts/migrate.mjs\n");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const schema = await readFile(join(here, "..", "db", "schema.sql"), "utf8");

const sql = postgres(url, { ssl: "require", max: 1, prepare: false });

try {
  await sql.unsafe(schema);
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`;
  console.log("Schema applied. Tables now present:");
  for (const t of tables) console.log(`  - ${t.table_name}`);
} catch (e) {
  console.error("Migration failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}
