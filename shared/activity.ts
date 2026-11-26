// Remy panel, owners first (Dilan, Nov 23): Activity shows every past session grouped by day, and the empty Chat tab
// opens with what happened today, so Remy reaches out first.
import type { Workspace } from "./types";

export type ActKind = "chat" | "did" | "found" | "apply" | "step";
export interface ActEvent { kind: ActKind; text: string; at: string; count?: number; link?: string }
export interface ActDay { day: string; events: ActEvent[]; chat: Workspace["chat"] }

/** Local calendar day (YYYY-MM-DD) of an ISO time. */
export const dayOf = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

// Remy's own record of what he did, in plain words (the AI log's purposes).
const DID: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Parse resume/i, () => "Read your resume"], [/^Initial plan/i, () => "Built your career plan"], [/^Pick employers/i, () => "Picked employers to check for you"],
  [/^Assistant chat/i, () => "Answered you in chat"], [/^Tailor for (.+)/i, (m) => `Tailored your resume for ${m[1]}`], [/^Import posting/i, () => "Read a posting you added"],
  [/^Import LinkedIn/i, () => "Read your LinkedIn profile"], [/^Story deck/i, () => "Drafted interview stories"], [/^Explain fit/i, () => "Explained why an opening fits"],
  [/^Fix (rewrites|letter) for (.+)/i, (m) => `Double-checked your ${m[1] === "letter" ? "cover letter" : "resume changes"} for ${m[2]}`], [/^Classify email/i, () => "Sorted a recruiting email"],
];
export const didLabel = (purpose: string) => { for (const [re, f] of DID) { const m = purpose.match(re); if (m) return f(m); } return purpose; };

const STEP: Partial<Record<NonNullable<Workspace["steps"]>[number]["kind"], string>> = {
  task: "You finished a to-do", save: "You saved an opening", approve: "You approved resume changes", outreach: "You drafted a message to someone", resume: "You updated your resume",
};

/** Every day with something in it, newest first. Chat turns are one "session" per day (its messages kept for expanding). */
type Fits = Record<string, { excluded?: boolean; regionMatch?: boolean | null }>;
const fitsYou = (fits: Fits, id: string) => !fits[id]?.excluded && fits[id]?.regionMatch !== false; // same filter as Home

export function activityDays(w: Pick<Workspace, "chat" | "aiLog" | "jobs" | "applications" | "steps">, fits: Fits = {}): ActDay[] {
  const days = new Map<string, ActDay>();
  const at = (iso: string) => { const k = dayOf(iso); let d = days.get(k); if (!d) days.set(k, d = { day: k, events: [], chat: [] }); return d; };
  // Same thing several times a day reads as one line with a count.
  const add = (e: ActEvent) => { const d = at(e.at); const same = d.events.find((x) => x.kind === e.kind && x.text === e.text); if (same) { same.count = (same.count || 1) + (e.count || 1); if (e.at > same.at) same.at = e.at; } else d.events.push(e); };
  for (const m of w.chat) if (m.at) at(m.at).chat.push(m);
  for (const x of w.aiLog) if (x.ok && x.at && !/^Assistant chat/i.test(x.purpose)) add({ kind: "did", text: didLabel(x.purpose), at: x.at });
  for (const j of w.jobs) if (j.foundAt && fitsYou(fits, j.id)) add({ kind: "found", text: "Found new openings for you", at: j.foundAt, link: "/opportunities" });
  const jobName = new Map(w.jobs.map((j) => [j.id, `${j.title} at ${j.company}`]));
  for (const a of w.applications) if (a.createdAt) add({ kind: "apply", text: `Started an application: ${jobName.get(a.jobId) || "an opening"}`, at: a.createdAt, link: "/progress" });
  for (const s of w.steps || []) { const t = STEP[s.kind]; if (t && s.at) add({ kind: "step", text: t, at: s.at }); }
  const out = [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
  for (const d of out) {
    for (const e of d.events) if (e.kind === "found") { e.text = `Found ${e.count && e.count > 1 ? `${e.count} new openings` : "a new opening"} for you`; e.count = undefined; }
    if (d.chat.length) d.events.push({ kind: "chat", text: "You and Remy talked", at: d.chat[d.chat.length - 1].at, count: d.chat.length });
    d.events.sort((a, b) => b.at.localeCompare(a.at));
  }
  return out;
}

export interface TodayRow { kind: "new" | "due" | "did" | "next"; text: string; link?: string }
/** What Remy opens the empty chat with: new openings in the last day, the nearest deadline, what he did today, the next to-do. */
export function todayBrief(w: Pick<Workspace, "jobs" | "hiddenJobIds" | "calendar" | "tasks" | "aiLog">, now = new Date(), fits: Fits = {}): TodayRow[] {
  const today = dayOf(now.toISOString());
  const dayAgo = new Date(now.getTime() - 864e5).toISOString();
  const rows: TodayRow[] = [];
  const fresh = w.jobs.filter((j) => (j.foundAt || "") > dayAgo && !w.hiddenJobIds.includes(j.id) && fitsYou(fits, j.id));
  if (fresh.length) rows.push({ kind: "new", text: fresh.length === 1 ? `New opening: ${fresh[0].title} at ${fresh[0].company}` : `${fresh.length} new openings since yesterday, like ${fresh[0].company}`, link: "/opportunities" });
  const inDays = (d: string) => Math.round((Date.parse(d + "T12:00:00") - Date.parse(today + "T12:00:00")) / 864e5);
  const due = [...w.calendar.map((c) => ({ title: c.title, date: c.date, due: !["Interview", "Event", "Advising"].includes(c.kind) })), ...w.tasks.filter((t) => !t.done && t.due).map((t) => ({ title: t.title, date: t.due!, due: true }))]
    .filter((x) => x.date && inDays(x.date.slice(0, 10)) >= 0 && inDays(x.date.slice(0, 10)) <= 7).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (due) { const n = inDays(due.date.slice(0, 10)); rows.push({ kind: "due", text: `${due.title} is ${due.due ? "due " : ""}${n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`}`, link: "/calendar" }); }
  const did = w.aiLog.filter((x) => x.ok && x.at && dayOf(x.at) === today && !/^Assistant chat/i.test(x.purpose));
  if (did.length) rows.push({ kind: "did", text: did.length === 1 ? `I ${lower(didLabel(did[did.length - 1].purpose))} today` : `I did ${did.length} things for you today` });
  const next = w.tasks.find((t) => !t.done && t.title !== due?.title);
  if (next) rows.push({ kind: "next", text: `Next up: ${next.title}`, link: "/" });
  return rows;
}
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Owners ("Remy feels alive" #2): what happened while the student was away, in Remy's words, newest first (max 4). */
export function awayBrief(w: Pick<Workspace, "chat" | "aiLog" | "jobs" | "applications" | "steps">, since: string, fits: Fits = {}): ActEvent[] {
  return activityDays(w, fits).flatMap((d) => d.events).filter((e) => e.at > since && e.kind !== "chat" && e.kind !== "step").slice(0, 4);
}
