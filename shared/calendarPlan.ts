import type { CalItem, Job, Workspace } from "./types";

/** One thing Remy suggests putting on the Calendar page (owners' "Remy's plan"), always from the student's own data:
 *  prep before a real interview, a real posting deadline, or a day for a to-do that has none. Nothing is invented. */
export type CalSuggestion =
  | { id: string; kind: "prep" | "deadline"; title: string; why: string; date: string; item: CalItem }
  | { id: string; kind: "todo"; title: string; why: string; date: string; taskId: string };

const DAY = 864e5;
const at = (d: string) => new Date(d + "T12:00:00Z").getTime();
const plus = (d: string, n: number) => new Date(at(d) + n * DAY).toISOString().slice(0, 10);
const gap = (from: string, to: string) => Math.round((at(to) - at(from)) / DAY);
const inDays = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

export function calendarPlan(w: Pick<Workspace, "calendar" | "tasks" | "jobs" | "savedJobIds" | "hiddenJobIds" | "fits">, today: string, max = 4): CalSuggestion[] {
  const onCal = (title: string, date?: string) => w.calendar.some((c) => c.title.trim().toLowerCase() === title.trim().toLowerCase() && (!date || c.date === date));
  const out: CalSuggestion[] = [];

  // Prep two days before each interview in the next two weeks (today if that's already passed).
  for (const iv of w.calendar.filter((c) => c.kind === "Interview" && c.date >= today && c.date <= plus(today, 14))) {
    const title = `Practice for ${iv.title.replace(/^interview\s*[:-]\s*/i, "")}`;
    if (onCal(title)) continue;
    const date = plus(iv.date, -2) < today ? today : plus(iv.date, -2);
    out.push({ id: "prep-" + iv.id, kind: "prep", title, date, why: `Interview ${inDays(gap(today, iv.date))}`,
      item: { id: "", title, date, time: "", kind: "Task", source: "Remy's plan", notes: `Prep for: ${iv.title}` } });
  }

  // Real posting deadlines not yet on the calendar: saved openings first, then the soonest others still open.
  const saved = new Set(w.savedJobIds);
  const open = (j: Job) => j.deadline >= today && !w.hiddenJobIds.includes(j.id) && !w.fits[j.id]?.closed && !w.fits[j.id]?.excluded && !w.fits[j.id]?.hidden;
  const jobs = w.jobs.filter(open).sort((a, b) => Number(saved.has(b.id)) - Number(saved.has(a.id)) || a.deadline.localeCompare(b.deadline));
  for (const j of jobs.slice(0, 4)) {
    const title = `${j.company} deadline: ${j.title}`;
    if (onCal(title, j.deadline) || w.calendar.some((c) => c.kind === "Deadline" && c.date === j.deadline && c.title.toLowerCase().includes(j.company.toLowerCase()))) continue;
    if (out.filter((s) => s.kind === "deadline").length >= 2) break;
    out.push({ id: "deadline-" + j.id, kind: "deadline", title: `${j.company} closes`, date: j.deadline, why: `${saved.has(j.id) ? "Saved" : "Your openings"} · ${j.title}`,
      item: { id: "", title, date: j.deadline, time: "", kind: "Deadline", source: "Opportunities", notes: j.applyUrl || "" } });
  }

  // To-dos with no day: give each the next weekday this week with the least on it, one to-do per day.
  const busy = (d: string) => w.calendar.filter((c) => c.date === d).length + w.tasks.filter((t) => !t.done && t.due === d).length;
  const days = Array.from({ length: 7 }, (_, i) => plus(today, i + 1)).filter((d) => ![0, 6].includes(new Date(at(d)).getUTCDay()));
  const used = new Set<string>();
  for (const t of w.tasks.filter((t) => !t.done && !t.due).slice(0, 2)) {
    const date = days.filter((d) => !used.has(d)).sort((a, b) => busy(a) - busy(b) || a.localeCompare(b))[0];
    if (!date) break;
    used.add(date);
    out.push({ id: "todo-" + t.id, kind: "todo", title: t.title.replace(/\.$/, ""), date, taskId: t.id, why: "To-do with no day yet" });
  }
  return out.slice(0, max);
}
