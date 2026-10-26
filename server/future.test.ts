// "Future of your field" from the BLS projections. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Workspace } from "@shared/types";
import { futureFor } from "./future";

const student = (major: string, targetRoles = "") => ({ profile: { major, targetRoles, interests: "" } } as unknown as Workspace);

test("future: a nursing major sees nursing occupations, growing first", () => {
  const f = futureFor(student("Nursing")).fields.find((x) => x.field === "nursing")!;
  assert.ok(f.growing.length > 0);
  assert.ok(f.growing.some((o) => /nurse/i.test(o.title)));
  for (let i = 1; i < f.growing.length; i++) assert.ok(f.growing[i - 1].change >= f.growing[i].change);
});
test("future: every career field maps to some occupations", () => {
  for (const major of ["Finance", "Marketing", "Computer Science", "Mechanical Engineering", "Education", "Criminal Justice", "Film", "Journalism", "Hospitality", "Sport management", "Nonprofit leadership", "Psychology", "Biology", "Real estate", "Aviation"]) {
    const fs = futureFor(student(major)).fields;
    assert.ok(fs.length > 0, major);
    assert.ok(fs.every((f) => f.total > 0), major);
  }
});
test("future: shrinking lists only declining jobs, worst first", () => {
  const f = futureFor(student("Accounting")).fields[0];
  assert.ok(f.shrinking.every((o) => o.change < 0));
  for (let i = 1; i < f.shrinking.length; i++) assert.ok(f.shrinking[i - 1].change <= f.shrinking[i].change);
});
test("future: no field named, no fields shown", () => {
  assert.equal(futureFor(student("")).fields.length, 0);
});
