import type { Workspace } from "@shared/types";
import { milestones } from "@shared/progress";

const days = (from: string, to: string) => Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 864e5);

/** Deadline reminders still to send: once 1–3 days before a calendar deadline, and once on the day. Each is sent
 * only once (its key is remembered), and only when the student left deadline reminders on. */
export function dueReminders(ws: Workspace, today: string) {
  if (!ws.settings.notify.deadlines || !ws.onboarding.done) return [];
  const sent = new Set(ws.reminded || []);
  const out: { key: string; title: string; date: string; left: number }[] = [];
  for (const c of ws.calendar) {
    if (c.kind !== "Deadline" || !c.date) continue;
    const left = days(today, c.date);
    const key = `${c.id}:${c.date}:${left === 0 ? "day" : "soon"}`;
    if ((left === 0 || (left >= 1 && left <= 3)) && !sent.has(key)) out.push({ key, title: c.title, date: c.date, left });
  }
  return out;
}

export function reminderEmail(name: string, items: { title: string; date: string; left: number }[], host: string) {
  const when = (l: number) => (l === 0 ? "today" : l === 1 ? "tomorrow" : `in ${l} days`);
  const lines = items.map((i) => `• ${i.title}: closes ${when(i.left)} (${i.date})`).join("\n");
  const subject = items.length === 1 ? `${items[0].title} closes ${when(items[0].left)}` : `${items.length} deadlines coming up`;
  return { subject, text: `Hi ${name},\n\n${lines}\n\nOpen Remy to finish: https://${host}/calendar\n\nYou get this because deadline reminders are on. Turn them off in Account → Appearance & alerts.\n\nRemy` };
}

/** Weekly digest: on the student's career-time day (Sunday if none), once a week, only when there's news. */
export function weeklyDigest(ws: Workspace, today: string, weekday: number, host: string) {
  if (!ws.settings.notify.weeklyPlan || !ws.onboarding.done) return null;
  if (weekday !== (ws.settings.careerTime?.day ?? 0) || ws.lastDigest === today) return null;
  const since = ws.lastDigestAt || new Date(Date.parse(today + "T12:00:00Z") - 7 * 864e5).toISOString();
  const fresh = ws.jobs.filter((j) => (j.foundAt || "") > since && !ws.hiddenJobIds.includes(j.id) && !ws.fits[j.id]?.excluded);
  const soon = ws.calendar.filter((c) => c.kind === "Deadline" && c.date >= today && days(today, c.date) <= 7);
  if (!fresh.length && !soon.length) return null;
  const m = milestones(ws), next = m.find((x) => !x.done);
  const name = ws.profile.preferredName || ws.profile.name.split(" ")[0] || "there";
  const parts = [
    fresh.length ? `${fresh.length} new opening${fresh.length > 1 ? "s" : ""} for you:\n${fresh.slice(0, 3).map((j) => `• ${j.title} at ${j.company}`).join("\n")}` : "",
    soon.length ? `Closing in the next 7 days:\n${soon.map((c) => `• ${c.title} (${c.date})`).join("\n")}` : "",
    `Your road to an offer: ${m.filter((x) => x.done).length} of ${m.length} milestones.${next ? ` Next: ${next.label}.` : ""}`,
    `30-second check-in: what did you do this week? Tap it on Home and Remy turns it into a resume line, using only your words.`,
  ].filter(Boolean);
  const subject = fresh.length ? `${fresh.length} new opening${fresh.length > 1 ? "s" : ""} for you this week` : `${soon.length} deadline${soon.length > 1 ? "s" : ""} this week`;
  return { subject, text: `Hi ${name},\n\n${parts.join("\n\n")}\n\nOpen Remy: https://${host}/\n\nYou get this because the weekly digest is on. Turn it off in Account → Appearance & alerts.\n\nRemy` };
}
