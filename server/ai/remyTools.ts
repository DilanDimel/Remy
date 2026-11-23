import type { ChatDid, Job, MoreAction, TrackStatus, Workspace } from "@shared/types";
import { uid } from "../platform/ids";

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
export const MORE_KINDS = new Set<string>(["interest", "unhide", "prefs", "nudges", "careerTime", "textsOff", "track", "moveEvent", "removeEvent", "due", "hours", "career", "contact", "forget", "go", "start"]);

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
    case "track": {
      if (!TRACK_STATUSES.includes(a.status)) return null;
      if (isId(a.trackId)) return { kind: "track", trackId: String(a.trackId), status: a.status };
      const company = clean(a.company, 80), role = clean(a.role, 120);
      return company ? { kind: "track", company, role, status: a.status, ...(isId(a.jobId) ? { jobId: String(a.jobId) } : {}) } : null;
    }
    case "moveEvent": return isId(a.calId) && isDate(a.date) ? { kind: "moveEvent", calId: String(a.calId), date: String(a.date), ...(isTime(a.time) ? { time: String(a.time) } : {}) } : null;
    case "removeEvent": return isId(a.calId) ? { kind: "removeEvent", calId: String(a.calId) } : null;
    case "due": return isId(a.taskId) && (isDate(a.due) || a.due === "") ? { kind: "due", taskId: String(a.taskId), due: String(a.due) } : null;
    case "hours": { const h = Number(a.hours); return clean(a.activity, 80) && h > 0 && h <= 24 && isDate(a.date) ? { kind: "hours", activity: clean(a.activity, 80), hours: Math.round(h * 4) / 4, date: String(a.date), ...(clean(a.note, 160) ? { note: clean(a.note, 160) } : {}) } : null; }
    case "career": return isId(a.careerId) ? { kind: "career", careerId: String(a.careerId) } : null;
    case "contact": return clean(a.name, 80) ? { kind: "contact", name: clean(a.name, 80), org: clean(a.org, 80), title: clean(a.title, 80), why: clean(a.why, 200), ...(isDate(a.metOn) ? { metOn: String(a.metOn) } : {}), ...(clean(a.met, 80) ? { met: clean(a.met, 80) } : {}) } : null;
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
    case "due": { const t = ws.tasks.find((x) => x.id === d.ref); if (t) t.due = old; return null; }
    case "hours": ws.hours = (ws.hours || []).filter((h) => h.id !== d.ref); return null;
    case "career": if (ws.plan) ws.plan.chosenCareerId = old || undefined; return null;
    case "contact": ws.contacts = ws.contacts.filter((c) => c.id !== d.ref); return null;
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
  const p = ws.profile, s = ws.settings;
  return [
    `UPCOMING ON THEIR CALENDAR (ids): ${cal || "(nothing)"}`,
    `PROGRESS BOARD (ids): ${board || "(empty)"}`,
    `CAREERS ON MY PATH (ids): ${careers || "(not built yet)"}`,
    `OPENINGS THEY PASSED ON (ids): ${hidden || "(none)"}`,
    `WHAT REMY REMEMBERS (ids): ${facts || "(nothing)"}`,
    `SEARCH PREFERENCES: regions="${p.regions}"; opportunityTypes="${p.opportunityTypes}"; timeline="${p.timeline || ""}"; avoid="${p.avoid || ""}"; dreamEmployers="${p.dreamEmployers || ""}"; interests="${p.interests}"; goals="${p.goals}"; classYear="${p.classYear}"`,
    `SETTINGS: theme=${s.theme}; opening emails=${s.nudges || "weekly"}; deadline emails=${s.notify.deadlines ? "on" : "off"}; weekly plan email=${s.notify.weeklyPlan ? "on" : "off"}; texts=${s.texts?.on ? "on" : "off"}; weekly career time=${s.careerTime ? `${DAYS[s.careerTime.day]} ${s.careerTime.time}` : "none"}`,
  ].join("\n");
}

export const MORE_TOOLS = `More things you DO yourself with "actions" (each shows with Undo): {"kind":"interest","jobId":"<id>","more":true|false} = Keep it (saves it, more like it) or Pass on it (hides it, fewer like it); {"kind":"unhide","jobId":"<id>"} brings back an opening they PASSED ON; {"kind":"prefs","field":"regions"|"opportunityTypes"|"timeline"|"avoid"|"dreamEmployers"|"interests"|"goals"|"classYear"|"relocation"|"workAuth","value":"text","mode":"set"|"add"|"remove"} changes their SEARCH PREFERENCES (add/remove for comma lists like "Austin" or "Internships"); {"kind":"nudges","value":"daily"|"weekly"|"off"} how often Remy emails new openings; {"kind":"careerTime","day":0-6 (0 = Sunday),"time":"HH:MM"} or {"kind":"careerTime","off":true} their weekly career time; {"kind":"textsOff"} stops deadline texts (turning texts ON needs their phone, so open /accounts?tab=settings); {"kind":"track","trackId":"<id>","status":"Applied"|"Interview"|"Offer"|"Rejected"|"Heard back"|"No reply"|"Withdrawn"|"Saved"|"Received"} moves a PROGRESS BOARD card, or {"kind":"track","company":"","role":"","jobId":"<id or empty>","status":"..."} adds one when they tell you they applied, got an interview, an offer or a rejection; {"kind":"moveEvent","calId":"<id>","date":"YYYY-MM-DD","time":"HH:MM or empty"} reschedules; {"kind":"removeEvent","calId":"<id>"} takes something off their calendar; {"kind":"due","taskId":"<id>","due":"YYYY-MM-DD or empty"} changes a to-do's due date; {"kind":"hours","activity":"Volunteering","hours":2,"date":"YYYY-MM-DD","note":""} logs hours they already did; {"kind":"career","careerId":"<id>"} picks a career on My Path; {"kind":"contact","name":"","org":"","title":"","why":"","met":"where they met","metOn":"YYYY-MM-DD"} adds someone they met to Community (never an email address they didn't give); {"kind":"forget","factId":"<id>"} forgets something Remy remembers.
Things the app does as soon as you reply: {"kind":"go","link":"/opportunities?kind=jobs|campus|event|all&role=<title>","label":"Opportunities"} (or any page: /, /resume?tab=base|tailor|linkedin, /interview, /path?tab=career|road|future, /community, /calendar, /progress?tab=tracker|hours, /accounts?tab=profile|settings|memory) takes them there when they say "take me to", "show me" or "open"; {"kind":"start","what":"resumeFix"} when they ask you to fix, improve or strengthen their (base) resume: you then ask about one weak line at a time in this chat and draft each from their answer, so reply with one short line like "Let's do it, one line at a time."; {"kind":"start","what":"interview","jobId":"<id or empty>"} starts a mock interview; {"kind":"start","what":"tour"} replays the tour. For a cover letter, use "tailor" (it writes the resume and the letter).
Ask first, and only offer an "open" button, for anything that can't be undone or leaves Remy: deleting their account or data, clearing their resume, sending an email or applying (they do those themselves). Use ids only from the lists given. Up to 4 actions.`;
