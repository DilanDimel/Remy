import { test } from "node:test";
import assert from "node:assert/strict";
import { deadlineChip, jobsLine, passedJobs, shortPlace, visibleJobs } from "./next.ts";

const ws = (over: any = {}) => ({ resume: { confirmedAt: "2026-11-01" }, applications: [], tasks: [], jobs: [], hiddenJobIds: [], plan: undefined, ...over }) as any;
const job = (id: string, over: any = {}) => ({ id, kind: "internship", title: "Analyst", company: "Co " + id, deadline: "", ...over }) as any;
const fit = (score: number, over: any = {}) => ({ score, eligibility: "likely", why: "fits", ...over }) as any;

test("visibleJobs hides hidden, closed, past and event openings", () => {
  const now = new Date("2026-11-22T12:00:00");
  const jobs = [job("ok"), job("hid"), job("closed"), job("past", { deadline: "2026-11-01" }), job("ev", { kind: "event" }), job("nofit")];
  const fits = { ok: fit(1), hid: fit(1), closed: fit(1, { closed: "gone" }), past: fit(1), ev: fit(1) };
  assert.deepEqual(visibleJobs({ hiddenJobIds: ["hid"] }, jobs, fits, now).map((j) => j.id), ["ok"]);
});

test("jobsLine counts new this week and the ones you qualify for", () => {
  const now = new Date("2026-11-24T12:00:00Z");
  const jobs = [job("a", { foundAt: "2026-11-23T00:00:00Z" }), job("b", { foundAt: "2026-11-01T00:00:00Z" })];
  assert.equal(jobsLine(jobs, { a: fit(1, { checked: true }), b: fit(1) }, now), "1 new this week. You qualify for 1.");
  assert.equal(jobsLine([jobs[1]], {}, now), "1 opening ranked for you.");
  assert.equal(jobsLine([], {}, now), "");
});

test("deadlineChip turns orange inside a week and says when it passed", () => {
  const now = new Date("2026-11-24T12:00:00");
  assert.deepEqual(deadlineChip("2026-11-20", now), { text: "Deadline passed", tone: "bad" });
  assert.deepEqual(deadlineChip("2026-11-27", now), { text: "Due Nov 27 · 3d", tone: "soon" });
  assert.equal(deadlineChip("2026-12-30", now)?.tone, "plain");
  assert.equal(deadlineChip("", now), null);
});

test("shortPlace and passedJobs", () => {
  assert.equal(shortPlace("Boston, MA, United States; New York, NY; Chicago, IL"), "Boston, MA + 2 more");
  assert.equal(shortPlace(""), "Location not stated");
  const w = { hiddenJobIds: ["p", "h"], jobFeedback: { p: { rating: 1 }, h: { rating: 4 } } } as any;
  assert.deepEqual(passedJobs(w, [job("p"), job("h"), job("x")]).map((j) => j.id), ["p"]);
});
