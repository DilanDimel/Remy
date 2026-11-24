// Nightly backups of Remy's database, because the Supabase free plan keeps none. Each night copies only the student
// accounts and files changed since the last backup, plus the small tables whole; once a week (or when there's no full
// copy yet) it copies everything. Caches that rebuild themselves (board_cache, checked_openings), short-lived codes,
// sessions, rate limits and the one-day AI counter are left out. A full copy is about 25 MB and a night's changes far less, so backups add
// roughly 0.2 GB a month of Supabase data transfer.
// Each copy is gzipped and sealed with AES-256-GCM (WS_CACHE_KEY) in the private R2 bucket (server/platform/r2.ts):
// backup/full/YYYY-MM-DD and backup/daily/YYYY-MM-DD. 8 full and 31 daily copies are kept. Restore with
// `npm run restore-backup` (script/restore-backup.ts).
import { q, q1, schema } from "./sql";
import { r2Store } from "./r2";
import { deleteAccount, idHash } from "./db";

export type Store = { put: (name: string, value: unknown) => Promise<void>; get: (name: string) => Promise<any>; del: (name: string) => Promise<void> };
export type Backup = { kind: "full" | "daily"; at: string; since: string | null; tables: Record<string, unknown[]> };

/** Copied only when changed since the last backup (timestamp column), in daily copies. */
export const CHANGED_ONLY: Record<string, string> = { workspaces: "updated_at", files: "at" };
/** Never copied: rebuildable caches, secrets that expire, counters. */
// student_jobs and its state are a checked duplicate of workspaces.data.jobs while that move is under way
// (server/platform/studentJobs.ts), so they're rebuilt from the restored workspaces instead of copied.
export const SKIP = new Set(["ai_usage", "board_cache", "checked_openings", "rate_limits", "sessions", "signin_codes", "school_email_codes", "schema_migrations", "student_jobs", "student_jobs_state"]);
const FULL_EVERY_DAYS = 7, KEEP_FULL = 8, KEEP_DAILY = 31;
/** How far past the cut-off each run looks for old copies to delete (covers a sweep missing this many days). */
const PRUNE_DAYS = 45;
const centralDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const daysBack = (day: string, n: number) => new Date(Date.parse(day + "T12:00:00Z") - n * 86_400_000).toISOString().slice(0, 10);

async function setting(key: string) { return String((await q1("SELECT value FROM site_settings WHERE key = $1", [key]))?.value || ""); }
async function setSetting(key: string, value: string) {
  await q(`INSERT INTO site_settings (key, value, updated_by) VALUES ($1, $2, 'backup')
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [key, value]);
}

/** Remy's tables in the schema, minus the skipped ones. */
async function tables(): Promise<string[]> {
  const rows = await q("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY 1", [schema]);
  return rows.map((r) => String(r.t)).filter((t) => /^[a-z0-9_]+$/.test(t) && !SKIP.has(t));
}

/** One copy: every row of each table as JSON (bytea becomes "\\x…" hex), or only rows changed after `since`. */
export async function takeBackup(kind: "full" | "daily", since: string | null, now = new Date()): Promise<Backup> {
  const out: Backup = { kind, at: now.toISOString(), since, tables: {} };
  for (const t of await tables()) {
    const col = kind === "daily" && since ? CHANGED_ONLY[t] : undefined;
    const rows = col
      ? await q(`SELECT to_jsonb(x) AS r FROM "${schema}"."${t}" x WHERE "${col}" > $1`, [since])
      : await q(`SELECT to_jsonb(x) AS r FROM "${schema}"."${t}" x`);
    out.tables[t] = rows.map((r) => (typeof r.r === "string" ? JSON.parse(r.r) : r.r));
  }
  return out;
}

/** Run by the sweep: at most once per Central day. Returns what it did, or null when it wasn't due or R2 isn't set up. */
export async function backupIfDue(store: Store | null = r2Store(), now = new Date()): Promise<{ kind: string; rows: number } | null> {
  if (!store) return null;
  if ((await setting("backup_last_day")) === centralDay(now)) return null;
  const lastFull = await setting("backup_last_full");
  const since = await setting("backup_last_at");
  const kind = !lastFull || !since || lastFull <= daysBack(centralDay(now), FULL_EVERY_DAYS) ? "full" : "daily";
  return runBackup(store, kind, kind === "daily" ? since : null, now);
}

/** A full copy right now, whatever was done today: taken before a risky data change (the student_jobs copy). */
export async function backupNow(store: Store | null = r2Store(), now = new Date()) {
  if (!store) return null;
  return runBackup(store, "full", null, now);
}

async function runBackup(store: Store, kind: "full" | "daily", since: string | null, now: Date) {
  const today = centralDay(now);
  // The database's own clock, so changes are caught even if this server's clock drifts.
  const started = String((await q1("SELECT now()::text AS t"))!.t);
  const b = await takeBackup(kind, since, now);
  await store.put(`backup/${kind}/${today}`, b);
  // Recorded only after the upload, so a failed night is simply tried again on the next sweep.
  await setSetting("backup_last_day", today);
  await setSetting("backup_last_at", started);
  if (kind === "full") await setSetting("backup_last_full", today);
  // Everything past the cut-off, not just the copy exactly that old: nights without a sweep (an outage) would
  // otherwise leave their copy in R2 for good. Deleting a copy that isn't there is harmless.
  for (let i = 0; i < PRUNE_DAYS; i++) {
    await store.del(`backup/daily/${daysBack(today, KEEP_DAILY + i)}`).catch(() => {});
    await store.del(`backup/full/${daysBack(today, KEEP_FULL * FULL_EVERY_DAYS + i)}`).catch(() => {});
  }
  return { kind, rows: Object.values(b.tables).reduce((n, r) => n + r.length, 0) };
}

/** For the owners' Storage page: when the last backup and the last full copy ran. */
export async function backupStatus() {
  return { lastAt: (await setting("backup_last_at")) || null, lastFull: (await setting("backup_last_full")) || null };
}

/** The copies to restore, oldest first: the newest full copy on or before `day`, then each daily copy after it. */
export async function restoreChain(store: Store, day: string, lookback = 60): Promise<Backup[]> {
  let full: Backup | null = null, fullDay = "";
  for (let i = 0; i <= lookback && !full; i++) { fullDay = daysBack(day, i); full = await store.get(`backup/full/${fullDay}`); }
  if (!full) throw new Error(`No full backup in the ${lookback} days up to ${day}.`);
  const chain = [full];
  for (let d = daysBack(fullDay, -1); d <= day; d = daysBack(d, -1)) { const b = await store.get(`backup/daily/${d}`); if (b) chain.push(b); }
  return chain;
}

/** Tables others point at come first when inserting, last when deleting. */
const PARENTS = ["users", "team_events"];
const ordered = (names: string[]) => [...PARENTS.filter((t) => names.includes(t)), ...names.filter((t) => !PARENTS.includes(t))];

async function keyOf(run: typeof q, t: string) {
  const cols = (await run(
    `SELECT a.attname AS c FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
     WHERE i.indrelid = $1::regclass AND i.indisprimary`, [`"${schema}"."${t}"`],
  )).map((r) => String(r.c));
  const all = (await run("SELECT column_name AS c FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2", [schema, t])).map((r) => String(r.c));
  return { key: cols, rest: all.filter((c) => !cols.includes(c)) };
}

/** Loads a chain's copies into the database, in order, after migrations have run (ideally into an empty schema).
 *  A full copy replaces every table it holds; a daily copy updates or adds its rows by primary key. Rows deleted
 *  during a day aren't removed by the daily copy. Counters (bigserial ids) are moved past the restored rows. */
export async function applyBackup(run: typeof q, b: Backup) {
  const present = new Set((await run("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = $1", [schema])).map((r) => String(r.t)));
  const names = ordered(Object.keys(b.tables).filter((t) => /^[a-z0-9_]+$/.test(t) && present.has(t)));
  if (b.kind === "full") for (const t of [...names].reverse()) await run(`DELETE FROM "${schema}"."${t}"`);
  for (const t of names) {
    const rows = b.tables[t];
    if (!rows.length) continue;
    const { key, rest } = await keyOf(run, t);
    const onConflict = !key.length ? "" : rest.length
      ? `ON CONFLICT (${key.map((c) => `"${c}"`).join(", ")}) DO UPDATE SET ${rest.map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ")}`
      : `ON CONFLICT (${key.map((c) => `"${c}"`).join(", ")}) DO NOTHING`;
    for (let i = 0; i < rows.length; i += 200)
      await run(`INSERT INTO "${schema}"."${t}" SELECT * FROM jsonb_populate_recordset(NULL::"${schema}"."${t}", $1::jsonb) ${onConflict}`, [JSON.stringify(rows.slice(i, i + 200))]);
    for (const r of await run("SELECT column_name AS c FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_default LIKE 'nextval%'", [schema, t]))
      await run(`SELECT setval(pg_get_serial_sequence('"${schema}"."${t}"', $1), GREATEST(1, (SELECT COALESCE(MAX("${r.c}"), 0) FROM "${schema}"."${t}")))`, [String(r.c)]);
  }
  // Restored workspaces may hold other openings than the student_jobs copy: mark every account to be copied again.
  if (present.has("student_jobs_state")) await run(`DELETE FROM "${schema}"."student_jobs_state"`);
}

/** After a restore: accounts deleted since a copy was taken (in the restored deleted_accounts, or in `extra`, the
 *  target database's own list read before the restore) are deleted again, so "Delete everything" survives a restore.
 *  Returns how many were deleted. */
export async function deleteAgain(extra: string[] = []): Promise<number> {
  for (const h of extra) await q("INSERT INTO deleted_accounts (id_hash) VALUES ($1) ON CONFLICT DO NOTHING", [h]);
  const gone = new Set((await q("SELECT id_hash FROM deleted_accounts")).map((r) => String(r.id_hash)));
  let n = 0;
  for (const { id } of await q("SELECT id FROM users")) if (gone.has(idHash(String(id)))) { await deleteAccount(String(id)); n++; }
  return n;
}
