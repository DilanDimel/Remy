import type { Step, Workspace } from "./types";

// Real career steps, recorded on the server for the owners' north star. Never opening the app, chatting,
// regenerating AI text or mass-saving. Each step is recorded once (kind + ref), so a retry or a
// refresh can't add points twice.
export const XP: Record<Step["kind"], number> = { task: 10, save: 5, start: 15, approve: 25, outreach: 20, resume: 25 };
const SAVES_PER_DAY = 3;

const central = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

/** Records a step if it's new; returns true when it counted. */
export function step(ws: Workspace, kind: Step["kind"], ref: string, now = new Date().toISOString()): boolean {
  const steps = (ws.steps ||= []);
  if (steps.some((s) => s.kind === kind && s.ref === ref)) return false;
  if (kind === "save" && steps.filter((s) => s.kind === "save" && central(s.at) === central(now)).length >= SAVES_PER_DAY) return false;
  steps.push({ at: now, kind, ref, xp: XP[kind] });
  if (steps.length > 1000) steps.splice(0, steps.length - 1000);
  return true;
}

// Milestones a recruiter would recognize, each read from what the student actually did. No points or streaks.
export function milestones(w: Workspace) {
  const applied = w.tracker.filter((t) => !["Saved", "Withdrawn"].includes(t.status)).length;
  const stories = (w.stories || []).length;
  const interviewing = w.tracker.some((t) => t.status === "Interview" || t.status === "Offer") || w.calendar.some((c) => c.kind === "Interview");
  return [
    { label: "Resume ready", done: !!w.resume?.confirmedAt, detail: w.resume?.confirmedAt ? "Confirmed" : w.resume ? "Check and confirm it" : "Upload or build one", link: "/resume?tab=base" },
    { label: "Openings picked", done: w.savedJobIds.length >= 3, detail: `${w.savedJobIds.length} of 3 saved`, link: "/opportunities" },
    { label: "First application", done: applied > 0, detail: applied ? `${applied} sent` : "Tailor and apply to one", link: "/opportunities" },
    { label: "Reached out", done: w.outreach.length > 0, detail: w.outreach.length ? `${w.outreach.length} message${w.outreach.length > 1 ? "s" : ""} drafted` : "Message one person", link: "/community" },
    { label: "Interview stories", done: stories >= 2, detail: `${Math.min(stories, 2)} of 2 ready`, link: "/resume?tab=base" },
    { label: "Interviewing", done: interviewing, detail: interviewing ? "You're in" : "Comes from the steps above", link: "/progress" },
  ];
}
