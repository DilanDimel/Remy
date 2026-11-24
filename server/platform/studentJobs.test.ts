// Saved openings in their own table (Nov 24): behind a switch, a fresh backup first, copied in small batches,
// kept in step with every save, checked against the workspace, and read only for owners. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Store } from "./backup";
import { copyJobsBatch, deleteWorkspace, editWorkspace, ensureUser, loadWorkspace, saveSections, saveWorkspace } from "./db";
import { jobsMode, jobsReport, setJobsMode } from "./studentJobs";
import { q, q1 } from "./sql";

process.env.OWNER_EMAILS = "owner@sj.test";
const box = new Map<string, unknown>();
const store: Store = { put: async (n, v) => { box.set(n, v); }, get: async (n) => box.get(n) ?? null, del: async (n) => { box.delete(n); } };
const job = (id: string, title = "Analyst intern") => ({ id, kind: "internship", title, company: "Acme", location: "Fort Worth", format: "onsite" }) as any;
const rows = async (id: string) => (await q("SELECT job_id, pos FROM student_jobs WHERE user_id=$1 ORDER BY pos", [id])).map((r) => `${r.pos}:${r.job_id}`);
async function account(id: string, email: string, jobs: any[]) {
  await ensureUser({ id, kind: "supabase", email, name: id, picture: "" } as any);
  const ws = await loadWorkspace(id);
  ws.jobs = jobs;
  await saveWorkspace(id, ws);
}

test("student_jobs: off by default, a backup first, copied in batches, kept in step, owners read it", async () => {
  await account("sj:a", "a@sj.test", [job("j1"), job("j2"), job("j3")]);
  await account("sj:b", "b@sj.test", [job("k1")]);
  await account("sj:own", "owner@sj.test", [job("o1"), job("o2")]);

  // Off: nothing is written or read.
  assert.equal(await jobsMode(true), "off");
  await saveSections("sj:a", { jobs: [job("j1"), job("j2"), job("j3"), job("j4")] });
  assert.equal(await copyJobsBatch(), 0);
  assert.equal(Number((await q1("SELECT count(*)::int AS n FROM student_jobs"))!.n), 0);

  // No backups, no start.
  await assert.rejects(setJobsMode("copy", "owner@sj.test", null), /fresh backup/);
  assert.equal(await jobsMode(true), "off");
  await assert.rejects(setJobsMode("everyone", "owner@sj.test", store), /off, copy or owners/);

  const on = await setJobsMode("copy", "owner@sj.test", store);
  assert.equal(on.backup?.kind, "full");
  assert.ok([...box.keys()].some((k) => k.startsWith("backup/full/")), "a fresh full backup was taken first");

  // Small batches: two now, the rest next time.
  assert.equal(await copyJobsBatch(2), 2);
  assert.equal(await copyJobsBatch(2), 1);
  assert.equal(await copyJobsBatch(2), 0);
  let r = await jobsReport();
  assert.deepEqual({ copied: r.copied, left: r.left, differ: r.differ }, { copied: 3, left: 0, differ: 0 });
  assert.equal(r.jobsInTable, r.jobsInWorkspaces);
  assert.deepEqual(await rows("sj:a"), ["0:j1", "1:j2", "2:j3", "3:j4"]);

  // Saves keep it in step: add, edit, reorder, remove; the workspace still has them all.
  await saveSections("sj:a", { jobs: [job("j4"), job("j1", "Renamed"), job("j3"), job("j5")] });
  assert.deepEqual(await rows("sj:a"), ["0:j4", "1:j1", "2:j3", "3:j5"]);
  assert.equal((await q1("SELECT data->>'title' AS t FROM student_jobs WHERE user_id='sj:a' AND job_id='j1'"))!.t, "Renamed");
  assert.equal((await loadWorkspace("sj:a")).jobs.length, 4, "the workspace keeps its own copy");
  await editWorkspace("sj:b", (ws) => { ws.jobs.push(job("k2")); });
  assert.deepEqual(await rows("sj:b"), ["0:k1", "1:k2"]);
  await saveSections("sj:b", { profile: { ...(await loadWorkspace("sj:b")).profile, major: "Finance" } });
  assert.deepEqual(await rows("sj:b"), ["0:k1", "1:k2"], "saves without openings leave them alone");
  r = await jobsReport();
  assert.equal(r.differ, 0);

  // A whole-workspace write is copied again by the next batch.
  const wb = await loadWorkspace("sj:b"); wb.jobs = [job("k9")]; await saveWorkspace("sj:b", wb);
  assert.equal((await jobsReport()).left, 1);
  assert.equal(await copyJobsBatch(), 1);
  assert.deepEqual(await rows("sj:b"), ["0:k9"]);

  // Duplicate ids: left out and reported, never read.
  await saveSections("sj:b", { jobs: [job("k9"), job("k9")] });
  r = await jobsReport();
  assert.equal(r.skipped, 1);
  await saveSections("sj:b", { jobs: [job("k9")] });
  assert.equal((await jobsReport()).skipped, 0, "fixed on the next save");

  // 'owners': owners read from the table, students don't. A wrong copy is caught by the check and redone.
  await setJobsMode("owners", "owner@sj.test", store);
  await q("UPDATE student_jobs SET data = jsonb_set(data, '{title}', '\"From the table\"') WHERE user_id IN ('sj:own', 'sj:a') AND pos = 0");
  await q("UPDATE student_jobs_state SET jobs_v = jobs_v + 1");
  assert.equal((await loadWorkspace("sj:own")).jobs[0].title, "From the table");
  assert.equal((await loadWorkspace("sj:a")).jobs[0].title, "Analyst intern", "students still read their workspace");
  r = await jobsReport(true);
  assert.equal(r.differ, 2);
  assert.equal((await loadWorkspace("sj:own")).jobs[0].title, "Analyst intern", "a copy being redone isn't read");
  await copyJobsBatch();
  assert.equal((await jobsReport()).differ, 0);
  const own = await loadWorkspace("sj:own");
  assert.deepEqual(own.jobs.map((j) => j.id), ["o1", "o2"]);

  // Undo: switch off and nothing is read from the table; on again starts every copy from scratch.
  await setJobsMode("off", "owner@sj.test", store);
  await setJobsMode("copy", "owner@sj.test", store);
  assert.equal((await jobsReport()).left, 3);

  // Deleting a workspace removes its copy.
  await copyJobsBatch();
  await deleteWorkspace("sj:a");
  assert.equal(Number((await q1("SELECT count(*)::int AS n FROM student_jobs WHERE user_id='sj:a'"))!.n), 0);
});
