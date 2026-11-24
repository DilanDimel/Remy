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


