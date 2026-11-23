// Owners (Nov 23, Julio's interview coach in Remy): Remy designs the mock interview from the posting and the student's
// own record, and rates each answer against the scoring guide. Prompts and the checks on what the AI returns live
// here; the routes are in server/routes.ts (/api/interviews). Nothing the AI says is kept unless it passes a check:
// ratings need an exact quote (shared/interview.ts checkRatings), and suggested wording must pass the honesty check.
import type { Job, ResumeDoc, Story } from "@shared/types";
import { CRITERIA, PROFILES, type CriterionId, type ProfileId } from "@shared/interviewRubric";
import { checkRatings, saidIt, type IvAnswer, type IvKind, type IvQuestion } from "@shared/interview";
import { jobQuestions } from "@shared/jobInterview";
import { STORY_PARTS, storyFor } from "@shared/stories";

const KINDS: IvKind[] = ["warmup", "posting", "resume", "work_sample", "pressure", "yours"];
const s = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const criteriaList = (p: ProfileId) => PROFILES[p].criteria.map((id) => `${id}: ${CRITERIA[id].label} (${CRITERIA[id].description})`).join("\n");

export type PlanInput = { job: Job; profile: ProfileId; resume: string; stories: Story[]; pitch: string };

export function planPrompt({ job, profile, resume, stories, pitch }: PlanInput): [string, string] {
  const ready = stories.filter((x) => STORY_PARTS.every((p) => x[p]));
  return [
    `You are Remy, a friendly career coach running a mock job interview for a college student. Design the interview for THIS opening, the way an interviewer at the company would run it.
Return 6 to 8 questions in order: first a warm-up (kind "warmup", like "Tell me about yourself and why this role"), then 4 to 6 core questions, last "What questions do you have for us?" (kind "yours").
Core question kinds: "posting" (built on a duty or requirement in the posting; put its exact words in "from"), "resume" (about one real line on their resume; put that exact line in "from"), "pressure" (a mistake, conflict or setback), and, when the job's own skills call for it, ONE "work_sample": a short realistic task with a small practice table in "table" (a header row and up to 5 rows of short cells) that is clearly made up for practice.
"hint": one short nudge using ONLY their resume, stories or pitch (which story or line to use), or empty.
"criteria": 2 to 4 ids from the SCORING GUIDE that the question lets the student show; together the core questions should cover every id.
Never claim to know the company's real interview questions, values or people. Never ask about age, family, health, religion, nationality, disability or other personal matters. Plain, spoken English; each question under 40 words.`,
    `OPENING: ${job.title} at ${job.company}\nPOSTING:\n${s([job.summary, ...(job.requirements || []).map((r) => r.quote), job.postingText].filter(Boolean).join("\n"), 5000)}\n\nSCORING GUIDE (${PROFILES[profile].label}):\n${criteriaList(profile)}\n\nTHEIR RESUME:\n${resume.slice(0, 4000) || "(none)"}\n\nTHEIR STORIES:\n${ready.map((x) => `- ${x.title}: ${x.situation} ${x.action} ${x.result}`).join("\n").slice(0, 2000) || "(none yet)"}\n\nTHEIR PITCH: ${pitch || "(none yet)"}\n\nReturn {"questions":[{"kind":"","q":"","from":"","hint":"","table":[],"criteria":[]}]}`,
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

export function feedbackPrompt(profile: ProfileId, q: IvQuestion, answer: string, before?: IvAnswer): [string, string] {
  const ids = [...new Set([...q.criteria, ...PROFILES[profile].criteria])].slice(0, 14) as CriterionId[];
  return [
    `You are Remy, a warm, honest interview coach for a college student. Rate ONE answer from a mock interview against the scoring guide.
Rate only criteria this answer actually shows; skip the rest (not heard is not a low score). For each rating give the level 1-4 whose description fits best, an EXACT quote of 4 to 25 words copied from the answer, and a one-line note in plain words.
Never judge accent, filler words, pauses, nerves, personality or looks. Don't assume facts they didn't say.
"landed": the best thing they said, as an exact quote, and why it works (one sentence).
"sharpen": the single most useful fix as a short title, plus "example": how they could say it, using ONLY facts already in their answer (no new numbers, names or results).${before ? `\nThis is a second try. Their first try and Remy's tip are given; rate "feedback_iteration" if the guide has it.` : ""}`,
    `QUESTION: ${q.q}${q.table ? `\nPRACTICE TABLE: ${q.table.map((r) => r.join(" | ")).join(" / ")}` : ""}\n\nSCORING GUIDE:\n${ids.map((id) => `${id}: ${CRITERIA[id].label}. Levels: ${CRITERIA[id].anchors.map((a, i) => `${i + 1}) ${a}`).join(" ")}`).join("\n")}${before ? `\n\nFIRST TRY: ${before.text}\nREMY'S TIP THEN: ${before.sharpen?.title || ""}` : ""}\n\nTHEIR ANSWER: ${answer}\n\nReturn {"ratings":[{"criterion":"","level":1,"quote":"","note":""}],"landed":{"quote":"","why":""},"sharpen":{"title":"","example":""}}`,
  ];
}

/** What survives of the AI's feedback: quote-backed ratings, a real "landed" quote, and wording that passes `ok`. */
export function checkFeedback(raw: any, answer: string, profile: ProfileId, ok: (t: string) => boolean): Pick<IvAnswer, "ratings" | "landed" | "sharpen"> {
  const lq = s(raw?.landed?.quote, 300), why = s(raw?.landed?.why, 240), title = s(raw?.sharpen?.title, 160), example = s(raw?.sharpen?.example, 400);
  return {
    ratings: checkRatings(raw?.ratings, answer, profile),
    ...(lq && why && saidIt(lq, answer) ? { landed: { quote: lq, why } } : {}),
    ...(title ? { sharpen: { title, ...(example && ok(example) ? { example } : {}) } } : {}),
  };
}
