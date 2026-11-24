// Small helpers for Home and Jobs. Remy's "one thing" is shared with the website now: shared/nextAction.ts.
import type { Job, JobFit, Workspace } from "../../../shared/types";

export const daysUntil = (iso: string, now = new Date()) => {
  const t = Date.parse(iso + "T12:00:00");
  return Number.isFinite(t) ? Math.round((t - now.getTime()) / 86_400_000) : null;
};

/** Openings worth showing: the same filters as the website's Home and Opportunities (not hidden, eligible, open, in their places). */
export function visibleJobs(w: Pick<Workspace, "hiddenJobIds">, jobs: Job[], fits: Record<string, JobFit | undefined>, now = new Date()) {
  return jobs
    .filter((j) => { const f = fits[j.id]; return j.kind !== "event" && !w.hiddenJobIds.includes(j.id) && !!f && !f.excluded && !f.closed && f.regionMatch !== false && f.eligibility !== "unlikely" && (!j.deadline || (daysUntil(j.deadline, now) ?? 0) >= 0); })
    .sort((a, b) => (fits[b.id]?.score ?? 0) - (fits[a.id]?.score ?? 0));
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}



/** The website's kind names (client/src/lib/jobs.ts kindLabel). */
export const kindLabel: Record<Job["kind"], string> = { job: "Job", internship: "Internship", program: "Early-career program", campus: "Campus job", event: "Event" };

/** "West Palm Beach, FL + 3 more", like the website's owner cards (Opportunities.tsx shortPlace). */
export const shortPlace = (loc?: string) => {
  const all = (loc || "").split(";").map((x) => x.replace(/,\s*United States$/, "").trim()).filter(Boolean);
  return !all.length ? "Location not stated" : all.length > 1 ? `${all[0]} + ${all.length - 1} more` : all[0]!;
};

/** The deadline chip: orange inside a week, "Deadline passed" after (Opportunities.tsx). */
export function deadlineChip(deadline: string, now = new Date()): { text: string; tone: "bad" | "soon" | "plain" } | null {
  if (!deadline) return null;
  const d = daysUntil(deadline, now);
  if (d !== null && d < 0) return { text: "Deadline passed", tone: "bad" };
  const day = new Date(deadline.slice(0, 10) + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { text: `Due ${day}${d === 0 ? " · today" : d !== null ? ` · ${d}d` : ""}`, tone: d !== null && d <= 7 ? "soon" : "plain" };
}

/** Remy's line under the title, from real counts only (the website's OppLine). */
export function jobsLine(shown: Job[], fits: Record<string, JobFit | undefined>, now = new Date()) {
  if (!shown.length) return "";
  const week = new Date(now.getTime() - 7 * 864e5).toISOString();
  const fresh = shown.filter((j) => (j.foundAt || "") > week).length;
  const qualify = shown.filter((j) => { const f = fits[j.id]; return f?.checked && f.eligibility !== "unlikely" && !f.closed; }).length;
  return (fresh ? `${fresh} new this week.` : `${shown.length} opening${shown.length === 1 ? "" : "s"} ranked for you.`) + (qualify ? ` You qualify for ${qualify}.` : "");
}

/** Openings the student passed on (Pass hides it and rates it low), in feed order. */
export const passedJobs = (w: Pick<Workspace, "hiddenJobIds" | "jobFeedback">, jobs: Job[]) =>
  jobs.filter((j) => w.hiddenJobIds.includes(j.id) && (w.jobFeedback?.[j.id]?.rating ?? 0) <= 2);
