// ATS keyword matching. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ResumeDoc } from "@shared/types";
import { atsScore } from "./ats";

const doc = (bullets: string[], skills = ""): ResumeDoc => ({
  contact: { name: "Dilan Desman", email: "d@example.com", phone: "682-000-0000", location: "Fort Worth, TX", links: "linkedin.com/in/x" },
  sections: [{ id: "s", heading: "Experience", entries: [{ id: "e", org: "NABA", role: "Treasurer", location: "", dates: "Aug 2025 – Present", bullets: bullets.map((text, i) => ({ id: "b" + i, text })) }] }],
  skills: skills ? [{ label: "Skills", items: skills }] : [],
} as unknown as ResumeDoc);

test("keywords: a tool only counts when its whole name is there", () => {
  const r = atsScore(doc(["Built a DCF model in Excel and presented it in PowerPoint"]), ["Power BI", "Excel", "financial modeling", "SQL"], "in the posting");
  assert.deepEqual(r.keywords.matched, ["Excel"]);
  assert.deepEqual(r.keywords.missing, ["Power BI", "financial modeling", "SQL"]);
});
test("keywords: word endings still match (modeling ↔ models), so a tailored bullet raises the score", () => {
  const r = atsScore(doc(["Conducted financial models in Excel for M&A scenarios"]), ["financial modeling", "Excel"], "in the posting");
  assert.deepEqual(r.keywords.missing, []);
});

test("base resume score ignores openings: same resume, same score, scaled to 100", () => {
  const d = doc(["Built a DCF model in Excel and presented it in PowerPoint to 12 classmates"]);
  const a = atsScore(d, null, ""), b = atsScore(d, null, "");
  assert.equal(a.score, b.score);
  assert.ok(!a.categories.some((c) => c.name === "Keyword match"));
  assert.equal(a.categories.reduce((n, c) => n + c.max, 0), 75);
  assert.ok(a.score <= 100 && a.score >= Math.round(a.categories.reduce((n, c) => n + c.score, 0)));
});

test("keywords match what the resume shows, not just the posting's exact phrase", async () => {
  const { hasKeyword, isSkillKeyword } = await import("./ats");
  const r = "B.S. Mechanical Engineering, Expected May 2027. Led 5 students designing a steel tube frame in SolidWorks.";
  assert.ok(hasKeyword(r, "Pursuing Mechanical Engineering"));
  assert.ok(hasKeyword(r, "CAD experience"));
  assert.ok(hasKeyword(r, "Bachelor's Degree Pursuit"));
  assert.ok(!hasKeyword(r, "Python"));
  assert.ok(!hasKeyword(r, "Teamwork and communication"), "nothing shows communication");
  assert.ok(!isSkillKeyword("Background Check"));
});

test("keywords match whole word families, never just the first 5 letters", async () => {
  const { hasKeyword } = await import("./ats");
  // Real bugs found in the Nov 2026 tests: a shared 5-letter start counted as having the skill.
  assert.ok(!hasKeyword("Built pivot tables in Excel to track dues.", "Tableau"));
  assert.ok(!hasKeyword("Used CFD to compute drag on the wing. Bachelor of Science.", "computer science"));
  assert.ok(!hasKeyword("Accounted for weekly cash drawer totals.", "Accountability"));
  // Same word family still counts.
  assert.ok(hasKeyword("Built three financial models in Excel.", "financial modeling"));
  assert.ok(hasKeyword("Sorted donations for the food bank.", "sorting"));
  assert.ok(hasKeyword("Managed a team of four.", "management"));
  assert.ok(hasKeyword("Planned the spring banquet.", "planning"));
  assert.ok(hasKeyword("Studied consumer behavior.", "studies"));
  assert.ok(hasKeyword("Wrote Python and C++ scripts.", "C++"));
});

test("keywords: roles count for their skill, and everyday resume words still match", async () => {
  const { hasKeyword } = await import("./ats");
  const yes: [string, string][] = [
    ["Analyzed sales data for 3 stores.", "data analysis"],
    ["Shift Manager at Chick-fil-A.", "management"],
    ["Team leader for the robotics club.", "leadership"],
    ["Organized a 200-person career fair.", "organizational skills"],
    ["Presented findings to the VP.", "presentation skills"],
    ["Statistical modeling in R.", "statistics"],
    ["Accountant intern at BDO.", "accounting"],
    ["Event coordinator for NABA.", "coordination"],
    ["Mentored 5 freshmen.", "mentorship"],
    ["Researcher in the Smith lab.", "research"],
    ["Strong at problem solving.", "problem-solving"],
    ["Worked with cross functional teams.", "cross-functional"],
    ["Built financial models.", "finance"],
  ];
  for (const [text, kw] of yes) assert.ok(hasKeyword(text, kw), `${kw} should match: ${text}`);
  assert.ok(!hasKeyword("Canvas LMS admin for 3 courses.", "Canva"));
  assert.ok(!hasKeyword("Wrote a script to compute drag.", "computer"));
});

test("keywords: dates, sales terms and job titles don't pass as skills", async () => {
  const { hasKeyword } = await import("./ats");
  assert.ok(!hasKeyword("Barista, Starbucks, Aug 2025 – Present. Made drinks.", "presentation skills"));
  assert.ok(!hasKeyword("Lead generation: cold-called 50 prospects.", "leadership"));
  assert.ok(!hasKeyword("Account Executive intern, sold cloud software.", "accounting"));
  assert.ok(hasKeyword("Presented findings to the VP, Jan 2025 – Present.", "presentation skills"));
  assert.ok(hasKeyword("Led a team of 4.", "leadership"));
  assert.ok(hasKeyword("Developer intern at a startup.", "development"));
});
