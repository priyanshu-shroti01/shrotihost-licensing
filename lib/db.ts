/**
 * The whole data layer is parameterised SQL through one function.
 *
 * Production runs it on `postgres` (Neon, via a transaction pooler — hence
 * prepare:false). Tests run the *same SQL* on PGlite, an in-process Postgres,
 * so a query that is wrong for Postgres fails in `npm test` rather than in
 * production. There is deliberately no in-memory imitation of the database:
 * an imitation passes the tests it was written to pass.
 */
export type Row = Record<string, any>;
export type Query = (text: string, params?: unknown[]) => Promise<Row[]>;
export interface Db {
  query: Query;
  transaction<T>(fn: (q: Query) => Promise<T>): Promise<T>;
}

const KEY = Symbol.for("shrotihost-licensing.db");
type Holder = { db?: Db };
const holder = ((globalThis as any)[KEY] ??= {}) as Holder;

export function connectionString(): string | undefined {
  return process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DATABASE_POSTGRES_URL;
}

/** Tests install a PGlite-backed Db here. */
export function setDb(db: Db | undefined): void {
  holder.db = db;
}

export async function getDb(): Promise<Db> {
  if (holder.db) return holder.db;
  const url = connectionString();
  if (!url) throw Object.assign(new Error("DATABASE_URL is not set"), { code: "NO_DATABASE" });
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, { ssl: "require", max: 4, prepare: false, idle_timeout: 20, connect_timeout: 10 });
  const run = (s: any): Query => async (text, params = []) => (await s.unsafe(text, params as any[])) as unknown as Row[];
  holder.db = {
    query: run(sql),
    transaction: <T>(fn: (q: Query) => Promise<T>) => sql.begin((tx: any) => fn(run(tx))) as Promise<T>,
  };
  return holder.db;
}

export async function q(text: string, params: unknown[] = []): Promise<Row[]> {
  return (await getDb()).query(text, params);
}

export async function one(text: string, params: unknown[] = []): Promise<Row | null> {
  return (await q(text, params))[0] ?? null;
}

export async function tx<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  return (await getDb()).transaction(fn);
}

/** bytea arrives as a Buffer from `postgres` and a Uint8Array from PGlite. */
export function toBuffer(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  throw new TypeError("expected binary column");
}
