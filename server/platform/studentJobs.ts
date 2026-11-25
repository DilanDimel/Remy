// Saved openings in their own table (Dilan said go, Nov 24, "carefully"). Step 1 of moving `jobs` out of the
// workspace blob (workspaces.data, up to 4 MB, mostly openings) into student_jobs, one row per opening.
//
// The switch is site_settings 'student_jobs', set by owners on Admin → System:
//   off    (default) nothing here runs; Remy works exactly as before.
//   copy   every save that changes openings also writes them here, in the same transaction and under the same row
//          lock as the workspace, and the hourly sweep copies 10 accounts at a time that aren't copied yet. Nothing
//          is read from here: workspaces.data.jobs stays the real copy.
//   owners as copy, and owners' openings are read from here, so the move is checked on real accounts first.
//   everyone (step 2, Dilan said go Nov 24 6:25 PM CT, a day after owners) everyone's copied openings are read from
//          here. Only reachable from owners, so the backup and the owners' check always come first. The workspace
//          still keeps its own copy until a later PR removes it after a few days with no problems.
// Turning it on from off first takes a fresh full backup (refused when backups aren't set up) and starts every
// copy from scratch. The hourly check compares each copied account with its workspace inside Postgres (only counts
// come back) and copies again any that differ. Removing jobs from the workspace is a later PR, once this is checked.
//
// Supabase transfer: writes are uploads (free); nothing large is returned (no RETURNING of rows); the sweep's copy
// reads workspaces through the server's cache like the other hourly jobs; owners' reads download their openings
// only when jobs_v changed.
import type { Job } from "@shared/types";
import { q, q1 } from "./sql";
import { backupNow, type Store } from "./backup";
import { r2Store } from "./r2";

export type JobsMode = "off" | "copy" | "owners" | "everyone";
export const JOBS_MODES: JobsMode[] = ["off", "copy", "owners", "everyone"];
const bad = (message: string) => Object.assign(new Error(message), { status: 400 });
const noNul = (_k: string, v: unknown) => (typeof v === "string" && v.includes("\u0000") ? v.replace(/\u0000/g, "") : v);
const asList = (jobs: unknown): Job[] => (Array.isArray(jobs) ? jobs.filter((j) => j && typeof j === "object" && typeof j.id === "string") : []);

let modeCache = { at: 0, mode: "off" as JobsMode };
export async function jobsMode(fresh = false): Promise<JobsMode> {
  if (!fresh && Date.now() - modeCache.at <= 30_000) return modeCache.mode;
  const v = String((await q1("SELECT value FROM site_settings WHERE key = 'student_jobs'"))?.value || "off") as JobsMode;
  modeCache = { at: Date.now(), mode: JOBS_MODES.includes(v) ? v : "off" };
  return modeCache.mode;
}

/** Owners flip the switch. From off, a fresh full backup comes first, and every account is copied again from scratch. */
export async function setJobsMode(mode: string, by: string, store: Store | null = r2Store()) {
  if (!JOBS_MODES.includes(mode as JobsMode)) throw bad("Say off, copy, owners or everyone.");
  const was = await jobsMode(true);
  if (mode === "everyone" && was !== "owners" && was !== "everyone") throw bad("Turn on Owners read it first, and check owners' openings for a day.");
  let backup: { kind: string; rows: number } | null = null;
  if (was === "off" && mode !== "off") {
    backup = await backupNow(store);
    if (!backup) throw bad("Backups aren't set up (R2), so the copy won't start without a fresh backup.");
    await q("DELETE FROM student_jobs_state");
  }
  await q(`INSERT INTO site_settings (key, value, updated_by) VALUES ('student_jobs', $1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [mode, by]);
  modeCache = { at: Date.now(), mode: mode as JobsMode };
  return { mode: mode as JobsMode, backup };
}

const dupIds = (jobs: Job[]) => new Set(jobs.map((j) => j.id)).size !== jobs.length;

/** Replaces one account's copy with `jobs` and marks it copied. Run inside a transaction holding the workspace row. */
export type Written = { v: number; jobs: Job[] } | undefined;
const written = (v: unknown, jobs: Job[]): Written => (v == null ? undefined : { v: Number(v), jobs });
export async function copyAll(run: typeof q, userId: string, raw: unknown): Promise<Written> {
  const jobs = asList(raw);
  if (dupIds(jobs)) {
    await run("DELETE FROM student_jobs WHERE user_id=$1", [userId]);
    await run(`INSERT INTO student_jobs_state (user_id, note) VALUES ($1, 'duplicate ids')
               ON CONFLICT (user_id) DO UPDATE SET note = 'duplicate ids', copied_at = now(), jobs_v = student_jobs_state.jobs_v + 1`, [userId]);
    return;
  }
  await run(
    `WITH incoming AS (SELECT e.j->>'id' AS job_id, (e.i - 1)::int AS pos, e.j AS data FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY e(j, i)),
     gone AS (DELETE FROM student_jobs s WHERE s.user_id = $1 AND NOT EXISTS (SELECT 1 FROM incoming i WHERE i.job_id = s.job_id))
     INSERT INTO student_jobs (user_id, job_id, pos, data, updated_at) SELECT $1, job_id, pos, data, now() FROM incoming
     ON CONFLICT (user_id, job_id) DO UPDATE SET pos = EXCLUDED.pos, data = EXCLUDED.data, updated_at = now()
     WHERE student_jobs.pos IS DISTINCT FROM EXCLUDED.pos OR student_jobs.data IS DISTINCT FROM EXCLUDED.data`,
    [userId, JSON.stringify(jobs, noNul)],
  );
  const v = await run(`INSERT INTO student_jobs_state (user_id) VALUES ($1)
             ON CONFLICT (user_id) DO UPDATE SET note = '', copied_at = now(), jobs_v = student_jobs_state.jobs_v + 1 RETURNING jobs_v`, [userId]);
  return written(v[0]?.jobs_v, jobs);
}

/** Called by every workspace write that changes openings, in its transaction after the workspace row is written.
 *  `before` is the list this write started from when the server knows it exactly (then only changed rows are sent),
 *  or null (then the whole list is). Accounts not copied yet are left to the hourly copy. */
export async function syncJobs(run: typeof q, userId: string, before: unknown, after: unknown): Promise<Written> {
  if ((await jobsMode()) === "off") return;
  const s = (await run("SELECT note FROM student_jobs_state WHERE user_id=$1 FOR UPDATE", [userId]))[0];
  if (!s) return;
  const next = asList(after);
  if (s.note || before == null || dupIds(next)) return copyAll(run, userId, next);
  const old = new Map(asList(before).map((j, i) => [j.id, { pos: i, s: JSON.stringify(j, noNul) }]));
  const ids = new Set(next.map((j) => j.id));
  const changed = next.map((data, pos) => ({ job_id: data.id, pos, data })).filter((x) => {
    const o = old.get(x.job_id);
    return !o || o.pos !== x.pos || o.s !== JSON.stringify(x.data, noNul);
  });
  const removed = [...old.keys()].filter((id) => !ids.has(id));
  if (!changed.length && !removed.length) return;
  if (removed.length) await run("DELETE FROM student_jobs WHERE user_id=$1 AND job_id IN (SELECT jsonb_array_elements_text($2::jsonb))", [userId, JSON.stringify(removed)]);
  if (changed.length)
    await run(
      `INSERT INTO student_jobs (user_id, job_id, pos, data, updated_at)
       SELECT $1, x.job_id, x.pos, x.data, now() FROM jsonb_to_recordset($2::jsonb) AS x(job_id text, pos int, data jsonb)
       ON CONFLICT (user_id, job_id) DO UPDATE SET pos = EXCLUDED.pos, data = EXCLUDED.data, updated_at = now()`,
      [userId, JSON.stringify(changed, noNul)],
    );
  const v = await run("UPDATE student_jobs_state SET jobs_v = jobs_v + 1 WHERE user_id=$1 RETURNING jobs_v", [userId]);
  return written(v[0]?.jobs_v, next);
}

/** A whole-workspace write the server can't diff: the account is copied again by the hourly copy. */
export async function forgetCopy(userId: string) {
  if ((await jobsMode()) === "off") return;
  await q("DELETE FROM student_jobs_state WHERE user_id=$1", [userId]);
}
export async function deleteCopy(userId: string) {
  await q("DELETE FROM student_jobs WHERE user_id=$1", [userId]);
  await q("DELETE FROM student_jobs_state WHERE user_id=$1", [userId]);
  tableCache.delete(userId);
}

let owners = { at: 0, ids: new Set<string>() };
async function ownerIds() {
  if (Date.now() - owners.at <= 60_000) return owners.ids;
  const env = (process.env.OWNER_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
  const rows = await q(
    `SELECT id FROM users WHERE kind IN ('google', 'supabase') AND email <> ''
       AND (lower(email) IN (SELECT jsonb_array_elements_text($1::jsonb)) OR lower(email) IN (SELECT lower(email) FROM team_members))`,
    [JSON.stringify(env)],
  );
  owners = { at: Date.now(), ids: new Set(rows.map((r) => String(r.id))) };
  return owners.ids;
}

const tableCache = new Map<string, { v: number; jobs: Job[] }>();
const TABLE_CACHE_MAX = 200;
function remember(userId: string, v: number, jobs: Job[]) {
  tableCache.delete(userId);
  tableCache.set(userId, { v, jobs });
  if (tableCache.size > TABLE_CACHE_MAX) tableCache.delete(tableCache.keys().next().value!);
}
/** Called after a save's transaction committed, with what syncJobs/copyAll wrote: this server keeps those openings,
 *  so the next read doesn't download them again (only the tiny jobs_v number crosses the network). Never before the
 *  commit: a rolled-back save must not leave a copy that a later jobs_v could match. */
export function primeJobs(userId: string, w: Written) {
  if (w) remember(userId, w.v, structuredClone(w.jobs));
}
/** Openings from the table when the switch says this account reads it ('owners': owners only; 'everyone': all) and
 *  its copy is good; otherwise null (use the workspace). */
export async function jobsFromTable(userId: string): Promise<Job[] | null> {
  const mode = await jobsMode();
  if (mode !== "everyone" && (mode !== "owners" || !(await ownerIds()).has(userId))) return null;
  const s = await q1("SELECT jobs_v, note FROM student_jobs_state WHERE user_id=$1", [userId]);
  if (!s || s.note) return null;
  const v = Number(s.jobs_v), c = tableCache.get(userId);
  if (c && c.v === v) return structuredClone(c.jobs);
  const jobs = (await q("SELECT data FROM student_jobs WHERE user_id=$1 ORDER BY pos", [userId])).map((r) => (typeof r.data === "string" ? JSON.parse(r.data) : r.data)) as Job[];
  remember(userId, v, jobs);
  return structuredClone(jobs);
}

/** Compares every copied account with its workspace, inside Postgres (only counts come back). With `fix`, accounts
 *  that differ are marked to be copied again. Shown to owners on Admin → System. */
export async function jobsReport(fix = false) {
  const mode = await jobsMode(true);
  const arr = `CASE WHEN jsonb_typeof(w.data->'jobs') = 'array' THEN w.data->'jobs' ELSE '[]'::jsonb END`;
  const rows = await q(
    `SELECT s.user_id AS id, s.note,
       jsonb_array_length(${arr})::int AS ws_jobs,
       (SELECT count(*) FROM student_jobs sj WHERE sj.user_id = s.user_id)::int AS table_jobs,
       (SELECT count(*) FROM jsonb_array_elements(${arr}) WITH ORDINALITY e(j, i)
          WHERE NOT EXISTS (SELECT 1 FROM student_jobs sj WHERE sj.user_id = s.user_id AND sj.job_id = e.j->>'id' AND sj.pos = e.i - 1 AND sj.data = e.j))::int AS differ
     FROM student_jobs_state s JOIN workspaces w ON w.user_id = s.user_id`,
  );
  const accounts = Number((await q1("SELECT count(*)::int AS n FROM workspaces"))?.n || 0);
  const ok = rows.filter((r) => !r.note);
  const wrong = ok.filter((r) => r.differ > 0 || r.ws_jobs !== r.table_jobs).map((r) => String(r.id));
  if (fix && wrong.length) await q("DELETE FROM student_jobs_state WHERE user_id IN (SELECT jsonb_array_elements_text($1::jsonb))", [JSON.stringify(wrong)]);
  return {
    mode,
    accounts,
    copied: ok.length - wrong.length,
    left: Math.max(0, accounts - rows.length),
    differ: wrong.length,
    skipped: rows.filter((r) => r.note).length,
    jobsInWorkspaces: ok.reduce((n, r) => n + r.ws_jobs, 0),
    jobsInTable: ok.reduce((n, r) => n + r.table_jobs, 0),
  };
}
