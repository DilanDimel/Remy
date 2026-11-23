import { test } from "node:test";
import assert from "node:assert/strict";
import { keptUntracked } from "@shared/progress";

const job = (id: string, company = "Co " + id, title = "Analyst") => ({ id, company, title }) as any;
const track = (over: any) => ({ id: "t", company: "", role: "", status: "Applied", events: [], notes: "", ...over }) as any;

test("keptUntracked lists kept openings that aren't tracked yet, in kept order", () => {
  const jobs = [job("a"), job("b"), job("c")];
  assert.deepEqual(keptUntracked({ savedJobIds: ["c", "a"], tracker: [] }, jobs).map((j) => j.id), ["c", "a"]);
  assert.deepEqual(keptUntracked({ savedJobIds: [], tracker: [] }, jobs), []);
});

test("keptUntracked skips ones already tracked (by id or same company and role) and ones no longer listed", () => {
  const jobs = [job("a", "Point72", "Data Research Fellowship"), job("b"), job("c")];
  const w = { savedJobIds: ["a", "b", "c", "gone"], tracker: [track({ company: " point72", role: "data research fellowship " }), track({ jobId: "b" })] };
  assert.deepEqual(keptUntracked(w, jobs).map((j) => j.id), ["c"]);
});
