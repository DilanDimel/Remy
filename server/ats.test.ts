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
