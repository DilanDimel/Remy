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

test("Remy's planned interview: shape checked, 'from' must be in the posting, hints must pass the honesty check", async () => {
  const { checkPlan, rulesPlan, checkFeedback } = await import("./interview");
  const posting = "Analyze borrower financial statements. Build credit memos.";
  const raw = { questions: [
    { kind: "warmup", q: "Tell me about yourself and why banking?", criteria: ["answer_focus", "made_up"] },
    { kind: "posting", q: "How would you judge if a small business can repay a loan?", from: "Analyze borrower financial statements", hint: "Use your club budget model", criteria: ["problem_framing"] },
    { kind: "posting", q: "Walk me through a credit memo you wrote at Goldman.", from: "Wrote memos at Goldman", criteria: ["context"] },
    { kind: "work_sample", q: "Here's a cash flow summary. What worries you?", table: [["", "2024", "2025"], ["Cash flow", "$38k", "$21k"]], criteria: ["uncertainty"] },
    { kind: "pressure", q: "A time you found a mistake in your numbers.", criteria: ["reflection"] },
    { kind: "nonsense", q: "Ignored question here", criteria: [] },
  ] };
  const qs = checkPlan(raw, "generic", posting, (t) => !/Goldman/.test(t))!;
  assert.deepEqual(qs.map((q) => q.kind), ["warmup", "posting", "posting", "work_sample", "pressure", "yours"]);
  assert.deepEqual(qs[0].criteria, ["answer_focus"]);
  assert.equal(qs[1].from, "Analyze borrower financial statements");
  assert.equal(qs[2].from, undefined); // not in the posting or resume
  assert.equal(qs[3].table!.length, 2);
  assert.equal(checkPlan({ questions: raw.questions.slice(0, 2) }, "generic", posting, () => true), null);
  const job = { id: "j", company: "Frost", title: "Credit Analyst Intern", summary: "", requirements: [] } as any;
  const rules = rulesPlan(job, undefined, "", [], "generic");
  assert.equal(rules[0].kind, "warmup"); assert.equal(rules.at(-1)!.kind, "yours");
  const fb = checkFeedback({ ratings: [{ criterion: "answer_focus", level: 3, quote: "cash flow almost halved", note: "x" }], landed: { quote: "I grew sales 40%", why: "big" }, sharpen: { title: "Say the number", example: "It dropped 90%." } },
    "Sales went up but cash flow almost halved.", "generic", (t) => !/90%/.test(t));
  assert.equal(fb.ratings.length, 1); assert.equal(fb.landed, undefined); assert.deepEqual(fb.sharpen, { title: "Say the number" });
});
