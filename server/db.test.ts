// The storage layer against real Postgres (PGlite in memory). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { aiAllowed, cleanupOld, createSession, deleteAccount, ensureUser, getFile, getUser, loadWorkspace, saveFile, saveSections, saveWorkspace, sessionUser } from "./db";
import { q } from "./sql";

const me = (id: string, kind = "guest") => ({ id, kind, email: `${id}@example.com`, name: id, picture: "" }) as any;

test("users and sessions: a session signs in its user until it expires", async () => {
  await ensureUser(me("u1", "supabase"));
  await ensureUser({ ...me("u1", "supabase"), name: "New Name" });
  assert.equal((await getUser("u1"))!.name, "New Name");
  const s = await createSession("u1");
  assert.equal(await sessionUser(s.token), "u1");
  await q("UPDATE sessions SET expires_at = now() - interval '1 minute'");
  assert.equal(await sessionUser(s.token), null);
});

test("saveSections merges only the sections it's given, so parallel saves don't erase each other", async () => {
  await ensureUser(me("u2"));
  const ws = await loadWorkspace("u2");
  ws.profile.name = "Dilan";
  await saveWorkspace("u2", ws);
  // Two requests that started from the same copy save different sections.
  await saveSections("u2", { tasks: [{ id: "t1", title: "From request A" }] as any });
  const after = await saveSections("u2", { calendar: [{ id: "c1", title: "From request B" }] as any });
  assert.equal(after.tasks[0].title, "From request A");
  assert.equal(after.calendar[0].title, "From request B");
  assert.equal(after.profile.name, "Dilan");
  assert.equal((await loadWorkspace("u2")).tasks.length, 1);
});

test("files keep their exact bytes; deleting an account removes everything", async () => {
  await ensureUser(me("u3"));
  const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff]);
  await saveFile("u3", "resume", "r.pdf", "application/pdf", bytes);
  assert.deepEqual((await getFile("u3", "resume"))!.data, bytes);
  await saveSections("u3", { tasks: [] });
  await createSession("u3");
  await deleteAccount("u3");
  for (const t of ["users WHERE id", "workspaces WHERE user_id", "files WHERE user_id", "sessions WHERE user_id"])
    assert.equal((await q(`SELECT 1 FROM ${t} = 'u3'`)).length, 0, t);
});

test("AI allowance: guests get 40 a day, and a burst of 12 a minute pauses anyone", async () => {
  await ensureUser(me("u4"));
  for (let i = 0; i < 12; i++) assert.ok((await aiAllowed("u4", true)).ok);
  assert.match((await aiAllowed("u4", true)).message!, /wait a minute/);
  await q("UPDATE ai_usage SET at = now() - interval '2 hours'");
  for (let i = 0; i < 28; i++) await q("INSERT INTO ai_usage (user_id, at) VALUES ('u4', now() - interval '1 hour')");
  assert.match((await aiAllowed("u4", true)).message!, /40 AI requests/);
});

test("cleanup removes idle guests but keeps signed-in students", async () => {
  await ensureUser(me("old-guest"));
  await ensureUser(me("old-student", "supabase"));
  await q("UPDATE users SET created_at = now() - interval '40 days' WHERE id IN ('old-guest','old-student')");
  assert.equal(await cleanupOld(30), 1);
  assert.ok(await getUser("old-student"));
  assert.equal(await getUser("old-guest"), null);
});

test("analysis views turn workspaces into rows", async () => {
  await ensureUser(me("u5", "supabase"));
  await saveSections("u5", { profile: { school: "Texas Christian University", major: "Finance" } as any, tracker: [{ id: "k1", company: "McKesson", role: "Intern", status: "Applied", events: [{}, {}] }] as any });
  const p = (await q("SELECT school, major FROM student_profiles WHERE user_id='u5'"))[0];
  assert.deepEqual([p.school, p.major], ["Texas Christian University", "Finance"]);
  const a = (await q("SELECT company, status, status_changes FROM tracked_applications WHERE user_id='u5'"))[0];
  assert.deepEqual([a.company, a.status, a.status_changes], ["McKesson", "Applied", 2]);
});
