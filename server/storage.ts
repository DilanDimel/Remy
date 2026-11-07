// How much of the database's space Remy uses, so the team sees the free plan's limit coming instead of finding out
// when saves start failing. DB_SIZE_LIMIT_MB is the plan's database limit (default 500, Supabase's free plan in 2026).
import { q, q1, schema } from "./sql";
import { recordError } from "./admin";

export const limitMb = () => {
  const n = Number(process.env.DB_SIZE_LIMIT_MB);
  return Number.isFinite(n) && n > 0 ? n : 500;
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
  const limit = limitMb();
  return {
    usedMb: mb(db), limitMb: limit, percent: Math.round((mb(db) / limit) * 1000) / 10,
    tables: tables.map((t) => ({ name: String(t.name), mb: mb(Number(t.b)), rows: Math.max(0, Number(t.rows)) })),
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
