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
