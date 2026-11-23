import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRatings, pickProfile, scoreInterview, weeklyLeft, listenFor, type Interview } from "@shared/interview";
import { CRITERIA, PROFILES } from "@shared/interviewRubric";

test("the scoring guide: 19 profiles, every criterion they use exists, four levels each", () => {
  assert.equal(Object.keys(PROFILES).length, 19);
  for (const p of Object.values(PROFILES)) for (const id of p.criteria) assert.equal((CRITERIA as any)[id].anchors.length, 4, id);
});

test("job title picks the track; the employer and two-role titles fall back to the general interview", () => {
  assert.equal(pickProfile({ title: "Software Engineering Intern" }), "software");
  assert.equal(pickProfile({ title: "Quantitative Research Intern" }), "quant");
  assert.equal(pickProfile({ title: "Audit Associate" }), "accounting");
  assert.equal(pickProfile({ title: "Summer Analyst" }), "generic");
  assert.equal(pickProfile({ title: "Marketing and Software Developer" }), "generic");
});

test("AI ratings need a real quote, a known criterion and a level 1-4", () => {
  const answer = "Sales went up but cash flow almost halved, so something is eating the money.";
  const got = checkRatings([
    { criterion: "answer_focus", level: 3, quote: "so something is eating the money", note: "ok" },
    { criterion: "context", level: 4, quote: "I grew revenue 40%", note: "invented" },
    { criterion: "banking_valuation", level: 2, quote: "cash flow almost halved", note: "not in generic" },
    { criterion: "clear_structure", level: 7, quote: "Sales went up", note: "bad level" },
    { criterion: "answer_focus", level: 1, quote: "Sales went up", note: "duplicate" },
  ], answer, "generic");
  assert.deepEqual(got.map((r) => r.criterion), ["answer_focus"]);
});

test("scorecard: no overall until every skill that counts was heard; expert-only role skills stay out of it", () => {
  const iv: Pick<Interview, "profile" | "answers" | "questions"> = { profile: "banking", questions: [{ kind: "posting", q: "x", criteria: ["reflection"] }], answers: [] };
  const ids = PROFILES.banking.criteria.filter((id) => !(CRITERIA as any)[id].expert && !(CRITERIA as any)[id].measurement);
  iv.answers = [{ qi: 0, text: "a", secs: 60, fillers: 2, at: "t", ratings: ids.slice(0, -1).map((criterion) => ({ criterion, level: 3, quote: "a", note: "" })) }];
  const part = scoreInterview(iv);
  assert.equal(part.overall, null);
  assert.equal(part.next!.level, null); // the missing one is "not heard yet", not a low score
  iv.answers[0].ratings.push({ criterion: ids[ids.length - 1], level: 2, quote: "b", note: "" }, { criterion: "banking_valuation", level: 4, quote: "c", note: "" });
  const full = scoreInterview(iv);
  assert.ok(full.overall !== null && full.overall > 40 && full.overall < 67);
  assert.equal(full.dims.find((d) => d.dim === "role_skill")!.expert, true);
  assert.equal(full.next!.criterion, ids[ids.length - 1]);
  assert.equal(full.best!.quote, "c");
});

test("three AI interviews a week; rules-only ones don't count", () => {
  const now = Date.parse("2026-11-23T12:00:00Z");
  const ivs = [{ source: "ai" as const, startedAt: "2026-11-22T00:00:00Z" }, { source: "rules" as const, startedAt: "2026-11-22T00:00:00Z" }, { source: "ai" as const, startedAt: "2026-11-10T00:00:00Z" }];
  assert.equal(weeklyLeft(ivs, now), 2);
  assert.equal(listenFor("quant")[0].label, "Reasoning and decisions");
});
