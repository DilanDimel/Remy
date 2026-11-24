import { test } from "node:test";
import assert from "node:assert/strict";
import { daysFrom, nextAction } from "../shared/nextAction";

// Home's "one thing right now", shared by the website and the phone app.
const now = new Date("2026-11-24T15:00:00");
const ws = (over: any = {}) => ({ resume: { confirmedAt: "2026-11-01" }, applications: [], tasks: [], jobs: [], hiddenJobIds: [], tracker: [], calendar: [], plan: undefined, ...over }) as any;
const job = (id: string, over: any = {}) => ({ id, kind: "internship", title: "Analyst", company: "Co " + id, deadline: "", ...over }) as any;
const fit = (score: number, over: any = {}) => ({ score, eligibility: "likely", why: "fits", matched: [], ...over }) as any;
const go = (w: any, jobs: any[] = [], fits: any = {}) => nextAction(w, jobs, fits, { ownerView: true, now });

test("days are counted noon to noon from today", () => {
  assert.equal(daysFrom("2026-11-24", now), 0);
  assert.equal(daysFrom("2026-11-25", now), 1);
  assert.equal(daysFrom("", now), null);
});

test("an interview in the next two days comes first", () => {
  const n = go(ws({ resume: undefined, calendar: [{ id: "c", kind: "Interview", title: "Interview with Ally", date: "2026-11-25" }] }));
  assert.match(n.title, /^Prepare for your interview tomorrow: Ally/);
  assert.equal(n.cta, "Add prep steps");
  assert.ok(n.interview);
});

test("resume first, then confirming it, then pending changes", () => {
  assert.equal(go(ws({ resume: undefined })).title, "Add your resume");
  assert.equal(go(ws({ resume: {} })).title, "Confirm your base resume");
  const n = go(ws({ applications: [{ id: "a1", jobId: "j1", changes: [{ status: "pending" }, { status: "pending" }] }] }), [job("j1", { company: "Ally" })]);
  assert.equal(n.title, "Finish reviewing your Ally application");
  assert.equal(n.why, "2 suggested changes are waiting for you to accept, edit or reject.");
});

test("the best open, eligible opening when there's no plan", () => {
  const jobs = [job("a"), job("b"), job("c", { deadline: "2026-11-01" })];
  const n = go(ws(), jobs, { a: fit(3), b: fit(8), c: fit(20) });
  assert.equal(n.title, "Tailor your resume for Co b");
  assert.equal(go(ws(), [], {}).title, "Explore openings that fit you");
});

test("a plan to-do that names an opening the student can't pursue is skipped", () => {
  const w = ws({ tasks: [{ id: "t", title: "Apply to Co a", done: false, source: "AI plan (review)", why: "" }] });
  assert.equal(go(w, [job("a")], { a: fit(5, { closed: true }) }).title, "Explore openings that fit you");
  assert.equal(go(w, [job("a")], { a: fit(5) }).title, "Apply to Co a");
});
