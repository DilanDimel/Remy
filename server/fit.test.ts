// Eligibility, class standing and region rules behind the Opportunities ranking. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job, Workspace } from "@shared/types";
import { classYearOf, computeFit, regionMatch } from "./fit";

const fall2026 = new Date("2026-10-22T12:00:00");
const student = (profile: Partial<Workspace["profile"]>) =>
  ({ profile: { classYear: "", graduation: "", regions: "", opportunityTypes: "", ...profile }, resume: undefined } as unknown as Workspace);
const job = (j: Partial<Job>) =>
  ({ kind: "internship", title: "Summer Analyst", location: "Dallas, TX", format: "", eligibility: [], requirements: [], label: "Live", ...j } as unknown as Job);

test("class standing from graduation date: May 2029 is a sophomore in fall 2026", () => {
  assert.equal(classYearOf(student({ graduation: "May 2029" }), fall2026), "Sophomore");
  assert.equal(classYearOf(student({ graduation: "May 2030" }), fall2026), "First-year");
});
test("class standing the student states wins over the graduation date", () => {
  assert.equal(classYearOf(student({ classYear: "Junior", graduation: "May 2029" }), fall2026), "Junior");
});
test("'Class of 2029' posting: likely for a 2029 graduate, ruled out for 2030", () => {
  const j = job({ eligibility: ["Open to students in the Class of 2029"] });
  assert.equal(computeFit(student({ graduation: "May 2029" }), j, "").eligibility, "likely");
  const f = computeFit(student({ graduation: "May 2030" }), j, "");
  assert.equal(f.eligibility, "unlikely");
  assert.equal(f.excluded, true);
});
test("'must be a current sophomore' rules out a junior", () => {
  const f = computeFit(student({ classYear: "Junior" }), job({ eligibility: ["Applicants must be current sophomores."] }), "");
  assert.equal(f.excluded, true);
});
test("standing by credit hours is left for the student to check, not hidden", () => {
  const f = computeFit(student({ classYear: "First-year" }), job({ eligibility: ["Open to sophomores (by credit hours)."] }), "");
  assert.equal(f.eligibility, "check");
  assert.ok(!f.excluded);
});
test("'rising sophomores' means current first-years", () => {
  const f = computeFit(student({ classYear: "First-year" }), job({ eligibility: ["This program is for rising sophomores."] }), "");
  assert.equal(f.eligibility, "likely");
});
test("regions: DFW suburbs match Dallas, Europe doesn't, 'anywhere' doesn't filter", () => {
  assert.equal(regionMatch(student({ regions: "Dallas" }), job({ location: "Irving, TX" })), true);
  assert.equal(regionMatch(student({ regions: "Dallas, Fort Worth" }), job({ location: "Brussels, Belgium" })), false);
  assert.equal(regionMatch(student({ regions: "anywhere" }), job({ location: "Brussels, Belgium" })), null);
  assert.equal(regionMatch(student({ regions: "Remote" }), job({ location: "New York, NY", format: "Remote" })), true);
  assert.equal(regionMatch(student({ regions: "Dallas, Fort Worth" }), job({ location: "New York, NY / virtual" })), true, "virtual programs count everywhere");
});
