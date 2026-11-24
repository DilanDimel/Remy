// The one place Remy talks to its database. Plain PostgreSQL with $1-style parameters.
// DATABASE_URL set → that Postgres (Supabase today; any Postgres host works).
// Not set → PGlite, real Postgres running inside Node: a folder at OR_DB_PATH, or memory for tests.
import fs from "node:fs";
import path from "node:path";

type Rows = Record<string, any>[];
type Client = { query: (text: string, params?: unknown[]) => Promise<{ rows: Rows }>; exec?: (text: string) => Promise<unknown>; end?: () => Promise<unknown>; close?: () => Promise<unknown> };

let client: Client | null = null;
/** Remy's tables live in their own schema (not "public"), so a host's automatic data API — Supabase
 *  exposes "public" to the browser — can never serve them. One schema per environment: remy, remy_preview… */
export const schema = (process.env.DB_SCHEMA || "remy").replace(/[^a-z0-9_]/gi, "");
let ready: Promise<void> | null = null;
export let dbKind = "";

// Bytes read from the database since the last call (0 on PGlite, which runs inside Node and moves nothing over a network).
const sockets = new Map<{ bytesRead?: number }, number>();
let pending = 0;
export function takeDbBytes() {
  let n = pending;
  pending = 0;
  for (const [s, last] of sockets) { const now = s.bytesRead || 0; n += Math.max(0, now - last); sockets.set(s, now); }
  return n;
}

async function connect(): Promise<Client> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    // Idle connections stay open 5 minutes (pg's default is 10 seconds): every reconnect through Supabase's pooler costs a
    // TLS handshake and session setup, which adds to the data transfer Supabase bills.
    const pool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX) || 5, idleTimeoutMillis: 5 * 60_000, ssl: sslFor(url), options: `-c search_path=${schema}` });
    // An idle connection the pooler closes must not crash the server; the pool opens a new one when needed.
    pool.on("error", (e: Error) => console.error("database: idle connection closed:", e.message));
    // Count the bytes each connection receives from the database: that's what Supabase bills as data transfer.
    // The raw socket under TLS (_parent), so handshakes and TLS overhead are counted too.
    const raw = (c: any) => c?.connection?.stream?._parent || c?.connection?.stream;
    pool.on("connect", (c: any) => { const s = raw(c); if (s) sockets.set(s, 0); });
    pool.on("remove", (c: any) => { const s = raw(c); if (s) { pending += Math.max(0, (s.bytesRead || 0) - (sockets.get(s) || 0)); sockets.delete(s); } });
    dbKind = `postgres (schema ${schema})`;
    return pool;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  let dir = process.env.OR_DB_PATH;
  // An old SQLite file at that path (the live site's /data/data.db) is left alone: PGlite gets its own folder.
  if (dir && fs.existsSync(dir) && fs.statSync(dir).isFile()) dir += "-pg";
  if (process.env.NODE_ENV === "production") console.warn("DATABASE_URL is not set: using a local PGlite database. Set DATABASE_URL to the Supabase Postgres connection string.");
  dbKind = dir ? `pglite:${dir}` : "pglite:memory";
  return dir ? new PGlite(dir) : new PGlite();
}

/** TLS for remote databases, with the server certificate checked. DB_SSL_CA_FILE / DB_SSL_CA give the provider's
 *  CA certificate when it isn't publicly trusted, e.g. Supabase's. DB_SSL_INSECURE=1 skips the
 *  check and is logged, for emergencies only. */
export function sslFor(url: string) {
  if (/@(localhost|127\.0\.0\.1)(:|\/)/.test(url)) return undefined;
  if (process.env.DB_SSL_INSECURE === "1") {
    console.warn("DB_SSL_INSECURE=1: the database certificate is NOT being checked.");
    return { rejectUnauthorized: false };
  }
  // DB_SSL_CA_FILE: a path to the CA file, e.g. server/certs/supabase-prod-ca-2021.crt (Supabase's public root, checked Oct 2026).
  const file = process.env.DB_SSL_CA_FILE;
  const ca = file ? fs.readFileSync(path.isAbsolute(file) ? file : path.resolve(process.cwd(), file), "utf8") : process.env.DB_SSL_CA?.replace(/\\n/g, "\n");
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true };
}

/** Applies server/migrations/*.sql in order, once each, recorded in schema_migrations. */
async function migrate(c: Client) {
  // Create the schema only if it's missing: a least-privilege login may own its schema but not be allowed to create schemas.
  if (!(await c.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [schema])).rows.length) await c.query(`CREATE SCHEMA ${schema}`);
  await c.query(`SET search_path TO ${schema}`); // PGlite has one connection; pg connections get it from "options"
  await c.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const done = new Set((await c.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const dir = [path.resolve(process.cwd(), "server", "migrations"), path.resolve(__dirnameSafe(), "migrations")].find((d) => fs.existsSync(d));
  if (!dir) throw new Error("server/migrations folder not found");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    // Statements are run one by one so this works the same on pg and PGlite.
    for (const stmt of sql.split(/;\s*(?:\n|$)/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) await c.query(stmt);
    await c.query("INSERT INTO schema_migrations (name) VALUES ($1)", [f]);
  }
}
function __dirnameSafe() {
  try { return __dirname; } catch { return process.cwd(); }
}

export function dbReady(): Promise<void> {
  ready ||= (async () => {
    client = await connect();
    await migrate(client);
  })();
  return ready;
}

export async function q(text: string, params: unknown[] = []): Promise<Rows> {
  await dbReady();
  return (await client!.query(text, params)).rows;
}
export async function q1(text: string, params: unknown[] = []): Promise<Record<string, any> | undefined> {
  return (await q(text, params))[0];
}
/** Runs fn inside one transaction (all or nothing). */
export async function tx<T>(fn: (run: typeof q) => Promise<T>): Promise<T> {
  await dbReady();
  const c: any = client;
  if (c.connect) {
    const conn = await c.connect();
    const run = async (t: string, p: unknown[] = []) => (await conn.query(t, p)).rows;
    try { await conn.query("BEGIN"); const r = await fn(run); await conn.query("COMMIT"); return r; }
    catch (e) { await conn.query("ROLLBACK"); throw e; }
    finally { conn.release(); }
  }
  return c.transaction(async (t: any) => fn(async (text: string, p: unknown[] = []) => (await t.query(text, p)).rows));
}
export async function closeDb() {
  if (!client) return;
  await (client.end?.() ?? client.close?.());
  client = null; ready = null;
}
