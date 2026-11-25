// Copies every Remy account from one database to another, then checks the counts match.
//   Into the database in DATABASE_URL (or a local PGlite folder in OR_DB_PATH), from:
//     npx tsx script/copy-database.ts --from sqlite:/data/data.db        (the old live-site file)
//     npx tsx script/copy-database.ts --from postgres://user:pass@host/db (moving between Postgres hosts)
// The target's tables are created by server/migrations first. Rows that already exist are left as they are,
// so running it twice is safe. Between Postgres hosts every table in DB_SCHEMA is copied (parents before
// children), the id counters are moved past the copied ids, and each table's row count is checked.
import Database from "better-sqlite3";
import pg from "pg";
import { closeDb, q, schema, sslFor } from "../server/platform/sql";

const from = process.argv[process.argv.indexOf("--from") + 1];
if (!from || from === process.argv[1]) {
  console.error("Usage: npx tsx script/copy-database.ts --from sqlite:<file> | --from postgres://…");
  process.exit(1);
}

type Row = Record<string, any>;
// ai_usage isn't copied: it's a rolling 24-hour counter that refills by itself.
const TABLES = ["users", "sessions", "workspaces", "files", "google_calendar"] as const;

async function readSource(): Promise<Record<(typeof TABLES)[number], Row[]>> {
  if (from.startsWith("sqlite:")) {
    const db = new Database(from.slice(7), { readonly: true, fileMustExist: true });
    const all = (t: string) => db.prepare(`SELECT * FROM ${t}`).all() as Row[];
    const out = {
      users: all("users").map((u) => ({ ...u, created_at: new Date(u.created_at) })),
      sessions: all("sessions").map((s) => ({ ...s, expires_at: new Date(Number(s.expires_at)) })),
      workspaces: all("workspaces").map((w) => ({ ...w, updated_at: new Date(w.updated_at) })),
      files: all("files").map((f) => ({ ...f, at: new Date(f.at) })),
      google_calendar: [] as Row[], // the old SQLite site never had calendar connections
    };
    db.close();
    return out;
  }
  throw new Error("only sqlite: sources come here; Postgres sources use copyPostgres()");
}

const INSERT: Record<(typeof TABLES)[number], [string, (r: Row) => unknown[]]> = {
  users: ["INSERT INTO users (id, kind, email, name, picture, created_at, school_email, school_email_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING", (r) => [r.id, r.kind, r.email ?? "", r.name ?? "", r.picture ?? "", r.created_at, r.school_email ?? null, r.school_email_at ?? null]],
  sessions: ["INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", (r) => [r.token_hash, r.user_id, r.expires_at]],
  workspaces: ["INSERT INTO workspaces (user_id, data, updated_at) VALUES ($1,$2::jsonb,$3) ON CONFLICT DO NOTHING", (r) => [r.user_id, typeof r.data === "string" ? r.data : JSON.stringify(r.data), r.updated_at]],
  files: ["INSERT INTO files (user_id, kind, name, mime, data, at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING", (r) => [r.user_id, r.kind, r.name, r.mime, Buffer.from(r.data), r.at]],
  // Tokens are encrypted with GCAL_CLIENT_SECRET: the new host needs the same secret.
  google_calendar: ["INSERT INTO google_calendar (user_id, refresh, calendar_id, tz, connected_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", (r) => [r.user_id, r.refresh, r.calendar_id, r.tz, r.connected_at]],
};

/** Postgres to Postgres: every table in the schema, whatever migrations have added since this script was written. */
async function copyPostgres() {
  const src = new pg.Client({ connectionString: from, ssl: sslFor(from), options: `-c search_path=${schema}` });
  await src.connect();
  await q("SELECT 1"); // creates the target's tables (server/migrations)
  const names = (await src.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'", [schema])).rows.map((r) => String(r.t));
  const parents = new Map(names.map((t) => [t, new Set<string>()]));
  for (const r of (await src.query(`SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace WHERE c.contype = 'f' AND n.nspname = $1`, [schema])).rows) {
    const strip = (x: string) => x.replace(/^.*\./, "").replace(/"/g, "");
    if (strip(r.child) !== strip(r.parent)) parents.get(strip(r.child))?.add(strip(r.parent));
  }
  const order: string[] = [];
  const visit = (t: string) => { if (order.includes(t)) return; parents.set(t, parents.get(t) || new Set()); for (const p of parents.get(t)!) if (!order.includes(p)) visit(p); order.push(t); };
  names.forEach(visit);
  let ok = true;
  for (const t of order) {
    if (!/^[a-z0-9_]+$/.test(t)) throw new Error(`unexpected table name ${t}`);
    const rows = (await src.query(`SELECT row_to_json(x)::text AS j FROM ${t} x`)).rows.map((r) => r.j as string);
    // shortcut: 25 rows per insert keeps each statement under about 20 MB with 0.6 MB workspaces; raise it if tables get much bigger.
    for (let i = 0; i < rows.length; i += 25) {
      await q(`INSERT INTO ${t} SELECT * FROM json_populate_recordset(null::${t}, $1::json) ON CONFLICT DO NOTHING`, [`[${rows.slice(i, i + 25).join(",")}]`]);
    }
    for (const c of await q("SELECT column_name AS c FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_default LIKE 'nextval(%'", [schema, t])) {
      await q(`SELECT setval(pg_get_serial_sequence('${t}', '${c.c}'), GREATEST((SELECT MAX(${c.c}) FROM ${t}), 1))`);
    }
    const got = Number((await q(`SELECT COUNT(*)::int AS n FROM ${t}`))[0].n);
    const fine = got >= rows.length;
    ok &&= fine;
    console.log(`  ${fine ? "✓" : "✗"} ${t}: ${rows.length} in source, ${got} in target`);
  }
  await src.end();
  await closeDb();
  process.exit(ok ? 0 : 1);
}
if (!from.startsWith("sqlite:")) await copyPostgres();

const source = await readSource();
// Rows that point at a missing user (left over from old deletes) can't be copied into tables with foreign keys.
const users = new Set(source.users.map((u) => u.id));
let skipped = 0;
for (const t of TABLES) {
  for (const r of source[t]) {
    if (t !== "users" && !users.has(r.user_id)) { skipped++; continue; }
    const [sql, values] = INSERT[t];
    await q(sql, values(r));
  }
}
console.log(`copied from ${from.startsWith("sqlite:") ? from : from.replace(/\/\/[^@]*@/, "//***@")}`);
let ok = true;
for (const t of TABLES) {
  const want = t === "users" ? source[t].length : source[t].filter((r) => users.has(r.user_id)).length;
  const got = Number((await q(`SELECT COUNT(*)::int AS n FROM ${t}`))[0].n);
  const fine = got >= want;
  ok &&= fine;
  console.log(`  ${fine ? "✓" : "✗"} ${t}: ${want} in source, ${got} in target`);
}
if (skipped) console.log(`  (${skipped} rows skipped: they belonged to users that no longer exist)`);
await closeDb();
process.exit(ok ? 0 : 1);
