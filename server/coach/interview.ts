import type { Lang } from "@shared/i18n";
// Owners (Nov 23, Julio's interview coach in Remy): Remy designs the mock interview from the posting and the student's
// own record, and rates each answer against the scoring guide. Prompts and the checks on what the AI returns live
// here; the routes are in server/routes.ts (/api/interviews). Nothing the AI says is kept unless it passes a check:
// ratings need an exact quote (shared/interview.ts checkRatings), and suggested wording must pass the honesty check.
import type { Job, ResumeDoc, Story } from "@shared/types";
import { CRITERIA, PROFILES, type CriterionId, type ProfileId } from "@shared/interviewRubric";
import { checkRatings, saidIt, type IvAnswer, type IvKind, type IvQuestion } from "@shared/interview";
import { jobQuestions } from "@shared/jobInterview";
import { BANK, bankField, companyFacts, fieldLabel } from "@shared/questionBank";
import { STORY_PARTS, storyFor } from "@shared/stories";

const KINDS: IvKind[] = ["warmup", "posting", "resume", "work_sample", "pressure", "yours"];
const s = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const criteriaList = (p: ProfileId) => PROFILES[p].criteria.map((id) => `${id}: ${CRITERIA[id].label} (${CRITERIA[id].description})`).join("\n");

export type PlanInput = { job: Job; profile: ProfileId; resume: string; stories: Story[]; pitch: string };

export function planPrompt({ job, profile, resume, stories, pitch }: PlanInput): [string, string] {
  const ready = stories.filter((x) => STORY_PARTS.every((p) => x[p]));
  const field = bankField(job.title, profile), co = companyFacts(job.company || "");
  const published = [...(co?.asks || []), ...BANK[field].map((b) => b.q)].slice(0, 8);
  return [
    `You are Remy, a friendly career coach running a mock job interview for a college student. Design the interview for THIS opening, the way an interviewer at the company would run it.
Return 6 to 8 questions in order: first a warm-up (kind "warmup", like "Tell me about yourself and why this role"), then 4 to 6 core questions, last "What questions do you have for us?" (kind "yours").
Core question kinds: "posting" (built on a duty or requirement in the posting; put its exact words in "from"), "resume" (about one real line on their resume; put that exact line in "from"), "pressure" (a mistake, conflict or setback), and, when the job's own skills call for it, ONE "work_sample": a short realistic task with a small practice table in "table" (a header row and up to 5 rows of short cells) that is clearly made up for practice.
"hint": one short nudge using ONLY their resume, stories or pitch (which story or line to use), or empty.
"criteria": 2 to 4 ids from the SCORING GUIDE that the question lets the student show; together the core questions should cover every id.
You may use up to 2 PUBLISHED QUESTIONS as core questions (kind "posting" with an empty "from", or "pressure"), reworded to fit this opening. If WHAT THE COMPANY SAYS is given, match that interview format.
Never claim to know the company's real interview questions, values or people, and never say the company asks a question. Never ask about age, family, health, religion, nationality, disability or other personal matters. Plain, spoken English; each question under 40 words.`,
    `OPENING: ${job.title} at ${job.company}\nPOSTING:\n${s([job.summary, ...(job.requirements || []).map((r) => r.quote), job.postingText].filter(Boolean).join("\n"), 5000)}\n\nSCORING GUIDE (${PROFILES[profile].label}):\n${criteriaList(profile)}\n\nPUBLISHED QUESTIONS (common in ${fieldLabel(field, PROFILES[profile].label)} interviews, from university career-office guides${co?.asks ? " and the company's own careers site" : ""}):\n${published.map((q) => `- ${q}`).join("\n") || "(none)"}${co ? `\n\nWHAT THE COMPANY SAYS ABOUT ITS INTERVIEWS (its own careers site): ${co.note}` : ""}\n\nTHEIR RESUME:\n${resume.slice(0, 4000) || "(none)"}\n\nTHEIR STORIES:\n${ready.map((x) => `- ${x.title}: ${x.situation} ${x.action} ${x.result}`).join("\n").slice(0, 2000) || "(none yet)"}\n\nTHEIR PITCH: ${pitch || "(none yet)"}\n\nReturn {"questions":[{"kind":"","q":"","from":"","hint":"","table":[],"criteria":[]}]}`,
  ];
}

/** Keeps a planned interview only if it has the right shape; "from" must really be in the posting or resume, and
 *  hints must pass the honesty check (`ok`). Returns null when too little survives (the rules plan is used then). */
export function checkPlan(raw: any, profile: ProfileId, sources: string, ok: (t: string) => boolean): IvQuestion[] | null {
  const allowed = new Set<string>(PROFILES[profile].criteria);
  const qs: IvQuestion[] = [];
  for (const r of Array.isArray(raw?.questions) ? raw.questions.slice(0, 10) : []) {
    const kind = KINDS.includes(r?.kind) ? (r.kind as IvKind) : null;
    const q = s(r?.q, 300);
    if (!kind || q.length < 8 || qs.some((x) => x.q === q)) continue;
    const from = s(r?.from, 300), hint = s(r?.hint, 200);
    const table = kind === "work_sample" && Array.isArray(r?.table) ? r.table.slice(0, 6).map((row: unknown) => (Array.isArray(row) ? row.slice(0, 4).map((c) => s(c, 40)) : [])).filter((row: string[]) => row.some(Boolean)) : [];
    qs.push({ kind, q, ...(from && saidIt(from, sources) ? { from } : {}), ...(hint && ok(hint) ? { hint } : {}), ...(table.length > 1 ? { table } : {}),
      criteria: (Array.isArray(r?.criteria) ? r.criteria : []).map(String).filter((id: string) => allowed.has(id)).slice(0, 4) as CriterionId[] });
  }
  const core = qs.filter((x) => x.kind !== "warmup" && x.kind !== "yours");
  if (core.length < 3) return null;
  const warm = qs.find((x) => x.kind === "warmup") || WARMUP(profile);
  const yours = qs.find((x) => x.kind === "yours") || YOURS(profile);
  return [warm, ...core.slice(0, 6), yours];
}

const pick = (p: ProfileId, ids: string[]) => ids.filter((id) => (PROFILES[p].criteria as readonly string[]).includes(id)) as CriterionId[];
const WARMUP = (p: ProfileId, hint?: string): IvQuestion => ({ kind: "warmup", q: "Tell me about yourself, and why this role?", ...(hint ? { hint } : {}), criteria: pick(p, ["answer_focus", "clear_structure", "audience_adaptation"]) });
const YOURS = (p: ProfileId): IvQuestion => ({ kind: "yours", q: "What questions do you have for us?", hint: "Ask two: what a strong first month looks like, and what the team is working on now.", criteria: pick(p, ["answer_focus", "problem_framing"]) });

/** Without AI (or after the weekly AI interviews are used): questions from the posting itself, as before. */
export function rulesPlan(job: Job, doc: ResumeDoc | undefined, pitch: string, stories: Story[], profile: ProfileId): IvQuestion[] {
  const ready = stories.filter((x) => STORY_PARTS.every((p) => x[p]));
  const core = jobQuestions(job, doc).slice(0, -1).filter((x, k, all) => all.findIndex((y) => y.q === x.q) === k).slice(0, 4).map((x): IvQuestion => {
    const st = storyFor(x.q + " " + x.why, ready);
    return { kind: x.line ? "resume" : "posting", q: x.q, from: x.line || x.why.replace(/^The posting asks for: /, ""), ...(st ? { hint: `Tell your story: ${st.title}` } : {}),
      criteria: pick(profile, ["context", "ownership", "outcomes", "decision_tradeoffs", "reflection"]) };
  });
  return [WARMUP(profile, pitch ? "Start from your pitch, then add why this role." : undefined), ...core,
    { kind: "pressure", q: "Tell me about a time something went wrong. What did you do, and what did you change after?", criteria: pick(profile, ["reflection", "uncertainty", "ownership"]) },
    YOURS(profile)];
}

// Julio's level-4 anchors are written for experienced hires ("acknowledges attribution limits"), so a student's best
// answer never reached Strong (interview test lab, Nov 27: 0 of 43 strong answers). The prompt uses student-level 4s
// for the criteria most answers touch; the catalog itself is unchanged.
const STUDENT_TOP: Partial<Record<CriterionId, string>> = {
  context: "Sets up the situation briefly with the one detail that matters (a number, a deadline, who was involved).",
  ownership: "Makes clear exactly what they did themselves, step by step, and credits others where it's due.",
  outcomes: "Says what happened with something concrete (a number, a before and after, someone's reaction) and ties it to the goal.",
  reflection: "Says what they learned and something they now do differently because of it.",
  answer_focus: "Answers the question directly up front and stays on it.",
  clear_structure: "Easy to follow from start to finish, ending on a clear point.",
  decision_tradeoffs: "Names the options they weighed, why they picked one, and what they gave up.",
  problem_framing: "States the goal, what made it hard, and what they needed to find out first.",
};
const anchorsFor = (id: CriterionId) => CRITERIA[id].anchors.map((a, i) => (i === 3 && STUDENT_TOP[id]) || a);

export function feedbackPrompt(profile: ProfileId, q: IvQuestion, answer: string, before?: IvAnswer, lang?: Lang): [string, string] {
  const ids = [...new Set([...q.criteria, ...PROFILES[profile].criteria])].slice(0, 14) as CriterionId[];
  return [
    `You are Remy, a warm, honest interview coach for a college student. Rate ONE answer from a mock interview against the scoring guide.
Rate only criteria this answer actually shows; skip the rest (not heard is not a low score). For each rating give the level 1-4 whose description fits best, an EXACT quote of 4 to 25 words copied from the answer, and a one-line note in plain words.
Never judge accent, filler words, pauses, nerves, personality or looks. Don't assume facts they didn't say.
If they tell an unsafe, dishonest, rule-breaking or privacy-breaking action as a success, rate the criteria it touches 1 and name it plainly in "sharpen".
Students answer in every style: lazy or one-line, vague, rambling, off-topic, joking, overconfident or bragging, negative about a past boss, made-up sounding, or refusing ("I don't know", "pass"). Coach each one kindly and directly: if it doesn't answer the question, say so plainly in "sharpen"; if it is vague, ask for one real example; if it rambles, ask for the point first. Always return "sharpen".
"landed": the best thing they said, as an exact quote, and why it works (one sentence). Only something an interviewer would really like: never a brag, a complaint, a joke, a refusal or the question repeated back. If nothing works yet, leave "landed" empty.
${lang && lang.code !== "en" ? `The student reads tips in ${lang.english}: write every "note", the "why" and the "sharpen" title in ${lang.english}. Quotes stay exactly as they said them. Write "example" in English, since the real interview is in English.` : "Write every note in English, even if the answer is in another language (then suggest answering in English)."}
"sharpen": the single most useful fix as a short title, plus "example": how they could say it, using ONLY facts already in their answer (no new numbers, names or results). If the answer has no facts to reuse, "example" is a short fill-in frame with [brackets] for what they should add, like "Last semester I [what you did], and [what happened]."${before ? `\nThis is a second try. Their first try and Remy's tip are given; rate "feedback_iteration" if the guide has it.` : ""}`,
    `QUESTION: ${q.q}${q.table ? `\nPRACTICE TABLE: ${q.table.map((r) => r.join(" | ")).join(" / ")}` : ""}\n\nSCORING GUIDE:\n${ids.map((id) => `${id}: ${CRITERIA[id].label}. Levels: ${anchorsFor(id).map((a, i) => `${i + 1}) ${a}`).join(" ")}`).join("\n")}${before ? `\n\nFIRST TRY: ${before.text}\nREMY'S TIP THEN: ${before.sharpen?.title || ""}` : ""}\n\nTHEIR ANSWER: ${answer}\n\nReturn {"ratings":[{"criterion":"","level":1,"quote":"","note":""}],"landed":{"quote":"","why":""},"sharpen":{"title":"","example":""}}`,
  ];
}

/** Remy's take on an answer too short to rate (under 5 words, like "a lot" or "idk"), without AI: what the question
 *  wants and a fill-in frame. Shown in place of "I couldn't rate this one". */
export function thinAnswerTip(q: IvQuestion, answer: string): NonNullable<IvAnswer["sharpen"]> {
  const said = s(answer, 40);
  const lead = said ? `“${said}” is too short for an interviewer to go on.` : "That one was too short for an interviewer to go on.";
  if (q.kind === "yours") return { title: `${lead} Always ask at least one question back.`, example: "What does a strong first month look like in this role, and what is the team working on right now?" };
  if (q.kind === "warmup") return { title: `${lead} Say who you are, one thing you've done, and why this role.`, example: "I'm a [year] studying [major]. Last [semester or summer] I [one thing you did], and that's why [this role] interests me." };
  if (q.kind === "work_sample") return { title: `${lead} Walk through it out loud: what you'd look at first, what you notice, and what you'd do next.`, example: "First I'd look at [one column], because [why]. I notice [one thing], so next I'd [one step]." };
  return { title: `${lead} Answer with one real example: the situation, what you did, and what happened.`, example: "At [place or class], [the situation]. I [what you did], and [what happened because of it]." };
}

// The honesty check reads an example without its coaching parts: "[what you did]" blanks and "in one or two
// sentences" are instructions, not claimed facts (AI test, Nov 27: 23% of examples were dropped for these).
const coachingOnly = (t: string) => t.replace(/\[[^\]]*\]/g, " ").replace(/\b(?:one|two|three)(?: or (?:two|three))? (?:sentences?|minutes?|seconds?|parts?|things|examples?|questions?|points?)\b/gi, " ");
/** What survives of the AI's feedback: quote-backed ratings, a real "landed" quote, and wording that passes `ok`. */
export function checkFeedback(raw: any, answer: string, profile: ProfileId, ok: (t: string) => boolean): Pick<IvAnswer, "ratings" | "landed" | "sharpen"> {
  const ratings = checkRatings(raw?.ratings, answer, profile);
  const lq = s(raw?.landed?.quote, 300), why = s(raw?.landed?.why, 240), title = s(raw?.sharpen?.title, 160), example = s(raw?.sharpen?.example, 400);
  return {
    ratings,
    // Praise only when Remy also heard something at least "Getting there" (AI test, Nov 27: most bad answers got praise).
    ...(lq && why && saidIt(lq, answer) && ratings.some((r) => r.level >= 2) ? { landed: { quote: lq, why } } : {}),
    ...(title ? { sharpen: { title, ...(example && ok(coachingOnly(example)) ? { example } : {}) } } : {}),
  };
}
