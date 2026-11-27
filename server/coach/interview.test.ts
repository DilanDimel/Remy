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

test("an answer too short to rate still gets Remy's take: their words, what the question wants, a fill-in frame", async () => {
  const { thinAnswerTip } = await import("./interview");
  const q = (kind: any) => ({ kind, q: "Tell me about a time you led a team.", criteria: [] });
  const core = thinAnswerTip(q("posting"), "a lot");
  assert.match(core.title, /^“a lot” is too short/);
  assert.match(core.title, /one real example/);
  assert.match(core.example!, /\[what you did\]/);
  assert.match(thinAnswerTip(q("yours"), "no").title, /ask at least one question/);
  assert.match(thinAnswerTip(q("warmup"), "idk").title, /who you are/);
  assert.match(thinAnswerTip(q("pressure"), "").title, /^That one was too short/);
});

test("AI test, Nov 27: no praise for an answer Remy rated Not yet; blanks and 'one or two sentences' aren't claims", async () => {
  const { checkFeedback } = await import("./interview");
  const answer = "Ha, the only thing that ever went wrong was when the coffee machine broke. Total disaster.";
  const ok = (t: string) => !/\btwo\b|Fill/.test(t); // stands in for the honesty check, which flags number words and new names
  const raw = (level: number) => ({ ratings: [{ criterion: "answer_focus", level, quote: "the coffee machine broke", note: "x" }], landed: { quote: "the coffee machine broke", why: "funny" },
    sharpen: { title: "Pick a real moment", example: "Say what went wrong in one or two sentences: [Fill in the moment], then what you did." } });
  const bad = checkFeedback(raw(1), answer, "generic", ok);
  assert.equal(bad.landed, undefined);
  assert.ok(bad.sharpen?.example);
  assert.ok(checkFeedback(raw(2), answer, "generic", ok).landed);
});

test("scoring prompt grades students against student-level 4s and calls out unsafe stories (interview persona test)", async () => {
  const { feedbackPrompt } = await import("./interview");
  const [sys, user] = feedbackPrompt("generic", { kind: "posting", q: "Tell me about a time you fixed a mistake.", criteria: ["outcomes", "reflection"] } as any, "I caught a shipping error at work and fixed it before the order went out.");
  assert.match(user, /4\) Says what they learned and something they now do differently/);
  assert.doesNotMatch(user, /acknowledges attribution limits/);
  assert.match(sys, /unsafe, dishonest/);
});

test("coach Practice: 20 rated tries a week, the four story parts, and practiced only when all four are heard", async () => {
  const { drillsLeft, starParts, practiced, WEEKLY_DRILLS } = await import("@shared/interview");
  const { drillQuestion } = await import("./interview");
  const now = Date.parse("2026-11-27T12:00:00Z");
  const old = "2026-11-10T12:00:00Z", recent = "2026-11-26T12:00:00Z";
  assert.equal(drillsLeft([{ rated: [old, recent, recent] }, { rated: [recent] }], now), WEEKLY_DRILLS - 3);
  assert.equal(drillsLeft(undefined, now), WEEKLY_DRILLS);
  const r = (criterion: string, level: number) => ({ criterion, level, quote: "x", note: "" }) as any;
  const parts = starParts([r("context", 3), r("ownership", 2), r("outcomes", 1)]);
  assert.deepEqual(parts.map((p) => p.state), ["heard", "thin", "missing", "missing"]);
  assert.equal(practiced({ ratings: [r("context", 3), r("ownership", 4), r("outcomes", 3), r("reflection", 3)] }), true);
  assert.equal(practiced({ ratings: [r("context", 3), r("ownership", 4), r("outcomes", 3)] }), false);
  assert.deepEqual(drillQuestion("Tell me about a time you led a team.", "generic").criteria.every((c) => ["context", "ownership", "outcomes", "reflection"].includes(c)), true);
});

test("coach pitch slots: only profile and resume facts, saved slots win; the 3-day plan fits the days left", async () => {
  const { pitchSlots, spoken, interviewPlan } = await import("@shared/interviewCoach");
  const w: any = { profile: { school: "TCU", classYear: "Sophomore", major: "Finance", targetRoles: "Investment Banking Analyst, Analyst" },
    resume: { doc: { sections: [{ heading: "Experience", entries: [{ role: "Treasurer", org: "Finance Club", bullets: [{ text: "Ran meetings" }, { text: "Built a budget tracker that found $1,200." }] }] }] } } };
  const s = pitchSlots(w, "Jordan");
  assert.deepEqual(s.map((x) => x[1]), ["Hi, I'm Jordan, a sophomore at TCU.", "I study Finance.", "As Treasurer at Finance Club, I built a budget tracker that found $1,200.", "I'm looking for an internship as an Investment Banking Analyst."]);
  assert.equal(s[2][2], "Resume · Treasurer, Finance Club");
  w.pitch = { text: "Hi. I study Finance.", at: "t", slots: ["Hi.", "I study Finance.", "", ""] };
  assert.equal(pitchSlots(w, "Jordan")[0][1], "Hi.");
  w.pitch.text = "Something Remy drafted.";
  assert.equal(pitchSlots(w, "Jordan")[0][1], "Hi, I'm Jordan, a sophomore at TCU."); // stale slots ignored
  assert.deepEqual(spoken("one two three four five"), { words: 5, secs: 2 });
  const base: any = { tracker: [{ id: "t1", company: "Deloitte", role: "Analyst", status: "Interview" }], calendar: [], drills: [], interviews: [] };
  assert.equal(interviewPlan({ ...base, tracker: [] }, "2026-11-27"), null);
  assert.deepEqual(interviewPlan(base, "2026-11-27")!.days.map((d) => d.day), ["Today", "Tomorrow", "Sunday"]);
  const far = interviewPlan({ ...base, calendar: [{ kind: "Interview", date: "2026-12-03", linkedId: "t1" }] }, "2026-11-27")!;
  assert.deepEqual(far.days.map((d) => d.day), ["Monday", "Tuesday", "Wednesday"]);
  assert.match(far.when, /Thursday, Dec 3/);
  const soon = interviewPlan({ ...base, calendar: [{ kind: "Interview", date: "2026-11-28", linkedId: "t1" }], pitch: { text: "x" } }, "2026-11-27")!;
  assert.deepEqual(soon.days.map((d) => [d.day, d.done]), [["Today", true], ["Today", false], ["Today", false]]);
});
