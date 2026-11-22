import type { ChatAction, ChatDid, Job, Workspace } from "@shared/types";
import { step } from "@shared/progress";
import { uid } from "./ids";

// Redesign stage 6 (owners first): "save that job", "add a to-do for Friday", "tailor my resume for this" are done
// right away, shown as what Remy did, each with Undo. Nothing here leaves Remy (no application, email or RSVP).

const SAVED_SOURCE = "Added when you saved it";
const dueLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const roleList = (ws: Workspace) => ws.profile.targetRoles.split(/,\s*/).filter(Boolean);

/** Does the actions that stay inside Remy and returns what was done; the rest (open a page, settings) stay as buttons. */
export function doActions(ws: Workspace, actions: ChatAction[], findJob: (ws: Workspace, id: string) => Job | undefined, today: string): { did: ChatDid[]; buttons: ChatAction[]; notes: string[] } {
  // notes: what didn't happen, so the reply never claims an action that was skipped.
  const did: ChatDid[] = [], buttons: ChatAction[] = [], notes: string[] = [];
  for (const a of actions) {
    if (a.kind === "task") {
      if (ws.tasks.some((t) => !t.done && t.title === a.title)) continue;
      const id = uid("t");
      ws.tasks.unshift({ id, title: a.title, why: a.why, due: a.due || "", category: "Prepare", done: false, source: "Remy chat" });
      did.push({ id: uid("d"), kind: "task", ref: id, label: `Added to-do: ${a.title}${a.due ? ` (due ${dueLabel(a.due)})` : ""}`, link: "/" });
    } else if (a.kind === "save") {
      const j = findJob(ws, a.jobId);
      if (!j) { notes.push("I couldn't find that opening on your list, so nothing was saved."); continue; }
      if (ws.savedJobIds.includes(j.id)) { notes.push(`${j.title} at ${j.company} was already saved.`); continue; }
      ws.savedJobIds.push(j.id);
      ws.hiddenJobIds = ws.hiddenJobIds.filter((x) => x !== j.id);
      step(ws, "save", j.id);
      // Same as saving on Opportunities: the deadline goes on the calendar by itself.
      if (j.deadline && j.deadline >= today && !ws.calendar.some((c) => c.linkedId === j.id))
        ws.calendar.push({ id: uid("cal"), title: `${j.company}: ${j.kind === "event" ? "event" : "deadline"}`, date: j.deadline.slice(0, 10), time: "", kind: j.kind === "event" ? "Event" : "Deadline", source: SAVED_SOURCE, linkedId: j.id, notes: j.deadlineText || "" });
      did.push({ id: uid("d"), kind: "save", ref: j.id, label: `Saved ${j.title} at ${j.company}`, link: `/opportunities?id=${encodeURIComponent(j.id)}` });
    } else if (a.kind === "tailor") {
      const j = findJob(ws, a.jobId);
      if (!j || !ws.resume) { notes.push(!j ? "I couldn't find that opening on your list, so no tailoring was started." : "Add your resume first, then I can start tailoring."); continue; }
      const existing = ws.applications.find((x) => x.jobId === j.id);
      if (existing) { buttons.push({ kind: "open", link: `/resume?tab=tailor&app=${existing.id}`, label: `Open ${j.company} application` }); notes.push(`You'd already started ${j.title} at ${j.company}, so it's one tap away below.`); continue; }
      const id = uid("app");
      ws.applications.unshift({ id, jobId: j.id, createdAt: new Date().toISOString(), gaps: [], changes: [], letter: "", letterFlags: [], letterApproved: false, personalize: [], ats: [], versions: [] });
      step(ws, "start", j.id);
      did.push({ id: uid("d"), kind: "tailor", ref: id, label: `Started tailoring for ${j.title} at ${j.company}`, link: `/resume?tab=tailor&app=${id}&go=1` });
    } else if (a.kind === "role") {
      if (roleList(ws).some((r) => r.toLowerCase() === a.title.toLowerCase())) continue;
      ws.profile.targetRoles = [...roleList(ws), a.title].join(", ");
      did.push({ id: uid("d"), kind: "role", ref: a.title, label: `Remy will look for ${a.title} openings too`, link: "/opportunities" });
    } else buttons.push(a);
  }
  return { did, buttons, notes };
}

// shortcut: an undone save or start keeps its career step (Progress counts it once); fine while owners test.
/** Undo one thing Remy did. Returns why it can't be undone, or null when it was. */
export function undoDid(ws: Workspace, d: ChatDid): string | null {
  if (d.undone) return null;
  if (d.kind === "task") ws.tasks = ws.tasks.filter((t) => t.id !== d.ref);
  else if (d.kind === "save") {
    ws.savedJobIds = ws.savedJobIds.filter((x) => x !== d.ref);
    ws.calendar = ws.calendar.filter((c) => !(c.linkedId === d.ref && c.source === SAVED_SOURCE));
  }
  else if (d.kind === "role") ws.profile.targetRoles = roleList(ws).filter((r) => r.toLowerCase() !== d.ref.toLowerCase()).join(", ");
  else if (d.kind === "tailor") {
    const a = ws.applications.find((x) => x.id === d.ref);
    // Work the student did on it isn't thrown away by an Undo on an old reply.
    if (a && (a.versions.length || a.changes.some((c) => c.status !== "pending"))) return "You've already worked on this application, so it stays. Delete it from Resume → Tailor if you don't want it.";
    ws.applications = ws.applications.filter((x) => x.id !== d.ref);
  }
  d.undone = true;
  return null;
}
