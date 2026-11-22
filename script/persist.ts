// Persistence check: runs the production build (dist/index.cjs) on a throwaway
// SQLite file, uses the features a student would, restarts the server, and
// confirms the same session still sees the same workspace. No AI keys are used.
// Run via `npm run check:persist` (builds first).
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const entry = path.join(root, "dist/index.cjs");
if (!fs.existsSync(entry)) {
  console.error("persist: dist/index.cjs is missing — run `npm run build` first");
  process.exit(1);
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "or-persist-"));
const dbPath = path.join(dir, "pgdata"); // a PGlite folder: real Postgres, no server needed
const port = 5000 + Math.floor(Math.random() * 900) + 100;
const host = `http://127.0.0.1:${port}`;

let server: ChildProcess | null = null;
let log = "";
async function start() {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", PORT: String(port), OR_DB_PATH: dbPath };
  // Blank rather than delete, so a local .env can't fill them back in (dotenv never overrides).
  for (const k of ["OR_AI_CHAIN", "OPENROUTER_API_KEY", "GEMINI_API_KEY", "OR_TRUST_VISITOR_HEADER"]) env[k] = "";
  // Repo root, as in production: the server reads server/sample-resume.txt relative to cwd.
  server = spawn(process.execPath, [entry], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout!.on("data", (d) => (log += d));
  server.stderr!.on("data", (d) => (log += d));
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(host + "/api/config")).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("server did not start:\n" + log);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const s = server;
  await new Promise<void>((r) => {
    s.once("exit", () => r());
    s.kill("SIGTERM");
  });
}

async function call(cookie: string, method: string, url: string, body?: unknown) {
  const r = await fetch(host + url, {
    method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status}: ${text.slice(0, 200)}`);
  return { json: JSON.parse(text), setCookie: r.headers.get("set-cookie") || "" };
}
async function guest() {
  const r = await call("", "POST", "/api/auth/guest");
  const cookie = r.setCookie.split(";")[0];
  assert(cookie.startsWith("__Host-or_sid="), "guest sign-in should set the session cookie");
  return cookie;
}
const passed: string[] = [];
const ok = (msg: string) => {
  passed.push(msg);
  console.log("  ✓ " + msg);
};

try {
  await start();
  const cookie = await guest();
  const me = (await call(cookie, "GET", "/api/me")).json.me;
  ok(`guest session created (${me.id})`);

  let ws = (await call(cookie, "POST", "/api/resume/sample")).json;
  assert(ws.resume?.doc?.sections?.length, "sample resume should be parsed");
  ws = (await call(cookie, "PUT", "/api/ws/profile", { value: { ...ws.profile, preferredName: "Persist Test", classYear: "2028" } })).json;
  ws = (await call(cookie, "PUT", "/api/ws/tasks", { value: [...ws.tasks, { id: "t-persist", title: "Persistence task", why: "check", due: "2026-11-01", category: "Prepare", done: true, source: "Student" }] })).json;
  ws = (await call(cookie, "PUT", "/api/ws/calendar", { value: [...ws.calendar, { id: "c-persist", title: "Persistence event", date: "2026-11-02", time: "10:00", kind: "Event", source: "Student", notes: "" }] })).json;
  ws = (await call(cookie, "PUT", "/api/ws/settings", { value: { theme: "dark" } })).json;
  // Remy has no built-in postings, so add two the way the live search would, with the server stopped.
  await stop();
  process.env.OR_DB_PATH = dbPath;
  const db = await import("../server/platform/db");
  const seeded = await db.loadWorkspace(me.id);
  for (const n of [1, 2]) seeded.jobs.push({
    id: `job-persist-${n}`, kind: "internship", title: `Finance Intern ${n}`, company: "Example Co", location: "Dallas, TX", format: "", dates: "",
    deadline: "", deadlineText: "", eligibility: [], requirements: [], summary: "", applyUrl: `https://example.com/${n}`, sourceUrl: `https://example.com/${n}`,
    sourceName: "Example Co careers", label: "Live", checkedAt: "2026-10-23", checks: [], origin: "imported",
  });
  await db.saveWorkspace(me.id, seeded);
  await (await import("../server/platform/sql")).closeDb(); // PGlite allows one process per folder
  await start();
  const jobs = (await call(cookie, "GET", "/api/jobs")).json.jobs;
  assert.equal(jobs.length, 2, "the seeded openings should be listed");
  await call(cookie, "POST", "/api/applications", { jobId: jobs[0].id });
  ws = (await call(cookie, "PUT", "/api/ws/hiddenJobIds", { value: [jobs.at(-1).id] })).json;
  ws = (await call(cookie, "POST", "/api/memory/remember", { text: "Prefers roles in New York" })).json;
  ws = (await call(cookie, "POST", "/api/safeguard/test", {})).json.workspace;
  ws = (await call(cookie, "PUT", "/api/ws/contacts", { value: [{ id: "c-test", name: "Pat Lee", title: "Analyst", org: "Example Co", email: "pat@example.com", why: "Met at the career fair", tags: [], label: "Student provided" }] })).json;
  ws = (await call(cookie, "POST", "/api/inbox/paste", { from: "recruiting@example.com", subject: "Thanks for applying", body: "Thank you for applying. We have received your application and will be in touch." })).json;
  const before = (await call(cookie, "GET", "/api/me")).json.workspace;
  ok("used resume, profile, tasks, calendar, settings, opportunities, applications, memory, safeguard, community and inbox");

  await stop();
  await start();
  ok("server restarted on the same database");

  const after = await call(cookie, "GET", "/api/me");
  assert.equal(after.json.me?.id, me.id, "the session cookie should still sign in the same user after a restart");
  ok("session survived the restart");
  const w = after.json.workspace;
  assert.equal(w.profile.preferredName, "Persist Test");
  assert.equal(w.profile.classYear, "2028");
  assert(w.resume?.doc, "resume");
  assert(w.tasks.some((t: any) => t.id === "t-persist" && t.done), "tasks");
  assert(w.calendar.some((c: any) => c.id === "c-persist"), "calendar");
  assert.equal(w.settings.theme, "dark");
  assert(w.applications.some((a: any) => a.jobId === jobs[0].id), "applications");
  assert(w.savedJobIds.includes(jobs[0].id), "saved jobs");
  assert(w.hiddenJobIds.includes(jobs.at(-1).id), "hidden jobs");
  assert(w.memory.some((m: any) => m.text === "Prefers roles in New York"), "memory");
  assert(w.incidents.length, "safeguard incidents");
  assert(w.contacts.length, "contacts");
  assert(w.inbox.some((m: any) => m.subject === "Thanks for applying"), "inbox");
  assert.deepEqual(w, before, "the whole workspace should be identical after a restart");
  ok("every feature's data is unchanged after the restart");

  const other = await guest();
  const ow = (await call(other, "GET", "/api/me")).json.workspace;
  assert(!ow.tasks.some((t: any) => t.id === "t-persist"), "a second guest must not see the first guest's data");
  ok("a second guest gets a separate workspace");

  await call(cookie, "POST", "/api/auth/logout");
  assert.equal((await call(cookie, "GET", "/api/me")).json.me, null, "the old cookie should stop working after logout");
  ok("logout ends the session");

  console.log(`persist OK (${passed.length} checks)`);
} catch (e: any) {
  console.error("\npersist FAILED: " + (e?.message || e));
  if (log.trim()) console.error("--- server log ---\n" + log.split("\n").slice(-20).join("\n"));
  process.exitCode = 1;
} finally {
  await stop();
  fs.rmSync(dir, { recursive: true, force: true });
}
