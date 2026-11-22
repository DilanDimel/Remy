import { test } from "node:test";
import assert from "node:assert/strict";
import { nextThing, visibleJobs } from "./next.ts";

const ws = (over: any = {}) => ({ resume: { confirmedAt: "2026-11-01" }, applications: [], tasks: [], jobs: [], hiddenJobIds: [], plan: undefined, ...over }) as any;
const job = (id: string, over: any = {}) => ({ id, kind: "internship", title: "Analyst", company: "Co " + id, deadline: "", ...over }) as any;
const fit = (score: number, over: any = {}) => ({ score, eligibility: "likely", why: "fits", ...over }) as any;

test("resume steps come first", () => {
  assert.equal(nextThing(ws({ resume: undefined }), [], {}).title, "Add your resume");
  assert.equal(nextThing(ws({ resume: {} }), [], {}).title, "Confirm your base resume");
});

test("pending tailoring beats the plan", () => {
  const w = ws({ applications: [{ id: "a1", jobId: "j1", changes: [{ status: "pending" }, { status: "pending" }] }], plan: { nextAction: { title: "Plan step", why: "", link: "" } } });
  const n = nextThing(w, [job("j1")], {});
  assert.equal(n.title, "Finish reviewing your Co j1 application");
  assert.match(n.why, /2 suggested changes are/);
});

test("best visible opening when nothing else is waiting", () => {
  const jobs = [job("a"), job("b"), job("c")];
  const fits = { a: fit(2), b: fit(9), c: fit(20, { excluded: true }) };
  assert.equal(nextThing(ws(), jobs, fits).title, "Tailor your resume for Co b");
});

test("visibleJobs hides hidden, closed, past and event openings", () => {
  const now = new Date("2026-11-22T12:00:00");
  const jobs = [job("ok"), job("hid"), job("closed"), job("past", { deadline: "2026-11-01" }), job("ev", { kind: "event" }), job("nofit")];
  const fits = { ok: fit(1), hid: fit(1), closed: fit(1, { closed: "gone" }), past: fit(1), ev: fit(1) };
  assert.deepEqual(visibleJobs({ hiddenJobIds: ["hid"] }, jobs, fits, now).map((j) => j.id), ["ok"]);
});
