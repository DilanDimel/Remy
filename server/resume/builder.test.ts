import { test } from "node:test";
import assert from "node:assert/strict";
import type { BuilderItem, ResumeBuilder } from "@shared/types";
import { bulletFlags, buildDoc, FOLLOWUP_BUDGET, hasBlank, ruleBullets, ruleFollowups } from "./builder";

const item = (o: Partial<BuilderItem>): BuilderItem => ({ id: o.kind || "x", kind: "job", stage: "college", org: "", role: "", start: "", end: "", city: "", about: "", followups: [], ...o });
const builder = (classYear: string, items: BuilderItem[]): ResumeBuilder => ({
  step: 0, items, skills: ["Microsoft Excel"],
  basics: { name: "Sam Frog", email: "sam@example.com", phone: "", city: "Fort Worth, TX", school: "Texas Christian University", major: "Finance", graduation: "May 2029", classYear, gpa: "3.6", highSchool: "Paschal High School", highSchoolYear: "2025" },
  draft: Object.fromEntries(items.map((i) => [i.id, [{ id: "b-" + i.id, text: `Did things at ${i.org}`, options: [], source: i.about }]])),
});
const cfa = item({ id: "j", kind: "job", org: "Chick-fil-A", role: "Team Member", about: "I took orders at the drive-thru and trained new hires." });
const club = item({ id: "c", kind: "club", org: "Finance Club", role: "Member", about: "I go to weekly meetings." });
const hsSports = item({ id: "s", kind: "sports", stage: "high school", org: "Paschal Soccer", role: "Player", about: "Played varsity soccer for two years." });
const lang = item({ id: "l", kind: "language", org: "Spanish (fluent)" });

test("builder: education first, then sections in a fixed order; languages become a skill line", () => {
  const doc = buildDoc(builder("First-year", [club, cfa, hsSports, lang]));
  assert.deepEqual(doc.sections.map((s) => s.heading), ["Education", "Experience", "Leadership & Activities"]);
  assert.equal(doc.sections[0].entries[0].org, "Texas Christian University");
  assert.equal(doc.sections[0].entries[0].role, "Major: Finance"); // no invented degree type
  assert.ok(doc.sections[0].entries.some((e) => e.org === "Paschal High School"));
  assert.deepEqual(doc.skills.map((k) => k.label), ["Skills", "Languages"]);
});

test("builder: juniors leave high school off unless they keep it", () => {
  const b = builder("Junior", [cfa, hsSports]);
  let doc = buildDoc(b);
  assert.ok(!JSON.stringify(doc).includes("Paschal"));
  doc = buildDoc({ ...b, keepHighSchool: true });
  assert.ok(JSON.stringify(doc).includes("Paschal High School") && JSON.stringify(doc).includes("Paschal Soccer"));
});

test("builder: the honesty check flags invented numbers and leadership, but not blanks or the student's own facts", () => {
  assert.ok(bulletFlags("Trained 5 new hires during peak hours", cfa).some((f) => f.type === "number"));
  assert.ok(bulletFlags("Led the drive-thru team", cfa).some((f) => f.type === "title"));
  assert.deepEqual(bulletFlags("Trained [how many?] new hires and took drive-thru orders", cfa), []);
  assert.deepEqual(bulletFlags("Played varsity soccer for two years", hsSports), []);
  assert.ok(bulletFlags("Played varsity soccer for two years as team captain", hsSports).length, "an added role the student never said");
  assert.ok(bulletFlags("Took drive-thru orders during busy lunch rushes", cfa).length, "an added detail");
  assert.ok(hasBlank("Served [how many customers?] a shift") && !hasBlank("Served customers"));
});

test("builder without AI: bullets are the student's own sentences; follow-ups stay within budget", () => {
  const bullets = ruleBullets(cfa);
  assert.equal(bullets[0].text, "Took orders at the drive-thru and trained new hires");
  const many = Array.from({ length: 8 }, (_, i) => item({ id: "i" + i, org: "Place " + i, about: "Helped out." }));
  const qs = ruleFollowups([...many, lang]);
  assert.ok(qs.length <= FOLLOWUP_BUDGET);
  assert.ok(!qs.some((q) => q.itemId === "l")); // nothing to ask about a language
});
