// How much of the database's space Remy uses, so the team sees the free plan's limit coming instead of finding out
// when saves start failing. DB_SIZE_LIMIT_MB is the plan's database limit (default 10240: the DigitalOcean database "remy-db" has 10 GiB of storage, Nov 2026).
import { q, q1, schema } from "./sql";
import { recordError } from "./admin";
import { r2Ready } from "./r2";

export const limitMb = () => {
  const n = Number(process.env.DB_SIZE_LIMIT_MB);
  return Number.isFinite(n) && n > 0 ? n : 10240;
};
const mb = (bytes: number) => Math.round((bytes / 1_048_576) * 10) / 10;

/** Whole-database size against the limit, and each of Remy's tables largest first (data, indexes and stored JSON). */
export async function storageReport() {
  const db = Number((await q1("SELECT pg_database_size(current_database()) AS b"))!.b);
  const tables = await q(
    `SELECT c.relname AS name, pg_total_relation_size(c.oid) AS b, c.reltuples::bigint AS rows
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = $1 AND c.relkind = 'r' ORDER BY pg_total_relation_size(c.oid) DESC`,
    [schema],
  );
  // Exact row counts: Postgres's own estimate (reltuples) is stale or missing (-1) until it re-analyzes a table, which
  // for small, new tables can take a long time. Counting is cheap at Remy's size (owners open this page now and then).
  const counted = await Promise.all(tables.map(async (t) => {
    const name = String(t.name);
    if (!/^[a-z0-9_]+$/i.test(name)) return Math.max(0, Number(t.rows));
    return Number((await q1(`SELECT COUNT(*)::bigint AS n FROM "${schema}"."${name}"`))?.n || 0);
  }));
  const limit = limitMb();
  return {
    usedMb: mb(db), limitMb: limit, percent: Math.round((mb(db) / limit) * 1000) / 10,
    tables: tables.map((t, i) => ({ name: String(t.name), mb: mb(Number(t.b)), rows: counted[i] })),
  };
}

/** Run by the sweep: past 80% of the limit, one warning a day on the owners' Errors page (and the server log). */
export async function warnIfNearLimit(): Promise<boolean> {
  const r = await storageReport();
  if (r.percent < 80) return false;
  const message = `Database is ${r.percent}% full (${r.usedMb} of ${r.limitMb} MB)`;
  console.warn(message);
  const already = await q1("SELECT 1 FROM error_reports WHERE place = 'storage' AND at > now() - interval '1 day'");
  if (!already) await recordError("server", "storage", message, `Largest tables: ${r.tables.slice(0, 4).map((t) => `${t.name} ${t.mb} MB`).join(", ")}`);
  return true;
}

/** Run by the sweep: backups that aren't set up on this server (no R2 keys) or haven't run for 36 hours get one warning
 *  a day on the owners' Errors page. A new server can lose the R2 settings silently, and backups would just stop. */
export async function warnIfBackupStale(): Promise<boolean> {
  let message = "";
  if (!r2Ready()) message = "Backups are not running: this server has no R2 settings (R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, WS_CACHE_KEY)";
  else {
    const r = await q1("SELECT EXTRACT(EPOCH FROM now() - value::timestamptz)::float AS s FROM site_settings WHERE key = 'backup_last_at'");
    // The sweep runs the backup just before this check, so no record at all means no backup has ever finished.
    if (!r) message = "No database backup has finished yet";
    else if (Number(r.s) > 36 * 3600) message = `The last database backup was ${Math.round(Number(r.s) / 3600)} hours ago`;
  }
  if (!message) return false;
  console.warn(message);
  const already = await q1("SELECT 1 FROM error_reports WHERE place = 'backup' AND at > now() - interval '1 day'");
  if (!already) await recordError("server", "backup", message, "Admin → System shows the last backup. Restore with npm run restore-backup.");
  return true;
}

/** What is pulling data out of the database, for finding Supabase data transfer the server's own counter misses
 *  (owners only). `connections`: every open connection, grouped by program and role, so a client that isn't this
 *  server (a preview, a laptop, a script) stands out; this server names itself "remy-server". `statements`: the
 *  queries that returned the most rows since the stats were last reset (Supabase keeps pg_stat_statements on). */
export async function trafficReport() {
  const connections = await q(
    `SELECT COALESCE(NULLIF(application_name, ''), '(none)') AS app, usename AS role, COALESCE(client_addr::text, 'local') AS addr,
            COUNT(*)::int AS n, MIN(backend_start)::text AS oldest
     FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()
     GROUP BY 1, 2, 3 ORDER BY n DESC LIMIT 50`,
  ).catch((e) => [{ error: String(e?.message || e) }]);
  let statements: Record<string, unknown>[] | null = null, since: string | null = null, note = "";
  for (const s of ["extensions", "public"]) {
    try {
      statements = (await q(
        `SELECT left(regexp_replace(query, '\\s+', ' ', 'g'), 240) AS query, calls::bigint AS calls, rows::bigint AS rows,
                round((rows::numeric / GREATEST(calls, 1)), 1) AS rows_per_call, round(total_exec_time::numeric) AS ms
         FROM ${s}.pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
         ORDER BY rows DESC LIMIT 25`,
      )).map((r) => ({ ...r, calls: Number(r.calls), rows: Number(r.rows), rows_per_call: Number(r.rows_per_call), ms: Number(r.ms) }));
      since = String((await q1(`SELECT stats_reset::text AS t FROM ${s}.pg_stat_statements_info`).catch(() => undefined))?.t || "") || null;
      break;
    } catch (e: any) { note = String(e?.message || e); }
  }
  return { connections, statements, statsSince: since, note: statements ? "" : `pg_stat_statements isn't readable here: ${note}` };
}

/** Run by the sweep: logs that otherwise grow forever. The owners' pages read only the newest 80 team activity rows
 *  and the last 7 days of usage counts, so 180 days of each is plenty. */
export async function pruneLogs() {
  await q("DELETE FROM team_activity WHERE at < now() - interval '180 days'");
  await q("DELETE FROM usage_events WHERE day < to_char(now() - interval '180 days', 'YYYY-MM-DD')");
}
