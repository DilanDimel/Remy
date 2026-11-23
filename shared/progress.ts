import type { Job, Step, Workspace } from "./types";

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
    { label: "Interview stories", done: stories >= 2, detail: `${Math.min(stories, 2)} of 2 ready`, link: "/interview" },
    { label: "Interviewing", done: interviewing, detail: interviewing ? "You're in" : "Comes from the steps above", link: "/progress" },
  ];
}

// Reply rate (council, Nov 6): of the applications a student sent, how many got a reply from a person. Read from each
// application's own history, so moving a card on later doesn't erase that someone replied. An automatic "we received
// your application" isn't an answer; a rejection is (the loop was closed). Shown only from MIN_FOR_RATE applications,
// so 0 of 2 doesn't read as a verdict.
export const MIN_FOR_RATE = 5;
const SENT = new Set(["Applied", "Received", "Heard back", "Interview", "Offer", "Rejected", "No reply"]);
const REPLIED = new Set(["Heard back", "Interview", "Offer", "Rejected"]);
const INTERVIEWED = new Set(["Interview", "Offer"]);
type Group = { applied: number; replied: number; interviews: number; offers: number };
export function replyStats(w: Pick<Workspace, "tracker">) {
  // A status picked by hand and changed again by hand within 10 minutes was a slip (or arrowing through the list),
  // so it doesn't count; anything that stood longer, came from an email, or is the current status does.
  const kept = (t: Workspace["tracker"][number]) => t.events.filter((e, i) => {
    const next = t.events[i + 1];
    return !(next && /^Manual/.test(e.source) && /^Manual/.test(next.source) && Date.parse(next.at) - Date.parse(e.at) < 10 * 60_000);
  });
  const group = (items: Workspace["tracker"]): Group => {
    const seen = (t: Workspace["tracker"][number], set: Set<string>) => set.has(t.status) || kept(t).some((e) => set.has(e.status));
    const sent = items.filter((t) => seen(t, SENT));
    return { applied: sent.length, replied: sent.filter((t) => seen(t, REPLIED)).length, interviews: sent.filter((t) => seen(t, INTERVIEWED)).length, offers: sent.filter((t) => t.status === "Offer" || kept(t).some((e) => e.status === "Offer")).length };
  };
  const all = group(w.tracker);
  const tailored = group(w.tracker.filter((t) => !!t.applicationId));
  const plain = group(w.tracker.filter((t) => !t.applicationId));
  const pct = (g: Group) => (g.applied ? Math.round((100 * g.replied) / g.applied) : 0);
  return { ...all, rate: all.applied >= MIN_FOR_RATE ? pct(all) : null, split: tailored.applied >= 3 && plain.applied >= 3 ? { tailored: { ...tailored, rate: pct(tailored) }, plain: { ...plain, rate: pct(plain) } } : null };
}

/** "Getting started" on Home (audit 5C): five first real steps, each read from what the student did. The card goes
 *  away once all five are done. No points or streaks. */
export function gettingStarted(w: Workspace) {
  const storyReady = (w.stories || []).some((s) => s.situation && s.task && s.action && s.result);
  return [
    { label: "Save an opening you like", done: w.savedJobIds.length > 0 || w.applications.length > 0, link: "/opportunities" },
    { label: "Confirm your base resume", done: !!w.resume?.confirmedAt, link: "/resume?tab=base" },
    { label: "Tailor one application", done: w.applications.some((a) => a.versions.length > 0), link: "/resume?tab=tailor" },
    { label: "Build one interview story", done: storyReady, link: "/interview" },
    { label: "Add one person you know", done: w.contacts.length > 0, link: "/community" },
  ];
}

/** Openings the student kept (Jobs → Kept, Opportunities → Saved) that aren't in their application tracker yet, so
 *  Progress can count and show them as Saved (owners first, Nov 22: Progress said "Nothing tracked yet" with 11 kept). */
export function keptUntracked(w: Pick<Workspace, "savedJobIds" | "tracker">, jobs: Job[]): Job[] {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return w.savedJobIds
    .map((id) => jobs.find((j) => j.id === id))
    .filter((j): j is Job => !!j && !w.tracker.some((t) => t.jobId === j.id || (same(t.company, j.company) && same(t.role, j.title))));
}
