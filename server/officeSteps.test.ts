import { test } from "node:test";
import assert from "node:assert/strict";
import { officeSteps } from "../shared/officeSteps";
import { emptyWorkspace } from "./platform/db";

const today = "2026-11-24";

test("a new student: resume frame first, then his computer; one step per spot, at most three", () => {
  const s = officeSteps(emptyWorkspace(), today, 12, 4);
  assert.deepEqual(s.map((x) => x.spot), ["frame", "computer"]);
  assert.equal(s[0].link, "/resume?tab=base");
  assert.match(s[1].say, /4 new openings/);
  assert.ok(new Set(s.map((x) => x.spot)).size === s.length && s.length <= 3);
});

test("Later hides a step for the day", () => {
  const s = officeSteps(emptyWorkspace(), today, 12, 4, ["resume:add"]);
  assert.deepEqual(s.map((x) => x.spot), ["computer"]);
});

test("open questions go to his notes", () => {
  const w = emptyWorkspace();
  w.memory = [{ id: "m1", text: "Summer Analyst at TBC Bank", category: "experience", source: "LinkedIn profile (PDF) import", status: "suggested", conflict: "Your resume says Summer Intern at TBC Bank", createdAt: today, updatedAt: today } as never];
  const s = officeSteps(w, today, 12, 0);
  assert.ok(s.some((x) => x.spot === "notes" && x.ask));
});
