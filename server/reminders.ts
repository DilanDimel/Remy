import type { Workspace } from "@shared/types";
import { LINKEDIN_RECHECK_DAYS } from "@shared/linkedin";

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
  // Best fits first, so the subject and the top of the list name the opening most worth opening.
  const fresh = ws.jobs.filter((j) => (j.foundAt || "") > since && !ws.hiddenJobIds.includes(j.id) && !ws.fits[j.id]?.excluded && ws.fits[j.id]?.regionMatch !== false)
    .sort((a, b) => (ws.fits[b.id]?.score || 0) - (ws.fits[a.id]?.score || 0));
  const soon = ws.calendar.filter((c) => c.kind === "Deadline" && c.date >= today && days(today, c.date) <= 7);
  // Saved openings Remy's background check found closed since the last digest.
  const saved = new Set(ws.savedJobIds);
  const closed = ws.jobs.filter((j) => { const c = j.checks?.[0]; return saved.has(j.id) && !!c && c.at > since && (c.result === "closed-signal" || c.httpStatus === 404 || c.httpStatus === 410); });
  if (!fresh.length && !soon.length && !closed.length) return null;
  const name = ws.profile.preferredName || ws.profile.name.split(" ")[0] || "there";
  const parts = [
    fresh.length ? `${fresh.length} new opening${fresh.length > 1 ? "s" : ""} for you:\n${fresh.slice(0, 3).map((j) => `• ${j.title} at ${j.company}`).join("\n")}` : "",
    soon.length ? `Closing in the next 7 days:\n${soon.map((c) => `• ${c.title} (${c.date})`).join("\n")}` : "",
    closed.length ? `No longer open (Remy checked the pages):\n${closed.slice(0, 3).map((j) => `• ${j.title} at ${j.company}`).join("\n")}` : "",
    `30-second check-in: what did you do this week? Tap it on Home and Remy turns it into a resume line, using only your words.`,
    ws.linkedin && days(ws.linkedin.at.slice(0, 10), today) >= LINKEDIN_RECHECK_DAYS ? `Your LinkedIn check is over a month old. Save a fresh PDF from LinkedIn and upload it on the Resume page to see what's missing.` : "",
  ].filter(Boolean);
  // A real employer in the subject is what gets an email opened ("Frost Bank and 2 more new openings for you").
  const subject = fresh.length ? `${fresh[0].company}${fresh.length > 1 ? ` and ${fresh.length - 1} more new opening${fresh.length > 2 ? "s" : ""}` : `: ${fresh[0].title}`} for you`
    : soon.length ? `${soon[0].title}${soon.length > 1 ? ` and ${soon.length - 1} more deadline${soon.length > 2 ? "s" : ""}` : ""} this week`
    : `${closed[0].company} closed its posting`;
  return { subject, text: `Hi ${name},\n\n${parts.join("\n\n")}\n\nOpen Remy: https://${host}/\n\nYou get this because the weekly digest is on. Turn it off in Account → Appearance & alerts.\n\nRemy` };
}
