// Career quest (owners only while it's tested, Nov 19): weekly missions that finish themselves when the student does
// the real thing, a weekly streak (one mission keeps it; one freeze covers a missed week), XP and levels, and badges
// only for real wins. Research (Duolingo, SDT "pointsification"): streaks must be easy to keep and forgiving, and
// points must sit on actions that visibly change something. Weekly, not daily: nobody job-hunts every day.
import type { Workspace } from "./types";

export type Counters = Record<string, number>;
const SENT = new Set(["Applied", "Received", "Heard back", "Interview", "Offer", "Rejected", "No reply"]);
export type GameWeek = { base: Counters; done: string[]; missions?: string[] };
export type GameState = { weeks: Record<string, GameWeek>; bestLevel?: number };
export type Mission = { key: string; title: string; counter: string; target: number; mins: number; xp: number; effect: string; link: string };

/** What the student has done so far, counted from the workspace (nothing extra is tracked). */
export function counters(w: Workspace): Counters {
  const bullets = (w.resume?.doc.sections || []).flatMap((s) => s.entries.flatMap((e) => e.bullets));
  return {
    rated: Object.keys(w.jobFeedback || {}).length,
    storyParts: (w.stories || []).reduce((n, s) => n + (s.mine?.length || 0), 0),
    numbered: bullets.filter((b) => /\d/.test(b.text)).length,
    contacts: w.contacts.length,
    saved: w.savedJobIds.length,
    tailored: w.applications.filter((a) => a.versions.length > 0).length,
    // Sent once means sent: withdrawing later keeps it (council, Nov 19); deleting the row removes it.
    sent: w.tracker.filter((t) => SENT.has(t.status) || t.events.some((e) => SENT.has(e.status))).length,
  };
}

const POOL: Mission[] = [
  { key: "rate", title: "Rate 3 openings", counter: "rated", target: 3, mins: 2, xp: 45, effect: "Your matches get sharper right away", link: "/opportunities" },
  { key: "story", title: "Answer 1 interview story question", counter: "storyParts", target: 1, mins: 3, xp: 40, effect: "One step closer to a story you can tell", link: "/interview" },
  { key: "number", title: "Add a real number to 1 bullet", counter: "numbered", target: 1, mins: 2, xp: 40, effect: "Recruiters believe lines with numbers", link: "/resume?tab=base" },
  { key: "person", title: "Add someone you met", counter: "contacts", target: 1, mins: 2, xp: 40, effect: "Remy reminds you to follow up", link: "/community" },
  { key: "save", title: "Save 2 openings you'd apply to", counter: "saved", target: 2, mins: 3, xp: 35, effect: "Deadlines go on your calendar", link: "/opportunities" },
  // Sending also earns 120 XP as a real win, so the habit mission pays a normal rate (council, Nov 19); offered only
  // once something is tailored, so a freshman never gets a mission they can't do.
  { key: "apply", title: "Send 1 application", counter: "sent", target: 1, mins: 10, xp: 35, effect: "The step that gets interviews", link: "/progress" },
  { key: "tailor", title: "Tailor your resume for 1 opening", counter: "tailored", target: 1, mins: 5, xp: 80, effect: "A version made for that posting", link: "/opportunities" },
];
// "Log a win" (council, Nov 19): an optional bonus each week, never one of the three, so nobody types junk to save a
// streak. Done when the student approves a resume line from one sentence about their week (a "Check-in" fact).
export const WIN = { key: "win", title: "Log a win", xp: 30 };
// The fact's own local date, inside this week only: a Sunday-evening win (Monday in UTC) isn't counted twice (skeptic).
const localDay = (iso: string) => { const d = new Date(iso); return isNaN(+d) ? "" : d.toLocaleDateString("en-CA"); };
const nextWeek = (key: string) => { const d = new Date(key + "T12:00:00"); d.setDate(d.getDate() + 7); return d.toLocaleDateString("en-CA"); };
export const winThisWeek = (w: Workspace, key: string) => w.memory.some((m) => { const d = localDay(m.createdAt || ""); return m.source === "Check-in" && m.status === "approved" && d >= key && d < nextWeek(key); });
export const ALL_DONE_BONUS = 50;
// Names for effort, never outcomes (council review, Nov 19: "Hired" could be reached without being hired). Real outcomes
// are badges tied to real events.
export const LEVELS: [string, number][] = [["Rookie", 0], ["Explorer", 300], ["Builder", 800], ["Pro", 1600], ["Legend", 3000]];

/** Monday-based week key in the student's own time zone, like "2026-11-16". */
export function weekKey(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.toLocaleDateString("en-CA");
}
const prevWeek = (key: string) => { const d = new Date(key + "T12:00:00"); d.setDate(d.getDate() - 7); return d.toLocaleDateString("en-CA"); };

/** This week's 3 missions: varied by week, skipping ones that don't fit yet (no resume → no bullet mission). */
export function weekMissions(w: Workspace, key: string): Mission[] {
  const ok = POOL.filter((m) => (m.key === "number" ? !!w.resume : m.key === "story" ? (w.stories || []).some((s) => !(s.situation && s.task && s.action && s.result)) : m.key === "apply" ? w.applications.some((a) => a.versions.length > 0) : true));
  const seed = [...key].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const start = seed % Math.max(1, ok.length);
  return [...ok.slice(start), ...ok.slice(0, start)].slice(0, 3);
}

/** The week's 3 missions: fixed when the week is first recorded, so finishing a story or adding a resume mid-week
 *  never reshuffles the board or drops a mission already done (skeptic review). */
export function missionsOf(w: Workspace, g: GameState, key: string): Mission[] {
  const keys = g.weeks[key]?.missions;
  return keys?.length ? keys.map((k) => POOL.find((m) => m.key === k)).filter((m): m is Mission => !!m) : weekMissions(w, key);
}
/** Missions finished this week: the counter went up by the target since the week began (or recorded earlier). */
export function doneThisWeek(w: Workspace, g: GameState, key: string, now: Counters): string[] {
  const week = g.weeks[key];
  if (!week) return [];
  const mine = missionsOf(w, g, key);
  const fresh = mine.filter((m) => (now[m.counter] || 0) - (week.base[m.counter] || 0) >= m.target).map((m) => m.key);
  return [...new Set([...week.done, ...fresh])].filter((k) => mine.some((m) => m.key === k));
}

/** Weeks in a row with at least one mission, counting back from this week (or last week, while this one is open).
 *  One missed week inside the run is covered by the freeze. */
export function streak(g: GameState, key: string): { weeks: number; freezeUsed: boolean } {
  const has = (k: string) => (g.weeks[k]?.done.length || 0) > 0;
  let k = has(key) ? key : prevWeek(key), n = 0, freezeUsed = false;
  for (let i = 0; i < 104; i++) {
    if (has(k)) n++;
    // One missed week is covered when the run continues right before it, also on a Monday when nothing's done yet.
    else if (!freezeUsed && has(prevWeek(k))) freezeUsed = true;
    else break;
    k = prevWeek(k);
  }
  return { weeks: n, freezeUsed };
}

/** XP: missions done (plus a bonus for all three in a week) and real wins. */
export function xpOf(w: Workspace, g: GameState): number {
  const byKey = new Map([...POOL.map((m) => [m.key, m.xp] as [string, number]), [WIN.key, WIN.xp]]);
  const missions = Object.values(g.weeks).reduce((n, wk) => n + wk.done.reduce((t, k) => t + (byKey.get(k) || 0), 0) + (wk.done.length >= 3 && (!wk.missions || wk.missions.every((m) => wk.done.includes(m))) ? ALL_DONE_BONUS : 0), 0);
  const c = counters(w);
  const interviews = w.tracker.filter((t) => t.status === "Interview" || t.status === "Offer").length;
  // Each application counts once, as a real win; there's no "send an application" mission (council, Nov 19).
  return missions + (w.resume?.confirmedAt ? 100 : 0) + 120 * c.sent + 250 * interviews + (w.tracker.some((t) => t.status === "Offer") ? 500 : 0);
}
/** Levels never drop (council, Nov 19): the best level reached is kept even if XP later goes down. */
export function levelOf(xp: number, best = 0) {
  let i = 0; for (let k = 0; k < LEVELS.length; k++) if (xp >= LEVELS[k][1]) i = k;
  i = Math.max(i, Math.min(LEVELS.length - 1, Math.max(0, best - 1)));
  const next = LEVELS[Math.min(i + 1, LEVELS.length - 1)][1];
  return { n: i + 1, name: LEVELS[i][0], floor: LEVELS[i][1], next, max: i === LEVELS.length - 1 };
}
/** Badges only for wins a recruiter would recognize. */
export function badges(w: Workspace) {
  const c = counters(w);
  return [
    { label: "Resume ready", done: !!w.resume?.confirmedAt },
    { label: "First story", done: (w.stories || []).some((s) => s.situation && s.task && s.action && s.result) },
    { label: "First application", done: c.sent > 0 },
    { label: "First interview", done: w.tracker.some((t) => t.status === "Interview" || t.status === "Offer") },
    { label: "First offer", done: w.tracker.some((t) => t.status === "Offer") },
  ];
}
