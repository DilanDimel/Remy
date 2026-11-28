import { test } from "node:test";
import assert from "node:assert/strict";
import type { ResumeDoc } from "@shared/types";
import { addStoryEntry } from "@shared/storyEntry";

const doc = (headings: string[]): ResumeDoc => ({ contact: { name: "Sam", email: "", phone: "", location: "", links: "" }, sections: headings.map((h, i) => ({ id: `s${i}`, heading: h, entries: [{ id: `e${i}`, org: "Old", role: "", location: "", dates: "", bullets: [] }] })), skills: [] });
const intern = { kind: "internship", org: " Alcon ", role: "Finance Intern", start: "Jun 2026", end: "Aug 2026", city: "Fort Worth, TX" };

test("story entry: goes to the top of Experience with its dates and only non-empty lines", () => {
  const d = addStoryEntry(doc(["Education", "Experience"]), intern, ["Updated weekly forecasts", "  "]);
  const e = d.sections[1].entries[0];
  assert.equal(e.org, "Alcon");
  assert.equal(e.dates, "Jun 2026 – Aug 2026");
  assert.deepEqual(e.bullets.map((b) => b.text), ["Updated weekly forecasts"]);
  assert.equal(d.sections[1].entries.length, 2);
});

test("story entry: a missing section is created right after Education, and the original doc is untouched", () => {
  const before = doc(["Education", "Projects"]);
  const d = addStoryEntry(before, { ...intern, kind: "volunteer" }, ["Sorted donations"]);
  assert.deepEqual(d.sections.map((s) => s.heading), ["Education", "Community Service", "Projects"]);
  assert.equal(before.sections.length, 2);
});
