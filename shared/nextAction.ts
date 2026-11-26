// Remy's "one thing right now" on Home, shared by the website (client/src/pages/Home.tsx) and the phone app, so both
// always suggest the same next step. Pure: give it the workspace, the openings and their fits.
import type { CalItem, Job, JobFit, Workspace } from "./types";
import { many } from "./homeLine";

export type NextAction = { title: string; why: string; link: string; cta: string; /** The interview in the next two days, when there is one (Home then offers prep steps). */ interview?: CalItem };

const noon = (d: string) => new Date(d.slice(0, 10) + "T12:00").getTime();
/** Calendar days from today to a date: today 0, tomorrow 1 (noon to noon, so daylight saving can't shift it). */
export const daysFrom = (d: string, now = new Date()) => {
  if (!d) return null;
  const t = noon(d);
  return isNaN(t) ? null : Math.round((t - noon(now.toLocaleDateString("en-CA"))) / 86_400_000);
};
const fmtDay = (d: string) => { const dt = new Date(d.length === 10 ? d + "T12:00:00" : d); return isNaN(+dt) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(dt.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }) }); };

/** The interview in the next two days, which overrides everything else on Home. */
export const interviewSoon = (w: Pick<Workspace, "calendar">, now = new Date()) =>
  w.calendar.find((c) => { const n = daysFrom(c.date, now); return c.kind === "Interview" && n !== null && n >= 0 && n <= 2; });

export function nextAction(w: Workspace, jobs: Job[] | null | undefined, fits: Record<string, JobFit | undefined>, o: { ownerView: boolean; now?: Date; /** false while Interview is locked for this person: prep points to Calendar instead. */ interviewOpen?: boolean }): NextAction {
  const now = o.now || new Date();
  const until = (d: string) => daysFrom(d, now);
  const interview = interviewSoon(w, now);
  if (interview) {
    const d = until(interview.date);
    return { title: `Prepare for your interview ${d === 0 ? "today" : d === 1 ? "tomorrow" : "in 2 days"}: ${interview.title.replace(/^interview( with)?:?\s*/i, "")}`, why: "Three short steps: research the organization, pick two true stories, and test your setup.", link: "", cta: "Add prep steps", interview };
  }
  const pending = w.applications.find((a) => a.changes.some((c) => c.status === "pending"));
  if (!w.resume) return { title: "Add your resume", why: "Upload it, or build one with Remy in about 10 minutes (no resume yet is fine). Everything Remy suggests is built on it.", link: "/resume?tab=base", cta: "Add resume" };
  if (!w.resume.confirmedAt) return { title: "Confirm your base resume", why: "Check that every line was read correctly. Tailored versions are built only from what you confirm.", link: "/resume?tab=base", cta: "Review resume" };
  if (pending) {
    const j = jobs?.find((x) => x.id === pending.jobId);
    const n = pending.changes.filter((c) => c.status === "pending").length;
    return { title: `Finish reviewing your ${j?.company || ""} application`, why: o.ownerView ? `${many(n, "suggested change")} ${n === 1 ? "is" : "are"} waiting for you to accept, edit or reject.` : `${n} suggested change(s) are waiting for your accept, edit or reject.`, link: `/resume?tab=tailor&app=${pending.id}`, cta: "Continue review" };
  }
  // An interview coming up (beyond the 2-day prep plan) beats a general suggestion.
  const soon = w.calendar.filter((c) => c.kind === "Interview" && (until(c.date) ?? -1) > 2 && (until(c.date) ?? 99) <= 21).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (soon) return { title: `${soon.title.replace(/^interview( with)?:?\s*/i, "Your interview with ")} is ${fmtDay(soon.date)}, in ${until(soon.date)} days`, why: "Start now: build two true stories from your resume and practice them out loud. Remy turns Home into a prep plan two days before.", ...(o.interviewOpen === false ? { link: "/calendar", cta: "See it on Calendar" } : { link: "/interview#story-deck", cta: "Prepare stories" }) };
  // An opening counts only if it passes every filter (not hidden, in their places, eligible, still open).
  const fitsAll = (j: Job) => { const f = fits[j.id]; return !!f && !f.excluded && !f.closed && f.regionMatch !== false && f.eligibility !== "unlikely" && j.kind !== "event" && !w.hiddenJobIds.includes(j.id) && (!j.deadline || (until(j.deadline) ?? 1) >= 0); };
  // A plan step that names an opening the student can't or won't pursue anymore (hidden, closed, elsewhere, not eligible) is skipped.
  // Hidden openings aren't in the list Home gets, so the student's own saved list is checked too.
  // Skipped only when every posting from the company it names fails (one ineligible BDO posting doesn't block another).
  const blocked = (text: string) => {
    const named = [...(jobs || []), ...w.jobs].filter((j) => j.company.length > 2 && text.toLowerCase().includes(j.company.toLowerCase()));
    return named.length > 0 && named.every((j) => !fitsAll(j));
  };
  const moved = w.tracker.filter((t) => t.status !== "Saved").map((t) => t.company.toLowerCase());
  // The student's own plan comes first: its first to-do they haven't done (they can cross it off), then the plan's written next step.
  const planTodo = w.tasks.find((t) => !t.done && t.source === "AI plan (review)" && !blocked(t.title));
  if (planTodo) return { title: planTodo.title, why: planTodo.why, link: planTodo.link || "/progress?tab=todos", cta: "Open" };
  if (w.plan && !blocked(w.plan.nextAction.title) && !moved.some((c) => c && w.plan!.nextAction.title.toLowerCase().includes(c))) return { ...w.plan.nextAction, cta: "Open" };
  if (!w.applications.length && jobs?.length) {
    const best = [...jobs].filter(fitsAll).sort((a, b) => (fits[b.id]?.score || 0) - (fits[a.id]?.score || 0))[0];
    if (best) return { title: `Tailor your resume for ${best.company}`, why: fits[best.id]?.why || "This is your closest fit among current openings.", link: `/resume?tab=tailor&job=${best.id}`, cta: "Start tailoring" };
  }
  return { title: "Explore openings that fit you", why: "Save a few to compare deadlines and eligibility.", link: "/opportunities", cta: "Browse" };
}
