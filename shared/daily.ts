// Daily path (redesign stage 7, owners first, Nov 22 2026): a short daily "round" of cards on My Path and a forgiving
// daily streak. Research (Duolingo, Finch): one small action keeps the streak, freezes and rest days stop one missed day
// from ending it (people who lose a long streak often quit), and every card must change something real (Dilan, Oct 31:
// a days counter alone "didn't feel worth anything"). The weekly career quest (shared/game.ts) stays the layer above.
import type { GameState } from "./game";
import type { Workspace } from "./types";

export type DailyCard = "openings" | "role" | "forecast";
export const CARD_LABEL: Record<DailyCard, string> = { openings: "Today's openings", role: "What's the job?", forecast: "Higher or lower" };
export const CARD_XP = 10;
export const FREEZE_EVERY = 7; // one freeze earned per 7 streak days
export const FREEZE_MAX = 2;

/** The student's own day, like "2026-11-22". It rolls over at 4 AM, not midnight, so a late-night round still counts
 *  for the evening it belongs to (Dilan, Nov 22). */
export const DAY_STARTS_AT = 4;
export function dayKey(d = new Date()): string {
  const x = new Date(d.getTime() - DAY_STARTS_AT * 3600_000);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate()).toLocaleDateString("en-CA");
}
export const shiftDay = (key: string, n: number) => { const d = new Date(key + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const weekday = (key: string) => new Date(key + "T12:00:00").getDay(); // 0 = Sunday

export type DayStatus = "done" | "freeze" | "rest" | "missed" | "today" | "future";
/** The daily streak: days in a row with a card, counting back from today (or yesterday while today is still open).
 *  Rest days (weekdays the student picked) are skipped without breaking it. A missed day spends a freeze, earned one per
 *  7 streak days, up to 2 held. Returns the status of each day too, for the week dots and the calendar. */
export function dailyStreak(g: Pick<GameState, "days" | "restDays">, today = dayKey()) {
  const days = g.days || {}, rest = new Set(g.restDays || []);
  const has = (k: string) => (days[k]?.length || 0) > 0;
  // Walk forward from the oldest record so freezes are earned before they're spent, like a real run of days.
  const keys = Object.keys(days).filter(has).sort();
  const status: Record<string, DayStatus> = {};
  let run = 0, best = 0, freezes = 0;
  if (keys.length) {
    for (let k = keys[0]; k < today; k = shiftDay(k, 1)) {
      if (has(k)) { run++; status[k] = "done"; if (run % FREEZE_EVERY === 0) freezes = Math.min(FREEZE_MAX, freezes + 1); }
      else if (rest.has(weekday(k))) status[k] = "rest";
      else if (freezes > 0 && run > 0) { freezes--; status[k] = "freeze"; }
      else { run = 0; freezes = 0; status[k] = "missed"; }
      best = Math.max(best, run);
    }
  }
  const todayDone = has(today);
  if (todayDone) { run++; if (run % FREEZE_EVERY === 0) freezes = Math.min(FREEZE_MAX, freezes + 1); }
  status[today] = todayDone ? "done" : "today";
  best = Math.max(best, run);
  return { days: run, best, freezes, todayDone, status };
}

/** The days that count for the streak: a daily card, or anything real done in Remy that day (rating an opening, a
 *  career step like saving or tailoring, a message to Remy). Before Nov 23 only My Path cards counted, so a student
 *  who used Remy two days running still saw "0 day streak" and empty dots. For reading only: never save this. */
export function streakDays(w: Pick<Workspace, "game" | "jobFeedback" | "steps" | "chat">): Pick<GameState, "days" | "restDays"> {
  const days: Record<string, string[]> = { ...(w.game?.days || {}) };
  const add = (at?: string) => { if (!at) return; const t = new Date(at); if (isNaN(+t)) return; const k = dayKey(t); days[k] = [...(days[k] || []), "did"]; };
  for (const f of Object.values(w.jobFeedback || {})) add(f.updatedAt || f.createdAt);
  for (const s of w.steps || []) add(s.at);
  for (const m of w.chat || []) if (m.role === "user") add(m.at);
  return { days, restDays: w.game?.restDays };
}

/** This week's seven days (Monday first) with their status, for the dots under the streak. */
export function weekDots(g: Pick<GameState, "days" | "restDays">, today = dayKey()) {
  const { status } = dailyStreak(g, today);
  const mon = shiftDay(today, -((weekday(today) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const k = shiftDay(mon, i); return { key: k, label: "MTWTFSS"[i], status: (k > today ? "future" : status[k] || ((g.restDays || []).includes(weekday(k)) ? "rest" : "missed")) as DayStatus }; });
}

/** Adds a finished card to today, once. */
export function withCard(g: GameState, card: DailyCard | "email", today = dayKey()): GameState {
  const days = { ...(g.days || {}) };
  days[today] = [...new Set([...(days[today] || []), card])];
  // Keep about 14 months of days (the server keeps 430).
  const keep = Object.keys(days).sort().slice(-420);
  return { ...g, days: Object.fromEntries(keep.map((k) => [k, days[k]])) };
}

/** Answering Remy's match email (Yes or Not now) counts as that day's small action too (stage 5 hook). */
export const markDay = (g: GameState, day = dayKey()) => withCard(g, "email", day);

/** Daily cards add to the quest XP (shared/game.ts xpOf) at a small, fixed rate: points sit on actions, not on logins. */
export const dailyXp = (g: Pick<GameState, "days">) => Object.values(g.days || {}).reduce((n, d) => n + d.length * CARD_XP, 0);
