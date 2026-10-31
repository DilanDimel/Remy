import type { Step, Workspace } from "./types";

// Weekly momentum (the gamification proposal, phase 1). Points count real career steps only: never opening the
// app, chatting, regenerating AI text or mass-saving. Each step is recorded once (kind + ref), so a retry or a
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

/** Monday (Central time) of the week containing `day` (YYYY-MM-DD). */
export function weekStart(day: string): string {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** This week's active days, points and the streak in weeks (consecutive weeks that met the goal). */
export function weekly(ws: Workspace, today = central(new Date().toISOString())) {
  const goal = ws.settings.weeklyGoal || 3;
  const byWeek = new Map<string, Set<string>>();
  let points = 0;
  const thisWeek = weekStart(today);
  for (const s of ws.steps || []) {
    const day = central(s.at), wk = weekStart(day);
    if (!byWeek.has(wk)) byWeek.set(wk, new Set());
    byWeek.get(wk)!.add(day);
    if (wk === thisWeek) points += s.xp;
  }
  const days = [...(byWeek.get(thisWeek) || [])].sort();
  // The current week counts toward the streak once it's met; an unfinished week doesn't break it yet.
  let streak = days.length >= goal ? 1 : 0;
  for (let d = new Date(thisWeek + "T12:00:00Z"); ; ) {
    d.setUTCDate(d.getUTCDate() - 7);
    if ((byWeek.get(d.toISOString().slice(0, 10))?.size || 0) >= goal) streak++;
    else break;
  }
  return { goal, days, points, streak, weekOf: thisWeek };
}
