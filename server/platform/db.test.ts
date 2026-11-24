// The storage layer against real Postgres (PGlite in memory). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { recentStudents, aiAllowed, checkSchoolCode, checkSigninCode, newSigninCode, userByEmail, cleanupOld, newSchoolCode, removeSchoolEmail, schoolEmailOwner, createSession, deleteAccount, ensureUser, getFile, getUser, loadWorkspace, saveFile, saveSections, saveWorkspace, sessionUser } from "./db";
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

test("saved alumni and sample contacts/emails are dropped on load; student-added ones stay", async () => {
  await ensureUser(me("u9"));
  const ws = await loadWorkspace("u9");
  ws.contacts = [{ id: "alum-al1", label: "Live" }, { id: "c-sample-1", label: "Demo data" }, { id: "c1", label: "Student provided" }] as any;
  ws.outreach = [{ id: "o1", contactId: "alum-al1" }, { id: "o2", contactId: "c1" }] as any;
  ws.inbox = [{ id: "m1", label: "Sample email" }, { id: "m2", label: "Pasted by student" }] as any;
  await saveWorkspace("u9", ws);
  const after = await loadWorkspace("u9");
  assert.deepEqual(after.contacts.map((c) => c.id), ["c1"]);
  assert.deepEqual(after.outreach.map((o) => o.id), ["o2"]);
  assert.deepEqual(after.inbox.map((m) => m.id), ["m2"]);
});

test("text with a NUL character (from some PDFs) still saves", async () => {
  await ensureUser(me("u-nul"));
  const after = await saveSections("u-nul", { tasks: [{ id: "t1", title: "Seesaw\u0000CPR" }] as any });
  assert.equal(after.tasks[0].title, "SeesawCPR");
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

test("school email: the right code verifies once; wrong, expired and too many tries don't", async () => {
  await ensureUser(me("s1", "google"));
  const code = await newSchoolCode("s1", "Frog@TCU.edu");
  assert.match(code, /^\d{6}$/);
  const wrong = code === "000000" ? "111111" : "000000";
  assert.equal((await checkSchoolCode("s1", wrong)).result, "wrong");
  assert.deepEqual(await checkSchoolCode("s1", code), { result: "ok", email: "frog@tcu.edu" });
  assert.equal((await getUser("s1"))!.schoolEmail, "frog@tcu.edu");
  assert.equal((await checkSchoolCode("s1", code)).result, "none"); // used up
  // Expired code
  const c2 = await newSchoolCode("s1", "frog@tcu.edu");
  await q("UPDATE school_email_codes SET expires_at = now() - interval '1 minute'");
  assert.equal((await checkSchoolCode("s1", c2)).result, "expired");
  // Five wrong tries lock the code, even if the sixth is right
  const c3 = await newSchoolCode("s1", "frog@tcu.edu");
  const bad = c3 === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) assert.equal((await checkSchoolCode("s1", bad)).result, "wrong");
  assert.equal((await checkSchoolCode("s1", c3)).result, "expired");
  await removeSchoolEmail("s1");
  assert.equal((await getUser("s1"))!.schoolEmail, undefined);
});

test("school email: one address verifies only one account", async () => {
  await ensureUser(me("s2", "google"));
  await ensureUser(me("s3", "supabase"));
  assert.equal((await checkSchoolCode("s2", await newSchoolCode("s2", "horned@tcu.edu"))).result, "ok");
  assert.equal(await schoolEmailOwner("HORNED@tcu.edu"), "s2");
  assert.equal((await checkSchoolCode("s3", await newSchoolCode("s3", "horned@tcu.edu"))).result, "taken");
  assert.equal((await getUser("s3"))!.schoolEmail, undefined);
});

// Updates must never lose students' or the team's data: migrations only add. A migration that truly needs to
// remove something must say so on a line containing "allow-destructive: <reason>", reviewed by a person.
test("migrations never drop, truncate or delete data", async () => {
  const fs = await import("node:fs");
  const dir = new URL("../migrations/", import.meta.url);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
    const sql = fs.readFileSync(new URL(f, dir), "utf8");
    if (/allow-destructive:/i.test(sql)) continue;
    const code = sql.replace(/--.*$/gm, "").replace(/ON DELETE CASCADE/gi, "");
    assert.doesNotMatch(code, /\b(DROP\s+(TABLE|COLUMN|SCHEMA)|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE\s+\S+\s+RENAME)\b/i, `${f} would remove or rename data`);
  }
});

test("email sign-in codes: any case of the email works once; wrong and expired don't; the code opens the existing account", async () => {
  const code = await newSigninCode("Dee@Gmail.com");
  assert.match(code, /^\d{6}$/);
  assert.equal(await checkSigninCode("dee@gmail.com", code === "000000" ? "111111" : "000000"), "wrong");
  assert.equal(await checkSigninCode("DEE@gmail.com", code), "ok");
  assert.equal(await checkSigninCode("dee@gmail.com", code), "none", "used up");
  const c2 = await newSigninCode("dee@gmail.com");
  await q("UPDATE signin_codes SET expires_at = now() - interval '1 minute'");
  assert.equal(await checkSigninCode("dee@gmail.com", c2), "expired");
  assert.equal(await userByEmail("nobody@gmail.com"), null);
  await ensureUser({ ...me("sb:old", "supabase"), email: "Dee@gmail.com" });
  await ensureUser({ ...me("guest:x", "guest"), email: "dee@gmail.com" });
  assert.equal((await userByEmail("dee@GMAIL.com"))!.id, "sb:old", "a guest with the same email isn't a match");
});

test("recentStudents: only signed-in students seen since the date (and set up, when asked), longest-waiting search first", async () => {
  for (const [id, kind] of [["rs-a", "supabase"], ["rs-b", "supabase"], ["rs-old", "supabase"], ["rs-guest", "guest"], ["rs-new", "google"]] as const) {
    await ensureUser(me(id, kind));
    const ws = await loadWorkspace(id);
    ws.visits = id === "rs-old" ? ["2026-09-01"] : ["2026-09-01", "2026-11-01"];
    ws.onboarding.done = id !== "rs-new";
    ws.openingsCheckedAt = id === "rs-a" ? "2026-11-05T00:00:00Z" : id === "rs-b" ? "2026-11-01T00:00:00Z" : undefined;
    await saveWorkspace(id, ws);
  }
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id).filter((x) => x.startsWith("rs-"));
  assert.deepEqual(ids(await recentStudents("2026-10-16")), ["rs-new", "rs-b", "rs-a"]);
  assert.deepEqual(ids(await recentStudents("2026-10-16", true)), ["rs-b", "rs-a"]);
});

test("cleanup removes sign-in and school-email codes nobody came back for", async () => {
  await ensureUser(me("code-u"));
  await newSigninCode("late@example.com");
  await newSchoolCode("code-u", "late@tcu.edu");
  await q("UPDATE signin_codes SET expires_at = now() - interval '1 minute' WHERE email = 'late@example.com'");
  await q("UPDATE school_email_codes SET expires_at = now() - interval '1 minute' WHERE user_id = 'code-u'");
  await cleanupOld(30);
  assert.equal((await q("SELECT 1 FROM signin_codes WHERE email = 'late@example.com'")).length, 0);
  assert.equal((await q("SELECT 1 FROM school_email_codes WHERE user_id = 'code-u'")).length, 0);
});

test("the cached workspace copy: callers can't change it, and writes made elsewhere still show", async () => {
  await ensureUser(me("u-cache"));
  await saveSections("u-cache", { tasks: [{ id: "t1", title: "A" }] as any });
  const a = await loadWorkspace("u-cache");
  a.tasks.push({ id: "t2", title: "not saved" } as any);
  assert.equal((await loadWorkspace("u-cache")).tasks.length, 1);
  // Another server (or a hand edit) changes the row: the next read sees it.
  await q(`UPDATE workspaces SET data = data || '{"goal":"elsewhere"}'::jsonb, updated_at = now() WHERE user_id='u-cache'`);
  assert.equal(((await loadWorkspace("u-cache")) as any).goal, "elsewhere");
  // A save that starts from a stale copy still returns the real merged row.
  await q(`UPDATE workspaces SET data = data || '{"goal":"again"}'::jsonb, updated_at = now() WHERE user_id='u-cache'`);
  const after = await saveSections("u-cache", { calendar: [{ id: "c1" }] as any });
  assert.equal((after as any).goal, "again");
  assert.equal(after.tasks.length, 1);
  assert.equal((await loadWorkspace("u-cache")).calendar.length, 1);
});
