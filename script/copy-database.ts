// Copies every Remy account from one database to another, then checks the counts match.
//   Into the database in DATABASE_URL (or a local PGlite folder in OR_DB_PATH), from:
//     npx tsx script/copy-database.ts --from sqlite:/data/data.db        (the old live-site file)
//     npx tsx script/copy-database.ts --from postgres://user:pass@host/db (moving between Postgres hosts)
// The target's tables are created by server/migrations first. Rows that already exist are left as they are,
// so running it twice is safe.
import Database from "better-sqlite3";
import pg from "pg";
import { closeDb, q, sslFor } from "../server/sql";

const from = process.argv[process.argv.indexOf("--from") + 1];
if (!from || from === process.argv[1]) {
  console.error("Usage: npx tsx script/copy-database.ts --from sqlite:<file> | --from postgres://…");
  process.exit(1);
}

type Row = Record<string, any>;
// ai_usage isn't copied: it's a rolling 24-hour counter that refills by itself.
const TABLES = ["users", "sessions", "workspaces", "files"] as const;

async function readSource(): Promise<Record<(typeof TABLES)[number], Row[]>> {
  if (from.startsWith("sqlite:")) {
    const db = new Database(from.slice(7), { readonly: true, fileMustExist: true });
    const all = (t: string) => db.prepare(`SELECT * FROM ${t}`).all() as Row[];
    const out = {
      users: all("users").map((u) => ({ ...u, created_at: new Date(u.created_at) })),
      sessions: all("sessions").map((s) => ({ ...s, expires_at: new Date(Number(s.expires_at)) })),
      workspaces: all("workspaces").map((w) => ({ ...w, updated_at: new Date(w.updated_at) })),
      files: all("files").map((f) => ({ ...f, at: new Date(f.at) })),
    };
    db.close();
    return out;
  }
  const src = new pg.Client({ connectionString: from, ssl: sslFor(from) });
  await src.connect();
  const out = {} as Record<(typeof TABLES)[number], Row[]>;
  for (const t of TABLES) out[t] = (await src.query(`SELECT * FROM ${t}`)).rows;
  await src.end();
  return out;
}

const INSERT: Record<(typeof TABLES)[number], [string, (r: Row) => unknown[]]> = {
  users: ["INSERT INTO users (id, kind, email, name, picture, created_at, school_email, school_email_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING", (r) => [r.id, r.kind, r.email ?? "", r.name ?? "", r.picture ?? "", r.created_at, r.school_email ?? null, r.school_email_at ?? null]],
  sessions: ["INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", (r) => [r.token_hash, r.user_id, r.expires_at]],
  workspaces: ["INSERT INTO workspaces (user_id, data, updated_at) VALUES ($1,$2::jsonb,$3) ON CONFLICT DO NOTHING", (r) => [r.user_id, typeof r.data === "string" ? r.data : JSON.stringify(r.data), r.updated_at]],
  files: ["INSERT INTO files (user_id, kind, name, mime, data, at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING", (r) => [r.user_id, r.kind, r.name, r.mime, Buffer.from(r.data), r.at]],
};

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
