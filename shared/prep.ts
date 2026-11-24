// Interview prep chain (owners, Nov 24 2026; rewards brainstorm idea 4): with an interview on the calendar in the next
// 5 days, My Path swaps the weekly big move for four real prep steps, each checked from what Remy already keeps. It turns
// "I have an interview" panic into a plan. No new XP: every step already earns its own (stories, mock interviews, pins).
import type { Workspace } from "./types";
import { PREP_HEAD } from "./remyOffers";

export type PrepStep = { key: string; label: string; done: boolean; link: string };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);

/** The next interview within 5 days and its prep steps, or null. `today` is the student's day, YYYY-MM-DD. */
export function prepChain(w: Pick<Workspace, "calendar" | "pitch" | "stories" | "interviews">, today: string, now = Date.now()) {
  const c = w.calendar.filter((x) => x.kind === "Interview" && x.date >= today && daysBetween(today, x.date) <= 5).sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))[0];
  if (!c) return null;
  const stories = (w.stories || []).filter((s) => s.situation && s.task && s.action && s.result).length;
  const mock = (w.interviews || []).some((i) => i.finishedAt && now - Date.parse(i.finishedAt) < 7 * 864e5);
  const steps: PrepStep[] = [
    { key: "sheet", label: "Get Remy's prep sheet on the event", done: (c.notes || "").startsWith(PREP_HEAD), link: "/calendar" },
    { key: "pitch", label: "Save your 30-second pitch", done: !!w.pitch?.text?.trim(), link: "/interview" },
    { key: "stories", label: `Finish 2 interview stories (${Math.min(2, stories)} of 2)`, done: stories >= 2, link: "/interview" },
    { key: "mock", label: "Do a mock interview this week", done: mock, link: "/interview" },
  ];
  return { event: c, days: daysBetween(today, c.date), steps };
}
