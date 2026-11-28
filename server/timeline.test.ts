import test from "node:test";
import assert from "node:assert/strict";
import { personalTimeline } from "../shared/timeline";

test("Timeline: a sophomore in finance gets their own summers, the recruiting window and graduation, with real dates", () => {
  const t = personalTimeline({ year: 2, graduation: "May 2029", field: "Finance, BIS", next: "Excel", cert: "Bloomberg Market Concepts", exploring: true, now: new Date(2026, 10, 28) });
  assert.equal(t[0].when, "Now · Fall 2026");
  assert.equal(t[0].what, "Try one small task in each field you're weighing. Next: Excel. A certificate worth doing now: Bloomberg Market Concepts.");
  assert.equal(t[1].when, "January 2027");
  assert.match(t[1].what, /^Finance internship applications open/);
  assert.deepEqual(t.filter((s) => s.when.startsWith("Summer")).map((s) => s.when), ["Summer 2027", "Summer 2028"]);
  assert.match(t.find((s) => s.when === "Summer 2028")!.what, /big internship/);
  assert.equal(t.at(-1)!.when, "Graduation · May 2029");
});

test("Timeline: no graduation date falls back on the class year; after college it's the first job", () => {
  const t = personalTimeline({ year: 3, field: "Marketing", now: new Date(2027, 2, 10) });
  assert.equal(t[1].when, "Open now · until March");
  assert.equal(t.at(-1)!.when, "Graduation · May 2028");
  assert.deepEqual(personalTimeline({ year: 5, field: "", job: "staff accountant", now: new Date(2027, 2, 10) }).map((s) => s.what).at(-1), "Grow in your first job as a staff accountant.");
});
