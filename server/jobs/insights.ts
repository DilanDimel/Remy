// Owners' dashboard: the Founding Cohort funnel and student outcomes, counted inside the database (no workspace is
// loaded into the server, so this stays cheap at hundreds of students). Counts only; nothing a student wrote.
import { q, q1, takeDbBytes } from "../platform/sql";

const centralDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
/** Adds the bytes read from the database since last time to today's total (run every 5 minutes). */
export async function flushDbBytes(n = takeDbBytes()) {
  if (n > 0) await q("INSERT INTO usage_daily (day, db_bytes) VALUES ($1, $2) ON CONFLICT (day) DO UPDATE SET db_bytes = usage_daily.db_bytes + EXCLUDED.db_bytes", [centralDay(), n]);
}
/** This month's total and the last 14 days, in MB. */
export async function dataTransfer() {
  const month = centralDay().slice(0, 7);
  const days = await q("SELECT day, db_bytes FROM usage_daily ORDER BY day DESC LIMIT 14");
  const total = await q1("SELECT COALESCE(SUM(db_bytes), 0)::bigint AS b FROM usage_daily WHERE day LIKE $1", [month + "%"]);
  const mb = (b: unknown) => Math.round(Number(b) / 104857.6) / 10;
  return { monthMb: mb(total?.b), limitGb: Number(process.env.DB_EGRESS_LIMIT_GB) || 5, days: days.map((d) => ({ day: String(d.day), mb: mb(d.db_bytes) })).reverse() };
}
import { studentsOnly } from "../platform/admin";

const SENT = ["Applied", "Received", "Heard back", "Interview", "Offer", "Rejected", "No reply"];
const REPLIED = ["Heard back", "Interview", "Offer", "Rejected"];
const INTERVIEWED = ["Interview", "Offer"];
const inList = (xs: string[]) => xs.map((x) => `'${x.replace(/'/g, "''")}'`).join(",");
/** Was this tracker item ever in one of these statuses (now or in its history)? `t` is the item's jsonb. */
const ever = (set: string[]) => `(t->>'status' IN (${inList(set)}) OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t->'events') = 'array' THEN t->'events' ELSE '[]'::jsonb END) e WHERE e->>'status' IN (${inList(set)})))`;
const weekAgo = () => new Date(Date.now() - 7 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

/** Applied → accepted → signed in → finished setup → active this week, and who applied by school, year and source. */
export async function funnel() {
  const apps = await q1(
    `SELECT COUNT(*)::int AS applied, COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
            COUNT(*) FILTER (WHERE status = 'next')::int AS next, COUNT(*) FILTER (WHERE status = 'declined')::int AS declined,
            COUNT(*) FILTER (WHERE status = 'new')::int AS waiting,
            COUNT(*) FILTER (WHERE feedback ILIKE 'yes%')::int AS feedback
     FROM beta_applications`,
  );
  const people = await q1(
    `SELECT (SELECT COUNT(*)::int FROM beta_list) AS on_list,
            COUNT(*)::int AS signed_in,
            COUNT(*) FILTER (WHERE COALESCE(w.data->'onboarding'->>'done', 'false') = 'true')::int AS set_up,
            COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(w.data->'visits') = 'array' THEN w.data->'visits' ELSE '[]'::jsonb END) v WHERE v >= $1))::int AS active_week
     FROM users u JOIN workspaces w ON w.user_id = u.id
     WHERE u.kind IN ('google','supabase') AND lower(u.email) IN (SELECT email FROM beta_list)`,
    [weekAgo()],
  );
  const split = (col: string) => q(
    `SELECT COALESCE(NULLIF(trim(${col}), ''), '—') AS label, COUNT(*)::int AS applied, COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted
     FROM beta_applications GROUP BY 1 ORDER BY applied DESC, label LIMIT 10`,
  );
  const [bySchool, byYear, bySource, byStuck] = await Promise.all([split("school"), split("class_year"), split("source"), split("stuck")]);
  return { ...apps, ...people, bySchool, byYear, bySource, byStuck };
}

/** Across real students: applications sent, how many got an answer, interviews, offers; who uses More like this / Not for me. */
export async function outcomes() {
  const SIGNED_IN = await studentsOnly();
  const t = await q1(
    `WITH items AS (
       SELECT u.id AS uid, t FROM users u JOIN workspaces w ON w.user_id = u.id,
         jsonb_array_elements(CASE WHEN jsonb_typeof(w.data->'tracker') = 'array' THEN w.data->'tracker' ELSE '[]'::jsonb END) t
       WHERE ${SIGNED_IN})
     SELECT COUNT(*) FILTER (WHERE ${ever(SENT)})::int AS applied,
            COUNT(*) FILTER (WHERE ${ever(SENT)} AND ${ever(REPLIED)})::int AS answered,
            COUNT(*) FILTER (WHERE ${ever(SENT)} AND ${ever(INTERVIEWED)})::int AS interviews,
            COUNT(*) FILTER (WHERE ${ever(SENT)} AND ${ever(["Offer"])})::int AS offers,
            COUNT(*) FILTER (WHERE ${ever(SENT)} AND t->>'applicationId' IS NOT NULL)::int AS applied_tailored,
            COUNT(*) FILTER (WHERE ${ever(SENT)} AND t->>'applicationId' IS NOT NULL AND ${ever(REPLIED)})::int AS answered_tailored,
            COUNT(DISTINCT uid) FILTER (WHERE ${ever(SENT)})::int AS students_applying
     FROM items`,
  );
  const r = await q1(
    `SELECT COUNT(*) FILTER (WHERE jsonb_typeof(w.data->'jobFeedback') = 'object' AND w.data->'jobFeedback' <> '{}'::jsonb)::int AS students_rating,
            COALESCE(SUM(CASE WHEN jsonb_typeof(w.data->'jobFeedback') = 'object' THEN (SELECT COUNT(*) FROM jsonb_object_keys(w.data->'jobFeedback')) ELSE 0 END), 0)::int AS ratings,
            COUNT(*)::int AS students
     FROM users u JOIN workspaces w ON w.user_id = u.id WHERE ${SIGNED_IN}`,
  );
  return { ...t, ...r };
}

/** How big students' saved accounts are (each page load reads the whole one, so this drives speed and data transfer). */
export async function workspaceSizes() {
  return q1(
    `SELECT COUNT(*)::int AS n, COALESCE(round(avg(octet_length(data::text)) / 1024.0), 0)::int AS avg_kb,
            COALESCE(round(max(octet_length(data::text)) / 1024.0), 0)::int AS max_kb,
            COALESCE(round(percentile_cont(0.9) WITHIN GROUP (ORDER BY octet_length(data::text)) / 1024.0), 0)::int AS p90_kb
     FROM workspaces`,
  );
}
