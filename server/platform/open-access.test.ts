// Instant access (Nov 24): one owner switch lets anyone sign in during the beta, with a daily cap on tailoring, Beta
// Insider invites and the open terms; switching it off goes back to apply-first. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { aiAllowed, createSession, emptyWorkspace, ensureUser, loadWorkspace, newSigninCode, saveWorkspace } from "./db";
import { registerRoutes } from "../routes";
import { heavyKind, TAILOR_PER_DAY, saveInsider } from "./beta";
import { BETA_TERMS_VERSION, OPEN_TERMS_VERSION, insiderSurveyDue, termsFor } from "../../shared/beta";
import { pinsOf } from "../../shared/pins";

process.env.OWNER_EMAILS = "boss@open.test";

test("open access: owners flip it, anyone signs in, terms and insider follow, and it switches back", async (t) => {
  const flag = process.env.OR_BETA_ONLY;
  process.env.OR_BETA_ONLY = "true";
  t.after(() => { if (flag === undefined) delete process.env.OR_BETA_ONLY; else process.env.OR_BETA_ONLY = flag; });
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  async function call(cookie: string, method: string, path: string, body?: unknown) {
    const r = await fetch(base + path, { method, headers: { Cookie: cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: (await r.json()) as any };
  }
  async function account(id: string, email: string, visits: string[] = []) {
    await ensureUser({ id, kind: "supabase", email, name: "", picture: "" });
    const ws = emptyWorkspace();
    ws.profile.major = "Finance";
    ws.openingsCheckedAt = new Date().toISOString(); // no outbound searches in this test
    ws.visits = visits;
    await saveWorkspace(id, ws);
    return "__Host-or_sid=" + (await createSession(id)).token;
  }
  const boss = await account("sb:open-boss", "boss@open.test");
  const signIn = async (email: string) => call("", "POST", "/api/auth/email/verify", { email, code: await newSigninCode(email) });

  // Closed (today): strangers are turned away, students can't flip the switch or join Insider.
  let cfg = (await call("", "GET", "/api/config")).data.beta;
  assert.deepEqual([cfg.on, cfg.open], [true, false]);
  assert.equal((await signIn("new.student@open.test")).data.code, "beta");
  assert.equal((await call(boss, "POST", "/api/beta/agree", { version: OPEN_TERMS_VERSION })).status, 409);
  assert.equal((await call(boss, "POST", "/api/beta/agree", { version: BETA_TERMS_VERSION })).status, 200);
  assert.equal((await call(boss, "POST", "/api/admin/beta/open", { open: "yes" })).status, 400);

  // Open: config says so, a brand-new email signs straight in, and the open terms are the ones to agree to.
  const opened = await call(boss, "POST", "/api/admin/beta/open", { open: true });
  assert.equal(opened.status, 200);
  assert.deepEqual([opened.data.on, opened.data.open], [false, true]);
  cfg = (await call("", "GET", "/api/config")).data.beta;
  assert.deepEqual([cfg.on, cfg.open], [false, true]);
  const fresh = await signIn("new.student@open.test");
  assert.equal(fresh.status, 200);
  assert.equal(fresh.data.me.email, "new.student@open.test");
  const student = await account("sb:open-student", "kid@open.test", ["2026-11-20", "2026-11-21", "2026-11-22"]);
  assert.equal((await call(student, "POST", "/api/admin/beta/open", { open: false })).status, 403);
  assert.equal((await call(student, "POST", "/api/beta/agree", { version: BETA_TERMS_VERSION })).status, 409);
  assert.equal((await call(student, "POST", "/api/beta/agree", { version: OPEN_TERMS_VERSION })).data.betaAgreed.version, OPEN_TERMS_VERSION);

  // Old beta testers are Beta Insiders (Nov 24): someone on the tester list joins on their next visit, no form, no 3 days.
  assert.equal((await call(boss, "POST", "/api/admin/beta", { emails: "tester@open.test", note: "Cohort 1" })).status, 200);
  const tester = await account("sb:open-tester", "tester@open.test");
  const visit = (await call(tester, "GET", "/api/me")).data.workspace;
  assert.ok(visit.insider?.joinedAt);
  assert.equal(pinsOf(visit).find((p) => p.id === "insider")?.earned, true);
  assert.equal((await call(tester, "GET", "/api/me")).data.workspace.insider.joinedAt, visit.insider.joinedAt); // joins once

  // Beta Insider: a newcomer must use Remy on 3 days first; a regular joins and gets the secret pin.
  const newcomer = await account("sb:open-new", "newcomer@open.test", ["2026-11-22"]);
  assert.equal((await call(newcomer, "GET", "/api/me")).data.workspace.insider, undefined); // not on the list: invited after 3 days
  assert.equal((await call(newcomer, "POST", "/api/insider")).status, 400);
  const joined = await call(student, "POST", "/api/insider", { answers: { goal: "A finance internship", stuck: "Networking", tools: "LinkedIn", source: "A friend" } });
  assert.equal(joined.status, 200);
  // Joining replaces the old form: the answers show up for owners on the Students tab, one row per email.
  assert.equal((await call(student, "GET", "/api/admin/students")).status, 403);
  const kid = (await call(boss, "GET", "/api/admin/students")).data.people.filter((r: any) => r.email === "kid@open.test");
  assert.equal(kid.length, 1);
  assert.deepEqual([kid[0].goal, kid[0].source, kid[0].cohort, kid[0].days, !!kid[0].insider], ["A finance internship", "A friend", "Beta Insider", 3, true]);
  // A second save (or a Founding Cohort row) keeps what is already there and only fills blanks.
  await saveInsider("kid@open.test", { name: "Kid", school: "TCU", major: "", classYear: "" }, { goal: "Something else" });
  const again = (await call(boss, "GET", "/api/admin/students")).data.people.find((r: any) => r.email === "kid@open.test");
  assert.deepEqual([again.goal, again.school, again.cohort], ["A finance internship", "TCU", "Beta Insider"]);
  assert.ok(joined.data.insider.joinedAt);
  assert.equal(pinsOf(joined.data).find((p) => p.id === "insider")?.earned, true);
  assert.equal((await call(student, "POST", "/api/insider/survey", { answers: ["5"] })).data.insider.surveyAt, undefined); // not due on day one
  const ws = (await loadWorkspace("sb:open-student"))!;
  ws.insider = { joinedAt: "2026-01-01" };
  await saveWorkspace("sb:open-student", ws);
  const answered = await call(student, "POST", "/api/insider/survey", { answers: ["4", "Tailoring was slow", "Help with networking"] });
  assert.ok(answered.data.insider.surveyAt);

  // Back to invite-only: the stranger's new account is stopped again.
  const closed = await call(boss, "POST", "/api/admin/beta/open", { open: false });
  assert.deepEqual([closed.data.on, closed.data.open], [true, false]);
  assert.equal((await call("", "POST", "/api/auth/email/verify", { email: "x@open.test", code: await newSigninCode("x@open.test") })).data.code, "beta");
  assert.equal((await call(newcomer, "POST", "/api/insider")).status, 403);
});

test("tailoring has its own daily cap; other AI calls don't count toward it", async () => {
  assert.equal(heavyKind("Tailor for Deloitte"), "tailor");
  assert.equal(heavyKind("Fix rewrites for Deloitte"), "");
  const cap = { kind: "tailor", max: TAILOR_PER_DAY, message: "cap" };
  await ensureUser({ id: "sb:cap", kind: "supabase", email: "cap@open.test", name: "", picture: "" });
  await aiAllowed("sb:cap"); // an ordinary call
  // Space the calls past the per-minute burst limit by backdating them.
  const { q } = await import("./sql");
  for (let i = 0; i < TAILOR_PER_DAY; i++) {
    assert.equal((await aiAllowed("sb:cap", false, cap)).ok, true);
    await q("UPDATE ai_usage SET at = now() - interval '2 minutes' WHERE user_id = 'sb:cap'");
  }
  const blocked = await aiAllowed("sb:cap", false, cap);
  assert.deepEqual(blocked, { ok: false, message: "cap" });
  assert.equal((await aiAllowed("sb:cap")).ok, true); // other AI still works
});

test("open terms and the insider survey schedule", () => {
  assert.notEqual(termsFor(true).version, termsFor(false).version);
  assert.equal(termsFor(true).terms.length, termsFor(false).terms.length);
  assert.match(termsFor(true).terms[1], /free during the beta/);
  assert.doesNotMatch(termsFor(true).terms.join(" "), /invite-only/);
  assert.equal(insiderSurveyDue({ insider: { joinedAt: "2026-11-20" } }, "2026-11-26"), false);
  assert.equal(insiderSurveyDue({ insider: { joinedAt: "2026-11-20" } }, "2026-11-27"), true);
  assert.equal(insiderSurveyDue({ insider: { joinedAt: "2026-11-01", surveyAt: "2026-11-20" } }, "2026-12-03"), false);
  assert.equal(insiderSurveyDue({ insider: { joinedAt: "2026-11-01", surveyAt: "2026-11-20" } }, "2026-12-04"), true);
  assert.equal(insiderSurveyDue({}, "2026-12-04"), false);
});
