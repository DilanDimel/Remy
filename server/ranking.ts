import { createHash } from "node:crypto";
import type { Job, JobInterest, JobInterestContext, JobRanking, Workspace } from "@shared/types";
import { families, family } from "@shared/words";

export const RANKING_VERSION = "interest-v1";
export const interestEnabled = () => process.env.OR_JOB_INTEREST_ENABLED !== "false";

const clean = (s: string | undefined) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
const validRating = (f: JobInterest | undefined): f is JobInterest => !!f && Number.isInteger(f.rating) && f.rating >= 1 && f.rating <= 5;
const mean = (values: number[]) => values.reduce((sum, n) => sum + n, 0) / values.length;
const rounded = (n: number) => Math.round(n * 100) / 100;

/** A snapshot of the professional preferences that can make an old rating less relevant. */
export function interestContext(ws: Workspace, job: Job, at: string): JobInterestContext {
  const { major = "", targetRoles = "", interests = "", classYear = "", regions = "", opportunityTypes = "" } = ws.profile;
  const profile = { major, targetRoles, interests, classYear, regions, opportunityTypes };
  // Free-text interests are left out of the key: editing them shouldn't silently switch off past likes and passes.
  const { interests: _free, ...keyed } = profile;
  const profileKey = createHash("sha256").update(JSON.stringify(Object.values(keyed).map(clean))).digest("hex").slice(0, 24);
  const { title, company, location, format, kind } = job;
  return { rankingVersion: RANKING_VERSION, profileKey, profile, job: { title, company, location, format, kind }, capturedAt: at };
}

// Keep the actual role words ("software engineer", "financial analyst"); omit seasons and seniority.
const GENERIC = new Set(["intern", "internship", "summer", "spring", "fall", "winter", "student", "junior", "senior", "entry", "level", "graduate", "new", "job", "role", "the", "and", "for", "of"].map(family));
const roleWords = (title: string) => [...families(title)].filter((w) => w.length > 2 && !GENERIC.has(w));
function sameRole(a: JobInterestContext["job"], b: Job): boolean {
  if (a.kind !== b.kind) return false;
  const x = roleWords(a.title), y = roleWords(b.title);
  if (!x.length || !y.length) return false;
  const common = x.filter((w) => y.includes(w)).length;
  return common / new Set([...x, ...y]).size >= 0.75;
}
function placeKey(s: string) {
  const key = clean(s).replace(/[,.;]/g, " ").replace(/\s+/g, " ").trim();
  return /^(not stated|unknown|not specified|multiple locations|\d+ locations?)$/.test(key) ? "" : key;
}
function formatKey(s: string) {
  const text = clean(s), kinds = [/(?:^|\W)remote(?:$|\W)/.test(text), /(?:^|\W)hybrid(?:$|\W)/.test(text), /\bin[ -]person\b|\bon[ -]?site\b/.test(text)];
  return kinds.filter(Boolean).length === 1 ? ["remote", "hybrid", "in person"][kinds.indexOf(true)] : "";
}
function matchesReason(f: JobInterest, job: Job): boolean {
  const source = f.context.job;
  switch (f.reason) {
    case "role": return sameRole(source, job);
    case "company": return !!clean(source.company) && clean(source.company) === clean(job.company);
    case "location": return !!placeKey(source.location) && placeKey(source.location) === placeKey(job.location);
    case "format": return !!formatKey(source.format) && formatKey(source.format) === formatKey(job.format);
    // Pay and requirements have no reliable comparable values in the captured snapshot.
    default: return false;
  }
}

/** Saving is weak interest; a confirmed Applied event is also weak interest, never an outcome bonus. */
export function weakInterestJobIds(ws: Workspace, enabled = interestEnabled()): Set<string> {
  const ids = new Set(ws.savedJobIds || []);
  for (const item of ws.tracker || []) {
    if (item.jobId && item.events.some((e) => e.status === "Applied" && /^(manual\b|check-in$|pasted by student\b|email \(pasted\))/i.test(e.source))) ids.add(item.jobId);
  }
  if (enabled) for (const id of ids) if (validRating(ws.jobFeedback?.[id])) ids.delete(id);
  return ids;
}

/** Interest never changes fit, eligibility or the student's explicit hidden list. */
export function preferenceAdjustment(ws: Workspace, job: Job, enabled = interestEnabled()): Pick<JobRanking, "adjustment" | "reasons"> {
  if (!enabled) return { adjustment: 0, reasons: [] }; // flag off = the ranking from before likes existed, saves included
  const direct = ws.jobFeedback?.[job.id];
  if (validRating(direct)) {
    const said = direct.rating >= 4 ? "Higher because you marked it “More like this”." : direct.rating <= 2 ? "Lower because you marked it “Not for me”." : "You marked it neutral, so your likes don't move it.";
    return { adjustment: 4 * (direct.rating - 3), reasons: [said] };
  }
  if (enabled) {
    const profileKey = interestContext(ws, job, "").profileKey;
    const relevant = Object.entries(ws.jobFeedback || {}).filter(([id, f]) => id !== job.id && validRating(f) && f.context?.rankingVersion === RANKING_VERSION && f.context.profileKey === profileKey && matchesReason(f, job));
    if (relevant.length) {
      // Average within each reason first, so rating many jobs at one employer doesn't drown out a role preference.
      const grouped = new Map<string, number[]>();
      for (const [, f] of relevant) {
        const values = grouped.get(f.reason!) || [];
        values.push(2 * (f.rating - 3));
        grouped.set(f.reason!, values);
      }
      const adjustment = rounded(mean([...grouped.values()].map(mean)));
      const names: Record<string, string> = { role: "similar roles", company: "this employer", location: "this location", format: "this work format" };
      const what = [...grouped.keys()].sort().map((reason) => names[reason]);
      const list = what.length > 1 ? `${what.slice(0, -1).join(", ")} and ${what[what.length - 1]}` : what[0];
      return { adjustment, reasons: [adjustment > 0 ? `Higher because you liked ${list}.` : adjustment < 0 ? `Lower because you passed on ${list}.` : `Your likes and passes on ${list} cancel out.`] };
    }
  }
  const weak = weakInterestJobIds(ws, enabled);
  const own = weak.has(job.id);
  const employer = !own && clean(job.company) && ws.jobs.some((j) => weak.has(j.id) && clean(j.company) === clean(job.company));
  const base = { adjustment: own ? 2 : employer ? 1 : 0,
    reasons: own ? ["You saved this opening or confirmed that you applied."] : employer ? ["You saved or confirmed applying to another opening at this employer."] : [] };
  return base;
}

/** Only company-specific ratings transfer to employer selection; location or role dislikes don't. */
export function employerPreferences(ws: Workspace, enabled = interestEnabled()): Map<string, number> {
  const result = new Map<string, number>();
  if (!enabled) return result;
  const grouped = new Map<string, number[]>();
  for (const f of Object.values(ws.jobFeedback || {})) {
    if (!validRating(f) || f.reason !== "company" || f.context?.rankingVersion !== RANKING_VERSION) continue;
    if (f.context.profileKey !== interestContext(ws, f.context.job as Job, "").profileKey) continue;
    const key = clean(f.context.job.company);
    if (key) {
      const values = grouped.get(key) || [];
      values.push(2 * (f.rating - 3));
      grouped.set(key, values);
    }
  }
  for (const [key, values] of grouped) result.set(key, rounded(mean(values)));
  return result;
}


/** Only what the student's own "More like this" / "Not for me" taps did to each opening (no save/apply signals,
 *  which the Openings page already weighs). Shown on the card as the reason it moved. */
export function ownInterest(ws: Workspace, jobs: Job[], enabled = interestEnabled()): Record<string, JobRanking> {
  const out: Record<string, JobRanking> = {};
  if (!enabled || !Object.keys(ws.jobFeedback || {}).length) return out;
  const noWeak = { ...ws, savedJobIds: [], tracker: [] } as Workspace;
  for (const job of jobs) {
    const p = preferenceAdjustment(noWeak, job, enabled);
    if (p.adjustment) out[job.id] = { score: p.adjustment, ...p };
  }
  return out;
}
