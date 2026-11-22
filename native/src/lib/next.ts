import type { Job, JobFit, Task, Workspace } from "../../../shared/types";

export type Next = { title: string; why: string; path: string; cta: string };

const daysUntil = (iso: string, now = new Date()) => {
  const t = Date.parse(iso + "T12:00:00");
  return Number.isFinite(t) ? Math.round((t - now.getTime()) / 86_400_000) : null;
};

/** Openings worth showing: the same filters as the website's Home and Opportunities (not hidden, eligible, open, in their places). */
export function visibleJobs(w: Pick<Workspace, "hiddenJobIds">, jobs: Job[], fits: Record<string, JobFit | undefined>, now = new Date()) {
  return jobs
    .filter((j) => { const f = fits[j.id]; return j.kind !== "event" && !w.hiddenJobIds.includes(j.id) && !!f && !f.excluded && !f.closed && f.regionMatch !== false && f.eligibility !== "unlikely" && (!j.deadline || (daysUntil(j.deadline, now) ?? 0) >= 0); })
    .sort((a, b) => (fits[b.id]?.score ?? 0) - (fits[a.id]?.score ?? 0));
}

/** Remy's "one thing right now". A short version of the website's Home rules (client/src/pages/Home.tsx).
 *  shortcut: copies the main branches only; move the website's version into shared/ when the Home thread is free, and use it here. */
export function nextThing(w: Workspace, jobs: Job[], fits: Record<string, JobFit | undefined>): Next {
  if (!w.resume) return { title: "Add your resume", why: "Upload it, or build one with Remy in about 10 minutes. Everything Remy suggests is built on it.", path: "/resume?tab=base", cta: "Add resume" };
  if (!w.resume.confirmedAt) return { title: "Confirm your base resume", why: "Check that every line was read correctly. Tailored versions are built only from what you confirm.", path: "/resume?tab=base", cta: "Review resume" };
  const pending = w.applications.find((a) => a.changes.some((c) => c.status === "pending"));
  if (pending) {
    const j = jobs.find((x) => x.id === pending.jobId) || w.jobs.find((x) => x.id === pending.jobId);
    const n = pending.changes.filter((c) => c.status === "pending").length;
    return { title: `Finish reviewing your ${j?.company || ""} application`.replace("  ", " "), why: `${n} suggested change${n === 1 ? " is" : "s are"} waiting for you to accept, edit or reject.`, path: `/resume?tab=tailor&app=${pending.id}`, cta: "Continue review" };
  }
  const planTodo = w.tasks.find((t: Task) => !t.done && t.source === "AI plan (review)");
  if (planTodo) return { title: planTodo.title, why: planTodo.why, path: planTodo.link || "/progress?tab=todos", cta: "Open" };
  if (w.plan?.nextAction?.title) return { title: w.plan.nextAction.title, why: w.plan.nextAction.why, path: w.plan.nextAction.link || "/path", cta: "Open" };
  if (!w.applications.length) {
    const best = visibleJobs(w, jobs, fits)[0];
    if (best) return { title: `Tailor your resume for ${best.company}`, why: fits[best.id]?.why || "This is your closest fit among current openings.", path: `/resume?tab=tailor&job=${best.id}`, cta: "Start tailoring" };
  }
  return { title: "Explore openings that fit you", why: "Keep a few to compare deadlines and eligibility.", path: "jobs", cta: "Browse" };
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function firstName(w: Workspace | null) {
  return (w?.profile.name || "").trim().split(/\s+/)[0] || "";
}
