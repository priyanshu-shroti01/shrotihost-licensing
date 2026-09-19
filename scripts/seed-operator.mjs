#!/usr/bin/env node
/**
 * Create or reset a console operator.
 *   DATABASE_URL=… node scripts/seed-operator.mjs <email> <password> [name]
 * The account is flagged must_change_password; the console nags until it is.
 */
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";

const [email, password, name = ""] = process.argv.slice(2);
if (!email || !password) { console.error("usage: seed-operator.mjs <email> <password> [name]"); process.exit(1); }
const salt = randomBytes(16).toString("hex");
const hash = `scrypt$${salt}$${scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex")}`;
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, prepare: false });
const [row] = await sql`
  INSERT INTO operators (email, name, role, password_hash, must_change_password)
  VALUES (${email.trim().toLowerCase()}, ${name}, 'owner', ${hash}, true)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = true,
    session_version = operators.session_version + 1, updated_at = now()
  RETURNING id, email, role, must_change_password`;
console.log(`operator #${row.id} ${row.email} (${row.role}) · must change password: ${row.must_change_password}`);
await sql.end();
