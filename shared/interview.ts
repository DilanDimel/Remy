// Owners (Nov 23, Julio's interview coach in Remy): the mock interview's shapes and the honest scoring rules.
// The scoring guide itself (19 role profiles, 48 criteria, four levels each) is shared/interviewRubric.ts.
// Rules kept from Julio's engine: a rating needs an exact quote from the student's answer; a skill nobody heard stays
// "Not heard yet" (never a low score); the overall shows only once every skill that counts was heard; accent, nerves
// and looks are never graded.
import type { Job } from "./types";
import { CRITERIA, PROFILES, type CriterionId, type Dimension, type ProfileId } from "./interviewRubric";

export type IvMode = "coach" | "real";
export type IvKind = "warmup" | "posting" | "resume" | "work_sample" | "pressure" | "yours";
export interface IvQuestion {
  kind: IvKind;
  q: string;
  /** Where it came from: a posting quote or a resume line, shown under the question. */
  from?: string;
  /** Hint from the student's own record (resume line, story, pitch). */
  hint?: string;
  /** A work sample's practice material, made up for the exercise: a header row, then up to 5 rows. */
  table?: string[][];
  criteria: CriterionId[];
}
export interface IvRating { criterion: CriterionId; level: 1 | 2 | 3 | 4; quote: string; note: string }
export interface IvAnswer {
  qi: number;
  text: string;
  secs: number;
  fillers: number;
  at: string;
  ratings: IvRating[];
  landed?: { quote: string; why: string };
  sharpen?: { title: string; example?: string };
}
export interface Interview {
  id: string;
  jobId: string;
  company: string;
  title: string;
  profile: ProfileId;
  mode: IvMode;
  /** "ai": Remy designed it and gives feedback (counts toward the weekly limit); "rules": no AI on this server. */
  source: "ai" | "rules";
  questions: IvQuestion[];
  /** Latest attempt per question (a retry replaces it). */
  answers: IvAnswer[];
  retries: number;
  aiCalls: number;
  startedAt: string;
  finishedAt?: string;
}

export const WEEKLY_AI_INTERVIEWS = 3;
export const AI_CALLS_PER_INTERVIEW = 16;
export const LEVEL_WORD = ["", "Not yet", "Getting there", "Solid", "Strong"] as const;
const ROLE_WORD: Partial<Record<ProfileId, string>> = {
  sales: "Sales", quant: "Quant", software: "Coding", design: "Design", marketing: "Marketing", cybersecurity: "Security",
  consulting: "Case", banking: "Banking", investment_research: "Investing", accounting: "Accounting", legal: "Legal",
  manufacturing: "Production", aerospace: "Engineering", research: "Research", healthcare: "Patient care", education: "Teaching",
  hospitality: "Guest service", public_policy: "Policy",
};
/** Plain words for each part of the score (Dilan: no jargon). */
export function dimensionLabel(d: Dimension, profile: ProfileId) {
  return ({ relevance: "Answering what was asked", evidence: "Specific, real details", reasoning: "Reasoning and decisions",
    role_skill: `${ROLE_WORD[profile] || "Job"} know-how`, learning: "Learning from mistakes", communication: "Clear, organized answers" })[d];
}

// Title rules from Julio's role resolver (server/interviewRole.ts there), titles only: the employer's name and
// generic skills never pick the track. No match, or two matches, is the general interview.
const TITLES: [ProfileId, RegExp][] = [
  ["sales", /\b(?:sales(?!force)|account executive|business development (?:representative|associate|intern|manager)|relationship manager)\b/],
  ["quant", /\b(?:quant|quantitative (?:intern|analyst|research|trader|trading|strategist)|(?:systematic|algorithmic) trad)/],
  ["investment_research", /\b(?:equity research|investment (?:research )?(?:analyst|intern))/],
  ["software", /\b(?:software (?:engineer(?:ing)?|developer|development|intern)|(?:front\s?end|back\s?end|full\s?stack|web|mobile) (?:engineer|developer)|developer|programmer|machine learning engineer)\b/],
  ["banking", /\b(?:investment bank|m\s*&\s*a\b|mergers|transaction advisory|valuation)/],
  ["accounting", /\b(?:accountant|accounting|auditor|audit (?:associate|analyst|intern)|bookkeeper|tax|assurance|controller(?:ship)?)\b/],
  ["cybersecurity", /\b(?:cyber[\s-]?security|information security|security (?:analyst|engineer)|soc analyst|penetration tester)\b/],
  ["marketing", /\b(?:marketing|brand (?:manager|strategist)|market research|social media)\b/],
  ["design", /\b(?:product design|ux|ui designer|user experience|interaction design)/],
  ["consulting", /\b(?:consultant|consulting)\b/],
  ["legal", /\b(?:lawyer|attorney|paralegal|legal (?:intern|assistant|counsel))\b/],
  ["manufacturing", /\b(?:manufacturing|production|industrial|process|quality) (?:engineer|technician|operator|intern)/],
  ["aerospace", /\b(?:aerospace|aeronautical|avionics) (?:engineer|technician|intern)/],
  ["healthcare", /\b(?:nurse|nursing|physician|clinical (?:assistant|practitioner)|patient care)\b/],
  ["education", /\b(?:teacher|teaching|educator|tutor)\b/],
  ["hospitality", /\b(?:front desk|guest (?:services|relations)|hospitality|concierge|customer service)\b/],
  ["public_policy", /\b(?:public policy|policy (?:analyst|advisor|intern)|public affairs)\b/],
  ["research", /\b(?:research (?:intern|assistant|associate|scientist|fellow)|scientist)\b/],
];
export function pickProfile(job: Pick<Job, "title">): ProfileId {
  const t = job.title.toLowerCase();
  const hits = TITLES.filter(([, re]) => re.test(t)).map(([id]) => id);
  // "Quantitative research intern" is one quant role, not quant + research.
  const ids = hits.length > 1 ? hits.filter((id) => id !== "research") : hits;
  return ids.length === 1 ? ids[0] : "generic";
}

/** Criteria a one-on-one mock interview can hear. Ones that need another person's turns (role-play, listening) or a
 *  second try count when heard but never hold back the overall. */
const blocking = (id: CriterionId) => { const c = CRITERIA[id] as { measurement?: string; expert?: boolean; dimension: Dimension }; return !c.measurement && !c.expert; };
export const profileCriteria = (p: ProfileId) => PROFILES[p].criteria as readonly CriterionId[];

const norm = (s: string) => s.toLowerCase().replace(/[“”"‘’'`]/g, "").replace(/[^a-z0-9$%.]+/g, " ").trim();
/** Trust boundary for AI ratings: known criterion of this profile, level 1–4, and a quote the student really said. */
export function checkRatings(raw: unknown, answer: string, profile: ProfileId): IvRating[] {
  const allowed = new Set(profileCriteria(profile));
  const said = norm(answer);
  const out: IvRating[] = [];
  for (const r of Array.isArray(raw) ? raw.slice(0, 12) : []) {
    const criterion = String(r?.criterion || "") as CriterionId;
    const level = Number(r?.level);
    const quote = String(r?.quote || "").trim().slice(0, 300);
    if (!allowed.has(criterion) || ![1, 2, 3, 4].includes(level) || norm(quote).length < 4 || !said.includes(norm(quote))) continue;
    if (out.some((x) => x.criterion === criterion)) continue;
    out.push({ criterion, level: level as IvRating["level"], quote, note: String(r?.note || "").trim().slice(0, 240) });
  }
  return out;
}
/** A quote is kept only if the student said it. */
export const saidIt = (quote: string, answer: string) => norm(quote).length >= 4 && norm(answer).includes(norm(quote));

export interface Scorecard {
  dims: { dim: Dimension; label: string; weight: number; score: number | null; level: number; expert: boolean }[];
  overall: number | null;
  answered: number;
  avgSecs: number;
  fillers: number;
  best?: { quote: string; qi: number };
  next?: { criterion: CriterionId; label: string; qi: number; level: number | null; tip: string };
}
const pct = (level: number) => ((level - 1) / 3) * 100;

/** The scorecard, from the latest attempt at each question. Each criterion keeps its best rating across answers. */
export function scoreInterview(iv: Pick<Interview, "profile" | "answers" | "questions">): Scorecard {
  const ids = profileCriteria(iv.profile);
  const best = new Map<CriterionId, IvRating & { qi: number }>();
  for (const a of iv.answers) for (const r of a.ratings) if ((best.get(r.criterion)?.level || 0) < r.level) best.set(r.criterion, { ...r, qi: a.qi });
  const weights = PROFILES[iv.profile].weights as Record<Dimension, number>;
  const dims = (Object.keys(weights) as Dimension[]).filter((d) => weights[d] > 0).map((dim) => {
    const cs = ids.filter((id) => CRITERIA[id].dimension === dim);
    const heard = cs.filter((id) => best.has(id));
    const expert = cs.every((id) => !blocking(id));
    const complete = cs.filter(blocking).every((id) => best.has(id)) && heard.length > 0;
    const score = complete ? heard.reduce((s, id) => s + pct(best.get(id)!.level), 0) / heard.length : null;
    return { dim, label: dimensionLabel(dim, iv.profile), weight: weights[dim], score, level: score === null ? 0 : Math.round(score / (100 / 3)) + 1, expert };
  });
  // Role skills an expert would have to confirm are shown as Remy's read but stay out of the overall (Julio's rule).
  const counted = dims.filter((d) => !d.expert);
  const overall = counted.length && counted.every((d) => d.score !== null)
    ? Math.round(counted.reduce((s, d) => s + d.score! * d.weight, 0) / counted.reduce((s, d) => s + d.weight, 0)) : null;
  const done = iv.answers.filter((a) => a.text.trim());
  const top = [...best.values()].filter((r) => r.level >= 3).sort((a, b) => b.level - a.level)[0];
  // One thing for next time: the weakest heard skill that counts, else one not heard yet.
  const weak = [...best.values()].filter((r) => blocking(r.criterion) && r.level <= 2).sort((a, b) => a.level - b.level)[0];
  const unheard = ids.find((id) => blocking(id) && !best.has(id));
  const pick = weak?.criterion || unheard;
  const qi = weak ? weak.qi : Math.max(0, iv.questions.findIndex((q) => pick && q.criteria.includes(pick)));
  return {
    dims, overall, answered: done.length,
    avgSecs: done.length ? Math.round(done.reduce((s, a) => s + a.secs, 0) / done.length) : 0,
    fillers: done.reduce((s, a) => s + a.fillers, 0),
    ...(top ? { best: { quote: top.quote, qi: top.qi } } : {}),
    ...(pick ? { next: { criterion: pick, label: CRITERIA[pick].label, qi, level: weak ? weak.level : null, tip: CRITERIA[pick].exercise } } : {}),
  };
}

/** AI interviews started in the last 7 days, and how many are left. */
export function weeklyLeft(ivs: Pick<Interview, "source" | "startedAt">[] | undefined, now = Date.now()) {
  const used = (ivs || []).filter((x) => x.source === "ai" && now - Date.parse(x.startedAt) < 7 * 864e5).length;
  return Math.max(0, WEEKLY_AI_INTERVIEWS - used);
}

/** The three biggest parts of this job's score, for "What I'll listen for". */
export function listenFor(p: ProfileId) {
  const w = PROFILES[p].weights as Record<Dimension, number>;
  return (Object.keys(w) as Dimension[]).filter((d) => w[d] > 0).sort((a, b) => w[b] - w[a]).slice(0, 3).map((d) => ({ label: dimensionLabel(d, p), weight: w[d] }));
}

/** Practice drills (the coach's Practice step): one question, one answer, Remy's take, try again. Newest last, at most 60. */
export interface Drill extends Omit<IvAnswer, "qi"> { id: string; q: string; jobId?: string; tries: number;
  /** When Remy rated a try (each counts toward the weekly limit), at most the last 20. */
  rated: string[]; }
export const WEEKLY_DRILLS = 20;
export function drillsLeft(drills: Pick<Drill, "rated">[] | undefined, now = Date.now()) {
  const used = (drills || []).flatMap((d) => d.rated || []).filter((t) => now - Date.parse(t) < 7 * 864e5).length;
  return Math.max(0, WEEKLY_DRILLS - used);
}
/** The four parts of a strong story answer, from Remy's ratings: heard (Solid or better), thin, or missing. */
export const STAR_PARTS = [["context", "Situation"], ["ownership", "Your part"], ["outcomes", "Result"], ["reflection", "Lesson"]] as const;
export function starParts(ratings: IvRating[]) {
  return STAR_PARTS.map(([id, label]) => {
    const r = ratings.find((x) => x.criterion === id);
    return { id, label, state: !r || r.level <= 1 ? "missing" as const : r.level === 2 ? "thin" as const : "heard" as const };
  });
}
/** A drill counts as practiced once Remy heard all four parts. */
export const practiced = (d: Pick<Drill, "ratings">) => starParts(d.ratings).every((p) => p.state === "heard");
