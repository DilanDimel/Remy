import { test } from "node:test";
import assert from "node:assert/strict";
import { visibleJobs } from "./next.ts";

const ws = (over: any = {}) => ({ resume: { confirmedAt: "2026-11-01" }, applications: [], tasks: [], jobs: [], hiddenJobIds: [], plan: undefined, ...over }) as any;
const job = (id: string, over: any = {}) => ({ id, kind: "internship", title: "Analyst", company: "Co " + id, deadline: "", ...over }) as any;
const fit = (score: number, over: any = {}) => ({ score, eligibility: "likely", why: "fits", ...over }) as any;

test("visibleJobs hides hidden, closed, past and event openings", () => {
  const now = new Date("2026-11-22T12:00:00");
  const jobs = [job("ok"), job("hid"), job("closed"), job("past", { deadline: "2026-11-01" }), job("ev", { kind: "event" }), job("nofit")];
  const fits = { ok: fit(1), hid: fit(1), closed: fit(1, { closed: "gone" }), past: fit(1), ev: fit(1) };
  assert.deepEqual(visibleJobs({ hiddenJobIds: ["hid"] }, jobs, fits, now).map((j) => j.id), ["ok"]);
});
