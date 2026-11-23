import type { ChatAction, ChatDid, Job, MoreAction, Workspace } from "@shared/types";
import { step } from "@shared/progress";
import { uid } from "../platform/ids";
import { NAME_CHECK } from "@shared/names";
import { doMore, MORE_KINDS, undoMore } from "./remyTools";

// Redesign stage 6 (owners first): "save that job", "add a to-do for Friday", "tailor my resume for this" are done
// right away, shown as what Remy did, each with Undo. Nothing here leaves Remy (no application, email or RSVP).

const SAVED_SOURCE = "Added when you saved it";
const dueLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const roleList = (ws: Workspace) => ws.profile.targetRoles.split(/,\s*/).filter(Boolean);
const THEMES: Record<string, string> = { dark: "Dark mode", light: "Light mode", system: "Matching your device's light or dark mode" };
const NOTIFY: Record<string, string> = { deadlines: "Deadline reminder emails", statusChanges: "Status change emails", weeklyPlan: "Weekly plan email" };
const timeLabel = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/** Does the actions that stay inside Remy and returns what was done; the rest (open a page, a profile change) stay as buttons. */
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
    } else if (a.kind === "name") {
      if (ws.profile.preferredName === a.value) { notes.push(`I already call you ${a.value}.`); continue; }
      did.push({ id: uid("d"), kind: "name", ref: a.value, old: ws.profile.preferredName, label: `I'll call you ${a.value} from now on`, link: "/accounts?tab=profile" });
      ws.profile.preferredName = a.value;
      // Same as Settings: choosing a name answers "Which name should Remy use?".
      for (const t of ws.tasks) if (t.source === NAME_CHECK && !t.done) t.done = true;
    } else if (a.kind === "setting") {
      if (a.key === "theme") {
        if (ws.settings.theme === a.value && ws.settings.themeChosen) continue;
        did.push({ id: uid("d"), kind: "setting", ref: a.key, old: ws.settings.themeChosen ? ws.settings.theme : "system", label: `${THEMES[String(a.value)]} is on`, link: "/accounts?tab=settings" });
        ws.settings.theme = a.value as Workspace["settings"]["theme"];
        ws.settings.themeChosen = true;
      } else {
        const k = a.key.split(".")[1] as keyof Workspace["settings"]["notify"];
        if (ws.settings.notify[k] === a.value) continue;
        did.push({ id: uid("d"), kind: "setting", ref: a.key, old: ws.settings.notify[k], label: `${NOTIFY[k]} turned ${a.value ? "on" : "off"}`, link: "/accounts?tab=settings" });
        ws.settings.notify[k] = !!a.value;
      }
    } else if (a.kind === "done") {
      const t = ws.tasks.find((x) => x.id === a.taskId);
      if (!t) { notes.push("I couldn't find that to-do, so nothing was checked off."); continue; }
      if (t.done) continue;
      t.done = true;
      did.push({ id: uid("d"), kind: "done", ref: t.id, label: `Checked off: ${t.title}`, link: "/" });
    } else if (a.kind === "unsave") {
      const j = findJob(ws, a.jobId);
      if (!j || !ws.savedJobIds.includes(j.id)) { notes.push("That opening wasn't saved, so nothing changed."); continue; }
      ws.savedJobIds = ws.savedJobIds.filter((x) => x !== j.id);
      did.push({ id: uid("d"), kind: "unsave", ref: j.id, label: `Removed ${j.title} at ${j.company} from your saved openings`, link: "/opportunities" });
    } else if (a.kind === "event") {
      if (a.date < today) { notes.push("That date has already passed, so I didn't add it to your calendar."); continue; }
      const id = uid("cal");
      ws.calendar.push({ id, title: a.title, date: a.date, time: a.time || "", kind: /interview/i.test(a.title) ? "Interview" : "Event", source: "Remy chat", notes: "" });
      did.push({ id: uid("d"), kind: "event", ref: id, label: `Added to your calendar: ${a.title}, ${dueLabel(a.date)}${a.time ? ` at ${timeLabel(a.time)}` : ""}`, link: "/calendar" });
    } else if (a.kind === "remember") {
      const norm = (x: string) => x.toLowerCase().replace(/\W+/g, " ").trim();
      if (ws.memory.some((m) => norm(m.text) === norm(a.text))) continue;
      const id = uid("f"), now = new Date().toISOString();
      ws.memory.push({ id, text: a.text, category: "other", source: "Assistant chat (asked by student)", status: "approved", createdAt: now, updatedAt: now });
      did.push({ id: uid("d"), kind: "remember", ref: id, label: `Remembered: ${a.text}`, link: "/accounts?tab=memory" });
    } else if (MORE_KINDS.has(a.kind)) {
      const r = doMore(ws, a as MoreAction, findJob, today);
      if (r.did) did.push(r.did);
      if (r.note) notes.push(r.note);
    } else buttons.push(a);
  }
  return { did, buttons, notes };
}

// shortcut: an undone save or start keeps its career step (Progress counts it once); fine while owners test.
/** Undo one thing Remy did. Returns why it can't be undone, or null when it was. */
export function undoDid(ws: Workspace, d: ChatDid): string | null {
  if (d.undone) return null;
  const more = undoMore(ws, d);
  if (more !== false) { if (more) return more; d.undone = true; return null; }
  if (d.kind === "task") ws.tasks = ws.tasks.filter((t) => t.id !== d.ref);
  else if (d.kind === "save") {
    ws.savedJobIds = ws.savedJobIds.filter((x) => x !== d.ref);
    ws.calendar = ws.calendar.filter((c) => !(c.linkedId === d.ref && c.source === SAVED_SOURCE));
  }
  else if (d.kind === "name") ws.profile.preferredName = String(d.old ?? "");
  else if (d.kind === "setting") {
    if (d.ref === "theme") { ws.settings.theme = (d.old || "system") as Workspace["settings"]["theme"]; ws.settings.themeChosen = d.old !== "system"; }
    else ws.settings.notify[d.ref.split(".")[1] as keyof Workspace["settings"]["notify"]] = !!d.old;
  }
  else if (d.kind === "done") { const t = ws.tasks.find((x) => x.id === d.ref); if (t) t.done = false; }
  else if (d.kind === "unsave") { if (!ws.savedJobIds.includes(d.ref)) ws.savedJobIds.push(d.ref); }
  else if (d.kind === "event") ws.calendar = ws.calendar.filter((c) => c.id !== d.ref);
  else if (d.kind === "remember") ws.memory = ws.memory.filter((m) => m.id !== d.ref);
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
