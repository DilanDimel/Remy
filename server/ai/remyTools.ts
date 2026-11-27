import type { ChatDid, Job, MoreAction, TrackStatus, Workspace } from "@shared/types";
import { uid } from "../platform/ids";
import { PREP_HEAD, quietOn } from "@shared/remyOffers";
import { firstName } from "@shared/names";

// Owners (Nov 23, Dilan: "every feature on the website connected to the AI"): the rest of what a student can do on
// the site, done by Remy from chat with Undo. Builds on server/ai/chatDo.ts (save, tailor, to-dos, name, theme…).
// Nothing here leaves Remy: no email, application, RSVP or text is sent. Deleting the account or data stays a button.

export const PREF_FIELDS = ["regions", "opportunityTypes", "timeline", "avoid", "dreamEmployers", "interests", "goals", "classYear", "relocation", "workAuth"] as const;
export type PrefField = typeof PREF_FIELDS[number];
const PREF_NAME: Record<PrefField, string> = { regions: "Places you want", opportunityTypes: "Kinds of opportunities", timeline: "When you want to start", avoid: "What to avoid", dreamEmployers: "Dream employers", interests: "Interests", goals: "Goals", classYear: "Class year", relocation: "Moving for work", workAuth: "Work authorization" };
const LIST_FIELDS = new Set<PrefField>(["regions", "opportunityTypes", "avoid", "dreamEmployers", "interests"]);
export const TRACK_STATUSES: TrackStatus[] = ["Saved", "Applied", "Received", "Heard back", "Interview", "Offer", "Rejected", "No reply", "Withdrawn"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GO_LINK = /^\/(resume|interview|opportunities|path|community|calendar|progress|accounts)?(\?[\w=&%.+-]{0,160})?$/;
const START = ["resumeFix", "interview", "tour"] as const;
export const MORE_KINDS = new Set<string>(["interest", "unhide", "prefs", "nudges", "careerTime", "textsOff", "quiet", "track", "moveEvent", "removeEvent", "prep", "dropTask", "roleOff", "cardNote", "restDays", "dropContact", "due", "hours", "career", "contact", "forget", "go", "start"]);

const clean = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const isId = (v: unknown) => /^[\w-]{1,120}$/.test(String(v ?? ""));
const isDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
const isTime = (v: unknown) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v ?? ""));
const dayLabel = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const timeLabel = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const list = (s: string | undefined) => (s || "").split(/,\s*/).map((x) => x.trim()).filter(Boolean);
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** The model's raw action, checked; null when it isn't one of these (chatActions in safety.ts tries the rest). */
export function parseMore(a: any): MoreAction | null {
  switch (a?.kind) {
    case "interest": return isId(a.jobId) && typeof a.more === "boolean" ? { kind: "interest", jobId: String(a.jobId), more: a.more } : null;
    case "unhide": return isId(a.jobId) ? { kind: "unhide", jobId: String(a.jobId) } : null;
    case "prefs": {
      if (!PREF_FIELDS.includes(a.field)) return null;
      const mode = ["set", "add", "remove"].includes(a.mode) ? a.mode : "set";
      const value = clean(a.value, 200);
      return value || mode === "set" ? { kind: "prefs", field: a.field, value, mode } : null;
    }
    case "nudges": return ["daily", "weekly", "off"].includes(a.value) ? { kind: "nudges", value: a.value } : null;
    case "careerTime": return a.off === true ? { kind: "careerTime", off: true } : Number.isInteger(a.day) && a.day >= 0 && a.day <= 6 && isTime(a.time) ? { kind: "careerTime", day: a.day, time: String(a.time) } : null;
    case "textsOff": return { kind: "textsOff" };
    case "quiet": return Number.isInteger(a.days) && a.days >= 0 && a.days <= 30 ? { kind: "quiet", days: a.days } : null;
    case "track": {
      if (!TRACK_STATUSES.includes(a.status)) return null;
      if (isId(a.trackId)) return { kind: "track", trackId: String(a.trackId), status: a.status };
      const company = clean(a.company, 80), role = clean(a.role, 120);
      return company ? { kind: "track", company, role, status: a.status, ...(isId(a.jobId) ? { jobId: String(a.jobId) } : {}) } : null;
    }
    case "moveEvent": return isId(a.calId) && isDate(a.date) ? { kind: "moveEvent", calId: String(a.calId), date: String(a.date), ...(isTime(a.time) ? { time: String(a.time) } : {}) } : null;
    case "removeEvent": return isId(a.calId) ? { kind: "removeEvent", calId: String(a.calId) } : null;
    case "prep": return isId(a.calId) ? { kind: "prep", calId: String(a.calId) } : null;
    case "due": return isId(a.taskId) && (isDate(a.due) || a.due === "") ? { kind: "due", taskId: String(a.taskId), due: String(a.due) } : null;
    case "hours": { const h = Number(a.hours); return clean(a.activity, 80) && h > 0 && h <= 24 && isDate(a.date) ? { kind: "hours", activity: clean(a.activity, 80), hours: Math.round(h * 4) / 4, date: String(a.date), ...(clean(a.note, 160) ? { note: clean(a.note, 160) } : {}) } : null; }
    case "career": return isId(a.careerId) ? { kind: "career", careerId: String(a.careerId) } : null;
    case "contact": return clean(a.name, 80) ? { kind: "contact", name: clean(a.name, 80), org: clean(a.org, 80), title: clean(a.title, 80), why: clean(a.why, 200), ...(isDate(a.metOn) ? { metOn: String(a.metOn) } : {}), ...(clean(a.met, 80) ? { met: clean(a.met, 80) } : {}) } : null;
    case "dropTask": return isId(a.taskId) ? { kind: "dropTask", taskId: String(a.taskId) } : null;
    case "roleOff": { const title = clean(a.title, 80); return title ? { kind: "roleOff", title } : null; }
    case "cardNote": { const note = clean(a.note, 300); return isId(a.trackId) && note ? { kind: "cardNote", trackId: String(a.trackId), note } : null; }
    case "restDays": return Array.isArray(a.days) && a.days.length <= 3 && a.days.every((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) ? { kind: "restDays", days: [...new Set(a.days as number[])].sort() } : null;
    case "dropContact": return isId(a.contactId) ? { kind: "dropContact", contactId: String(a.contactId) } : null;
    case "forget": return isId(a.factId) ? { kind: "forget", factId: String(a.factId) } : null;
    case "go": return GO_LINK.test(String(a.link)) ? { kind: "go", link: String(a.link) || "/", label: clean(a.label, 40) || "the page" } : null;
    case "start": return START.includes(a.what) ? { kind: "start", what: a.what, ...(isId(a.jobId) ? { jobId: String(a.jobId) } : {}) } : null;
  }
  return null;
}

/** For "prefs" (search preferences): openings are checked again against the new profile when Opportunities loads. */
export function refit(ws: Workspace) {
  for (const [id, f] of Object.entries(ws.fits)) if (f.by === "ai") f.v = -1; else delete ws.fits[id];
}

type Out = { did?: ChatDid; note?: string };
const did = (kind: ChatDid["kind"], ref: string, label: string, link?: string, old?: string, noUndo?: boolean): Out => ({ did: { id: uid("d"), kind, ref, label, ...(link ? { link } : {}), ...(old !== undefined ? { old } : {}), ...(noUndo ? { noUndo: true } : {}) } });

/** Does one of these actions. */
export function doMore(ws: Workspace, a: MoreAction, findJob: (ws: Workspace, id: string) => Job | undefined, today: string): Out {
  const nowIso = new Date().toISOString();
  if (a.kind === "interest" || a.kind === "unhide") {
    const j = findJob(ws, a.jobId);
    if (!j) return { note: "I couldn't find that opening on your list, so nothing changed." };
    const old = JSON.stringify({ fb: ws.jobFeedback?.[j.id] ?? null, hidden: ws.hiddenJobIds.includes(j.id), saved: ws.savedJobIds.includes(j.id) });
    if (a.kind === "unhide") {
      if (!ws.hiddenJobIds.includes(j.id)) return { note: `${j.title} at ${j.company} is already on your list.` };
      ws.hiddenJobIds = ws.hiddenJobIds.filter((x) => x !== j.id);
      if (ws.jobFeedback?.[j.id]?.rating === 1) delete ws.jobFeedback[j.id];
      return did("unhide", j.id, `Brought back ${j.title} at ${j.company}`, `/opportunities?id=${encodeURIComponent(j.id)}`, old);
    }
    if (j.kind !== "event") {
      const fb = (ws.jobFeedback ||= {});
      fb[j.id] = { rating: a.more ? 5 : 1, createdAt: fb[j.id]?.createdAt || nowIso, updatedAt: nowIso, context: fb[j.id]?.context || { rankingVersion: "chat", profileKey: "", profile: { major: ws.profile.major, targetRoles: ws.profile.targetRoles, interests: ws.profile.interests, classYear: ws.profile.classYear, regions: ws.profile.regions, opportunityTypes: ws.profile.opportunityTypes }, job: { title: j.title, company: j.company, location: j.location, format: j.format, kind: j.kind }, capturedAt: nowIso } };
    }
    // Same as Keep / Pass on Opportunities: Keep saves it, Pass hides it.
    if (a.more) { if (!ws.savedJobIds.includes(j.id)) ws.savedJobIds.push(j.id); ws.hiddenJobIds = ws.hiddenJobIds.filter((x) => x !== j.id); }
    else { if (!ws.hiddenJobIds.includes(j.id)) ws.hiddenJobIds.push(j.id); ws.savedJobIds = ws.savedJobIds.filter((x) => x !== j.id); }
    return did("interest", j.id, a.more ? `Kept ${j.title} at ${j.company}; I'll find more like it` : `Passed on ${j.title} at ${j.company}; I'll show fewer like it`, "/opportunities", old);
  }
  if (a.kind === "prefs") {
    const was = ws.profile[a.field] || "";
    let next = a.value;
    if (LIST_FIELDS.has(a.field) && a.mode !== "set") {
      const items = list(was), adds = list(a.value);
      next = (a.mode === "add" ? [...items, ...adds.filter((x) => !items.some((y) => same(x, y)))] : items.filter((x) => !adds.some((y) => same(x, y)))).join(", ");
    }
    if (next === was) return { note: `${PREF_NAME[a.field]} already says that.` };
    ws.profile[a.field] = next;
    refit(ws);
    return did("prefs", a.field, `${PREF_NAME[a.field]}: ${next || "cleared"}`, "/accounts?tab=profile", was);
  }
  if (a.kind === "nudges") {
    const was = ws.settings.nudges || "weekly";
    if (was === a.value) return {};
    ws.settings.nudges = a.value;
    return did("nudges", "nudges", a.value === "off" ? "No more emails about new openings" : `Emails about new openings that fit: ${a.value}`, "/accounts?tab=settings", was);
  }
  if (a.kind === "careerTime") {
    const was = JSON.stringify(ws.settings.careerTime ?? null);
    ws.settings.careerTime = a.off ? null : { day: a.day!, time: a.time! };
    return did("careerTime", "careerTime", a.off ? "Removed your weekly career time" : `Your weekly career time: ${DAYS[a.day!]}s at ${timeLabel(a.time!)}`, "/calendar", was);
  }
  if (a.kind === "textsOff") {
    if (!ws.settings.texts?.on) return { note: "Texts were already off." };
    ws.settings.texts = { ...ws.settings.texts, on: false };
    return did("textsOff", "texts", "Deadline texts turned off", "/accounts?tab=settings");
  }
  if (a.kind === "quiet") {
    const was = ws.settings.quietUntil || "";
    if (!a.days) { if (!quietOn(ws.settings, today)) return { note: "I wasn't being quiet." }; delete ws.settings.quietUntil; return did("quiet", "quiet", "I'm back: offers, check-ins and opening emails are on again", "/", was); }
    ws.settings.quietUntil = new Date(Date.parse(today + "T12:00:00Z") + (a.days - 1) * 864e5).toISOString().slice(0, 10);
    return did("quiet", "quiet", `Quiet through ${new Date(ws.settings.quietUntil + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}: no offers, check-ins or opening emails (deadline reminders still come)`, "/", was);
  }
  if (a.kind === "track") {
    const t = a.trackId ? ws.tracker.find((x) => x.id === a.trackId)
      : ws.tracker.find((x) => (a.jobId && x.jobId === a.jobId) || (same(x.company, a.company!) && (!a.role || !x.role || same(x.role, a.role))));
    if (a.trackId && !t) return { note: "I couldn't find that application on your board, so nothing moved." };
    if (t) {
      if (t.status === a.status) return { note: `${t.company} is already under ${a.status}.` };
      const old = t.status;
      t.status = a.status;
      t.events.push({ id: uid("ev"), at: nowIso, status: a.status, source: "Told Remy in chat" });
      return did("track", t.id, `Moved ${t.company}${t.role ? ` ${t.role}` : ""} to ${a.status}`, "/progress?tab=tracker", old);
    }
    const j = a.jobId ? findJob(ws, a.jobId) : undefined;
    const id = uid("tr");
    ws.tracker.unshift({ id, company: j?.company || a.company!, role: j?.title || a.role || "", ...(j ? { jobId: j.id } : {}), status: a.status, events: [{ id: uid("ev"), at: nowIso, status: a.status, source: "Told Remy in chat" }], notes: "" });
    return did("track", id, `Added ${j?.company || a.company} to your board under ${a.status}`, "/progress?tab=tracker", "");
  }
  if (a.kind === "prep") {
    const c = ws.calendar.find((x) => x.id === a.calId);
    if (!c) return { note: "I couldn't find that on your calendar, so nothing changed." };
    const text = prepSheet(ws, c, findJob);
    const old = c.notes || "";
    c.notes = (text + (old && !old.startsWith(PREP_HEAD) ? "\n\n" + old : "")).slice(0, 4000);
    return did("prep", c.id, `Put a prep sheet on ${c.title} (${dayLabel(c.date)})`, "/calendar", old);
  }
  if (a.kind === "moveEvent" || a.kind === "removeEvent") {
    const c = ws.calendar.find((x) => x.id === a.calId);
    if (!c) return { note: "I couldn't find that on your calendar, so nothing changed." };
    if (a.kind === "removeEvent") {
      ws.calendar = ws.calendar.filter((x) => x.id !== c.id);
      return did("removeEvent", c.id, `Took ${c.title} (${dayLabel(c.date)}) off your calendar`, "/calendar", JSON.stringify(c));
    }
    if (a.date < today) return { note: "That date has already passed, so I didn't move it." };
    const old = JSON.stringify({ date: c.date, time: c.time });
    c.date = a.date;
    if (a.time) c.time = a.time;
    return did("moveEvent", c.id, `Moved ${c.title} to ${dayLabel(a.date)}${c.time ? ` at ${timeLabel(c.time)}` : ""}`, "/calendar", old);
  }
  if (a.kind === "due") {
    const t = ws.tasks.find((x) => x.id === a.taskId);
    if (!t) return { note: "I couldn't find that to-do, so nothing changed." };
    const old = t.due;
    t.due = a.due;
    return did("due", t.id, a.due ? `${t.title}: due ${dayLabel(a.due)}` : `${t.title}: no due date`, "/", old);
  }
  if (a.kind === "hours") {
    if (a.date > today) return { note: "I only log hours you've already done, so I didn't add that." };
    const id = uid("h");
    (ws.hours ||= []).unshift({ id, activity: a.activity, hours: a.hours, date: a.date, ...(a.note ? { note: a.note } : {}) });
    return did("hours", id, `Logged ${a.hours} hour${a.hours === 1 ? "" : "s"} of ${a.activity} (${dayLabel(a.date)})`, "/progress?tab=hours");
  }
  if (a.kind === "career") {
    const c = ws.plan?.careers.find((x) => x.id === a.careerId);
    if (!ws.plan || !c) return { note: "I couldn't find that career on My Path, so nothing changed." };
    const old = ws.plan.chosenCareerId || "";
    if (old === c.id) return { note: `${c.title} is already your pick.` };
    ws.plan.chosenCareerId = c.id;
    return did("career", c.id, `Picked ${c.title} on My Path`, "/path?tab=career", old);
  }
  if (a.kind === "contact") {
    if (ws.contacts.some((c) => same(c.name, a.name) && same(c.org, a.org))) return { note: `${a.name} is already in your contacts.` };
    const id = uid("c");
    ws.contacts.unshift({ id, name: a.name, title: a.title, org: a.org, email: "", why: a.why, tags: [], label: "Student provided", ...(a.met ? { met: a.met } : {}), ...(a.metOn ? { metOn: a.metOn } : {}) });
    return did("contact", id, `Added ${a.name}${a.org ? ` (${a.org})` : ""} to your contacts`, "/community");
  }
  if (a.kind === "dropTask") {
    const i = ws.tasks.findIndex((x) => x.id === a.taskId);
    if (i < 0) return { note: "I couldn't find that to-do, so nothing changed." };
    const [t] = ws.tasks.splice(i, 1);
    return did("dropTask", t.id, `Removed the to-do: ${t.title}`, "/", JSON.stringify({ i, t }));
  }
  if (a.kind === "roleOff") {
    const roles = ws.profile.targetRoles.split(/,\s*/).filter(Boolean), keep = roles.filter((r) => !same(r, a.title));
    if (keep.length === roles.length) return { note: `${a.title} wasn't in the roles I look for.` };
    ws.profile.targetRoles = keep.join(", ");
    refit(ws);
    return did("roleOff", a.title, `Stopped looking for ${a.title} openings`, "/opportunities", roles.join(", "));
  }
  if (a.kind === "cardNote") {
    const t = ws.tracker.find((x) => x.id === a.trackId);
    if (!t) return { note: "I couldn't find that card on your board, so nothing changed." };
    const old = t.notes || "";
    t.notes = (old ? old + "\n" : "") + a.note;
    return did("cardNote", t.id, `Noted on ${t.company}: ${a.note}`, "/progress", old);
  }
  if (a.kind === "restDays") {
    const g = (ws.game ||= { weeks: {} } as NonNullable<Workspace["game"]>);
    const old = JSON.stringify(g.restDays || []);
    g.restDays = a.days;
    return did("restDays", "restDays", a.days.length ? `Rest days: ${a.days.map((d) => DAYS[d]).join(", ")}. Your streak won't break on those days` : "No rest days now", "/path", old);
  }
  if (a.kind === "dropContact") {
    const i = ws.contacts.findIndex((x) => x.id === a.contactId);
    if (i < 0) return { note: "I couldn't find that contact, so nothing changed." };
    const [c] = ws.contacts.splice(i, 1);
    return did("dropContact", c.id, `Removed ${c.name} from your contacts`, "/community", JSON.stringify({ i, c }));
  }
  if (a.kind === "forget") {
    const m = ws.memory.find((x) => x.id === a.factId);
    if (!m) return { note: "I couldn't find that in what I remember, so nothing changed." };
    ws.memory = ws.memory.filter((x) => x.id !== m.id);
    return did("forget", m.id, `Forgot: ${m.text}`, "/accounts?tab=memory", JSON.stringify(m));
  }
  if (a.kind === "go") return did("go", a.link, `Opened ${a.label}`, a.link, undefined, true);
  // "start": the app does it as soon as the reply arrives (client/src/lib/remyDoes.ts).
  if (a.what === "resumeFix") {
    if (!ws.resume) return { note: "Add your resume first (Resume → Upload), then I can fix it with you." };
    return did("start", "resumeFix", "Started fixing your resume with you, one line at a time", "/resume?tab=base", undefined, true);
  }
  if (a.what === "interview") {
    const j = a.jobId ? findJob(ws, a.jobId) : undefined;
    return did("start", "interview", `Started a mock interview${j ? ` for ${j.title} at ${j.company}` : ""}`, `/interview?start=1${j ? `&job=${encodeURIComponent(j.id)}` : ""}`, undefined, true);
  }
  return did("start", "tour", "Started the tour of Remy", "/", undefined, true);
}

/** A prep sheet for an interview, only from what the student already has: the opening, their pitch and their stories. */
export function prepSheet(ws: Workspace, c: Workspace["calendar"][number], findJob: (ws: Workspace, id: string) => Job | undefined): string {
  const j = c.linkedId ? findJob(ws, c.linkedId) : ws.jobs.find((x) => c.title.toLowerCase().includes(x.company.toLowerCase()));
  const stories = (ws.stories || []).filter((s) => s.action || s.result).sort((a, b) => Number(!!b.result) - Number(!!a.result)).slice(0, 3);
  return [
    PREP_HEAD,
    j ? `Role: ${j.title} at ${j.company}${j.summary ? `. ${j.summary.slice(0, 200)}` : ""}` : "",
    ws.pitch?.text ? `Your 30-second pitch: ${ws.pitch.text.slice(0, 500)}` : "Your 30-second pitch: not written yet (Interview → Pitch).",
    stories.length ? `Stories to tell:\n${stories.map((s) => `• ${s.title}: ${[s.action, s.result].filter(Boolean).join(" ").slice(0, 220)}`).join("\n")}` : "Stories to tell: build a few on Interview → Stories.",
    `Ask them:\n• What does a great first few months look like in this role?\n• What do people on the team enjoy most about working here?${j ? `\n• What's the next step after this interview?` : ""}`,
  ].filter(Boolean).join("\n\n");
}

/** Undo one of these. Returns why it can't be undone, or null when it was (or it isn't one of these: false). */
export function undoMore(ws: Workspace, d: ChatDid): string | null | false {
  const old = String(d.old ?? "");
  switch (d.kind) {
    case "interest": case "unhide": {
      const o = JSON.parse(old) as { fb: NonNullable<Workspace["jobFeedback"]>[string] | null; hidden: boolean; saved: boolean };
      const fb = (ws.jobFeedback ||= {});
      if (o.fb) fb[d.ref] = o.fb; else delete fb[d.ref];
      ws.hiddenJobIds = ws.hiddenJobIds.filter((x) => x !== d.ref).concat(o.hidden ? [d.ref] : []);
      ws.savedJobIds = ws.savedJobIds.filter((x) => x !== d.ref).concat(o.saved ? [d.ref] : []);
      return null;
    }
    case "prefs": ws.profile[d.ref as PrefField] = old; refit(ws); return null;
    case "nudges": ws.settings.nudges = old as "daily" | "weekly" | "off"; return null;
    case "careerTime": ws.settings.careerTime = JSON.parse(old); return null;
    case "quiet": if (old) ws.settings.quietUntil = old; else delete ws.settings.quietUntil; return null;
    case "textsOff": return "Turn texts back on in Account → Settings, so you can check the number they go to.";
    case "track": {
      const t = ws.tracker.find((x) => x.id === d.ref);
      if (!t) return null;
      if (!old) { ws.tracker = ws.tracker.filter((x) => x.id !== d.ref); return null; }
      t.status = old as TrackStatus;
      t.events = t.events.filter((e) => e.source !== "Told Remy in chat" || e.status === t.status);
      return null;
    }
    case "moveEvent": { const c = ws.calendar.find((x) => x.id === d.ref); if (c) Object.assign(c, JSON.parse(old)); return null; }
    case "removeEvent": if (!ws.calendar.some((x) => x.id === d.ref)) ws.calendar.push(JSON.parse(old)); return null;
    case "prep": { const c = ws.calendar.find((x) => x.id === d.ref); if (c) c.notes = old; return null; }
    case "due": { const t = ws.tasks.find((x) => x.id === d.ref); if (t) t.due = old; return null; }
    case "hours": ws.hours = (ws.hours || []).filter((h) => h.id !== d.ref); return null;
    case "career": if (ws.plan) ws.plan.chosenCareerId = old || undefined; return null;
    case "contact": ws.contacts = ws.contacts.filter((c) => c.id !== d.ref); return null;
    case "dropTask": { const o = JSON.parse(old); if (!ws.tasks.some((t) => t.id === d.ref)) ws.tasks.splice(o.i, 0, o.t); return null; }
    case "roleOff": ws.profile.targetRoles = old; refit(ws); return null;
    case "cardNote": { const t = ws.tracker.find((x) => x.id === d.ref); if (t) t.notes = old; return null; }
    case "restDays": if (ws.game) ws.game.restDays = JSON.parse(old); return null;
    case "dropContact": { const o = JSON.parse(old); if (!ws.contacts.some((c) => c.id === d.ref)) ws.contacts.splice(o.i, 0, o.c); return null; }
    case "forget": if (!ws.memory.some((m) => m.id === d.ref)) ws.memory.push(JSON.parse(old)); return null;
    case "go": case "start": return "That only opened something, so there's nothing to undo.";
  }
  return false;
}

/** What the model needs to know (with ids) to do these, added to the chat's context for owners. */
export function moreContext(ws: Workspace, today: string, findJob: (ws: Workspace, id: string) => Job | undefined): string {
  const cal = ws.calendar.filter((c) => c.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 15).map((c) => `[id:${c.id}] ${c.date}${c.time ? " " + c.time : ""} ${c.kind}: ${c.title}`).join("; ");
  const board = ws.tracker.slice(0, 20).map((t) => `[id:${t.id}] ${t.company} ${t.role}: ${t.status}`).join("; ");
  const careers = ws.plan?.careers.map((c) => `[id:${c.id}] ${c.title}${c.id === ws.plan!.chosenCareerId ? " (their pick)" : ""}`).join("; ");
  const hidden = ws.hiddenJobIds.slice(-15).map((id) => { const j = findJob(ws, id); return j ? `[id:${j.id}] ${j.title} at ${j.company}` : ""; }).filter(Boolean).join("; ");
  const facts = ws.memory.filter((m) => m.status === "approved").slice(0, 25).map((m) => `[id:${m.id}] ${m.text}`).join("; ");
  const emails = (ws.emails || []).slice(-8).reverse().map((e) => `${e.at.slice(0, 10)} ${e.kind}: "${e.subject}"`).join("; ");
  const p = ws.profile, s = ws.settings;
  return [
    `UPCOMING ON THEIR CALENDAR (ids): ${cal || "(nothing)"}`,
    `PROGRESS BOARD (ids): ${board || "(empty)"}`,
    `CAREERS ON MY PATH (ids): ${careers || "(not built yet)"}`,
    `CONTACTS (ids): ${ws.contacts.slice(0, 25).map((c) => `[id:${c.id}] ${c.name}${c.org ? ` (${c.org})` : ""}`).join("; ") || "(none)"}`,
    `ROLES YOU SEARCH FOR: ${ws.profile.targetRoles || "(none)"}; STREAK REST DAYS: ${(ws.game?.restDays || []).map((d) => DAYS[d]).join(", ") || "none"}`,
    `OPENINGS THEY PASSED ON (ids): ${hidden || "(none)"}`,
    `WHAT REMY REMEMBERS (ids): ${facts || "(nothing)"}`,
    `EMAILS YOU (REMY) SENT THEM, newest first (say so if they ask; never claim others): ${emails || "(none yet)"}`,
    `SEARCH PREFERENCES: regions="${p.regions}"; opportunityTypes="${p.opportunityTypes}"; timeline="${p.timeline || ""}"; avoid="${p.avoid || ""}"; dreamEmployers="${p.dreamEmployers || ""}"; interests="${p.interests}"; goals="${p.goals}"; classYear="${p.classYear}"`,
    `SETTINGS: theme=${s.theme}; opening emails=${s.nudges || "weekly"}; deadline emails=${s.notify.deadlines ? "on" : "off"}; weekly plan email=${s.notify.weeklyPlan ? "on" : "off"}; texts=${s.texts?.on ? "on" : "off"}; weekly career time=${s.careerTime ? `${DAYS[s.careerTime.day]} ${s.careerTime.time}` : "none"}; quiet=${quietOn(s, today) ? `until ${s.quietUntil}` : "off"}`,
  ].join("\n");
}

export const MORE_TOOLS = `More things you DO yourself with "actions" (each shows with Undo): {"kind":"interest","jobId":"<id>","more":true|false} = Keep it (saves it, more like it) or Pass on it (hides it, fewer like it); {"kind":"unhide","jobId":"<id>"} brings back an opening they PASSED ON; {"kind":"prefs","field":"regions"|"opportunityTypes"|"timeline"|"avoid"|"dreamEmployers"|"interests"|"goals"|"classYear"|"relocation"|"workAuth","value":"text","mode":"set"|"add"|"remove"} changes their SEARCH PREFERENCES (add/remove for comma lists like "Austin" or "Internships"); {"kind":"nudges","value":"daily"|"weekly"|"off"} how often Remy emails new openings; {"kind":"careerTime","day":0-6 (0 = Sunday),"time":"HH:MM"} or {"kind":"careerTime","off":true} their weekly career time; {"kind":"quiet","days":7} = "quiet week": for that many days (1-30) you make no offers or check-ins and send no opening or weekly emails (deadline reminders still go), {"kind":"quiet","days":0} ends it ("I'm back"); {"kind":"textsOff"} stops deadline texts (turning texts ON needs their phone, so open /accounts?tab=settings); {"kind":"track","trackId":"<id>","status":"Applied"|"Interview"|"Offer"|"Rejected"|"Heard back"|"No reply"|"Withdrawn"|"Saved"|"Received"} moves a PROGRESS BOARD card, or {"kind":"track","company":"","role":"","jobId":"<id or empty>","status":"..."} adds one when they tell you they applied, got an interview, an offer or a rejection; {"kind":"moveEvent","calId":"<id>","date":"YYYY-MM-DD","time":"HH:MM or empty"} reschedules; {"kind":"removeEvent","calId":"<id>"} takes something off their calendar; {"kind":"prep","calId":"<id>"} puts a one-page prep sheet on an interview (their pitch, their best stories, questions to ask), built only from what they already have; {"kind":"due","taskId":"<id>","due":"YYYY-MM-DD or empty"} changes a to-do's due date; {"kind":"hours","activity":"Volunteering","hours":2,"date":"YYYY-MM-DD","note":""} logs hours they already did; {"kind":"career","careerId":"<id>"} picks a career on My Path; {"kind":"contact","name":"","org":"","title":"","why":"","met":"where they met","metOn":"YYYY-MM-DD"} adds someone they met to Community (never an email address they didn't give); {"kind":"forget","factId":"<id>"} forgets something Remy remembers; {"kind":"dropTask","taskId":"<id>"} removes an OPEN TO-DO they don't want (use "done" if they did it); {"kind":"roleOff","title":"role"} stops searching for a role in ROLES YOU SEARCH FOR; {"kind":"cardNote","trackId":"<id>","note":"short note"} adds a note to a PROGRESS BOARD card (a recruiter's name, what they said, a salary range they gave); {"kind":"restDays","days":[0,6]} sets up to 3 weekdays (0 = Sunday) their streak skips without breaking, [] for none; {"kind":"dropContact","contactId":"<id>"} removes someone from CONTACTS.
Things the app does as soon as you reply: {"kind":"go","link":"/opportunities?kind=jobs|campus|event|all&role=<title>","label":"Opportunities"} (or any page: /, /resume?tab=base|tailor|linkedin, /interview, /path?tab=career|road|future, /community, /calendar, /progress?tab=tracker|hours, /accounts?tab=profile|settings|memory) takes them there when they say "take me to", "show me" or "open"; {"kind":"start","what":"resumeFix"} when they ask you to fix, improve or strengthen their (base) resume: you then ask about one weak line at a time in this chat and draft each from their answer, so reply with one short line like "Let's do it, one line at a time."; {"kind":"start","what":"interview","jobId":"<id or empty>"} starts a mock interview; {"kind":"start","what":"tour"} replays the tour. For a cover letter, use "tailor" (it writes the resume and the letter).
When the student mentions something coming up that you should ask about later (an interview, a career fair, a decision, a worry about an exam), also return "followUp":{"ask":"the warm question you'll ask, e.g. How did the PwC interview go?","on":"YYYY-MM-DD, the day after it"}; otherwise leave it out.\nAsk first, and only offer an "open" button, for anything that can't be undone or leaves Remy: deleting their account or data, clearing their resume, sending an email or applying (they do those themselves). Use ids only from the lists given. Up to 4 actions. When you just did what they asked, keep the reply to one or two short lines about that; you may end with ONE short question offering the closely related next step you can do yourself (saved an opening: \"Want me to start your resume for it?\"; added an interview: \"Want a mock interview for it?\"; logged an application: \"Want a follow-up to-do in two weeks?\"), but not when they said no to that kind of offer in RECENT CHAT, and never an unrelated step or earlier advice.`;

// ---------- Remy reaches out (owners, "Remy feels alive" #3 and #6) ----------
const daysApart = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);

/** The chat model's "followUp" ({ask, on}): something the student mentioned that Remy should ask about on that day. */
export function addLoop(ws: Workspace, raw: any, today: string) {
  const ask = clean(raw?.ask, 200), on = String(raw?.on || "");
  if (!ask || !isDate(on) || on <= today || daysApart(today, on) > 60) return;
  const loops = (ws.loops ||= []);
  if (loops.some((l) => !l.askedAt && same(l.ask, ask))) return;
  loops.push({ id: uid("lp"), ask, on });
  ws.loops = loops.slice(-30);
}

export const WEEKLY_CHECKIN = "Quick weekly check-in, 2 minutes: did you apply anywhere this week? Any news, like an interview, an offer or a no? And is anything stressing you? Tell me in your own words and I'll update your board, calendar and to-dos.";

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
/** Owners first (Nov 27, "get more students to ask Remy"): Remy's first message after setup, so nobody faces an empty
 *  chat. Built only from what Remy already worked out (stored fits, the resume), no AI call, so it can't invent anything.
 *  It ends with taps that start a real step. Once per student; never after they've written to him themselves. */
export function firstHello(ws: Workspace, today: string): { text: string; replies: string[] } | null {
  if (ws.remyHello || !ws.onboarding.done || ws.chat.some((m) => m.role === "user")) return null;
  const first = firstName(ws);
  const hi = first ? `Hi ${first}.` : "Hi.";
  const fits = ws.jobs.filter((j) => {
    const f = ws.fits[j.id];
    return f && !f.excluded && !f.closed && !f.hidden && f.eligibility !== "unlikely" && f.regionMatch !== false && j.kind !== "event"
      && !ws.hiddenJobIds.includes(j.id) && (!j.deadline || j.deadline.slice(0, 10) >= today);
  }).sort((a, b) => (ws.fits[b.id].score ?? 0) - (ws.fits[a.id].score ?? 0));
  if (fits.length) {
    const best = fits[0];
    const noun = fits.filter((j) => j.kind === "internship").length > fits.length / 2 ? "internship" : "opening";
    const due = best.deadline ? `, due ${dayLabel(best.deadline.slice(0, 10)).replace(/^\w+, /, "")}` : "";
    const tailor = `Tailor my resume for ${best.company}`;
    return {
      text: `${hi} I read your resume and found ${plural(fits.length, noun)} that fit${fits.length === 1 ? "s" : ""} you. The best one is ${best.title} at ${best.company}${due}. Want me to tailor your resume for it?`,
      replies: [tailor.length <= 44 ? tailor : "Tailor my resume for it", fits.length > 1 ? `Show me all ${fits.length}` : "Why does it fit me?"],
    };
  }
  if (ws.resume) return { text: `${hi} I read your resume. Want me to go through it with you and fix the weakest lines first? Nothing changes until you say yes.`, replies: ["Fix my resume with me", "Find openings for me"] };
  return null;
}

/** At most one message Remy starts himself when the student opens the app: his first hello after setup, a question he
 *  promised to ask, else the weekly check-in. Returns the text pushed into chat, or "" when there's nothing to say. */
export function reachOut(ws: Workspace, today: string, nowIso: string): string {
  if (quietOn(ws.settings, today)) return "";
  const hello = firstHello(ws, today);
  if (hello) {
    ws.remyHello = today;
    ws.chat.push({ id: uid("m"), role: "assistant", text: hello.text, at: nowIso, page: "Remy", replies: hello.replies });
    return hello.text;
  }
  const loops = (ws.loops ||= []);
  // A career fair or networking event that just passed: ask who they met (once), so Remy can add them to Community.
  const fair = ws.calendar.find((c) => /fair|network|meetup|mixer|info(rmation)? session/i.test(c.title) && c.date < today && daysApart(c.date, today) <= 3 && !loops.some((l) => l.id === `met:${c.id}`));
  if (fair) loops.push({ id: `met:${fair.id}`, ask: `How did ${fair.title} go? Did you meet anyone worth remembering? Tell me their names and where they work, and I'll add them to your contacts.`, on: today });
  const due = loops.find((l) => !l.askedAt && l.on <= today);
  let text = "";
  if (due) { due.askedAt = nowIso; text = due.ask; ws.loops = loops.slice(-30); }
  // shortcut: any day 7+ days after the last one (or a week into a busy account), not tied to the weekly career time yet.
  else if (ws.chat.length >= 2 && (ws.tracker.length || ws.savedJobIds.length) && (!ws.remyCheckin || daysApart(ws.remyCheckin, today) >= 7)
    && !ws.chat.slice(-6).some((m) => m.role === "assistant" && m.text === WEEKLY_CHECKIN)) { ws.remyCheckin = today; text = WEEKLY_CHECKIN; }
  if (text) ws.chat.push({ id: uid("m"), role: "assistant", text, at: nowIso, page: "Remy" });
  return text;
}
