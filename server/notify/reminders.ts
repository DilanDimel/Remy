import type { Workspace } from "@shared/types";
import { firstName } from "@shared/names";
import { quietOn } from "@shared/remyOffers";
import { LINKEDIN_RECHECK_DAYS } from "@shared/linkedin";
import { brandEmail, label, para, rows } from "./layout";

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

/** `buttons` (redesign stage 5, owners first): Finish it / Not now, where Not now stops reminders and texts for these deadlines. */
export function reminderEmail(name: string, items: { key: string; title: string; date: string; left: number }[], host: string, buttons = false) {
  const when = (l: number) => (l === 0 ? "today" : l === 1 ? "tomorrow" : `in ${l} days`);
  const lines = items.map((i) => `• ${i.title}: closes ${when(i.left)} (${i.date})`).join("\n");
  const subject = items.length === 1 ? `${items[0].title} closes ${when(items[0].left)}` : `${items.length} deadlines coming up`;
  const foot = "You get this because deadline reminders are on. Turn them off in Account → Appearance & alerts.";
  const finish = `https://${host}/calendar`;
  if (!buttons) return { subject, text: `Hi ${name},\n\n${lines}\n\nOpen Remy to finish: ${finish}\n\n${foot}\n\nRemy` };
  // The deadline part of each key (calendar id:date), so Not now covers both the early and the day-of reminder.
  const later = `https://${host}/calendar?skip=${encodeURIComponent(items.map((i) => i.key.split(":").slice(0, 2).join(":")).join(","))}`;
  const these = items.length > 1 ? "these deadlines" : "this deadline";
  const html = brandEmail({
    host, name: name === "there" ? "" : name,
    heading: items.length === 1 ? `${items[0].title} closes ${when(items[0].left)}` : `${items.length} deadlines are close`,
    preheader: items.map((i) => `${i.title}: ${when(i.left)}`).join(" · "),
    blocks: [para(items.length === 1 ? "Here's a heads-up so it doesn't slip by." : "Here's what closes soon, so nothing slips by."), rows(items.map((i) => ({ title: i.title, sub: `Closes ${when(i.left)} · ${nice(i.date)}` })))],
    primary: { href: finish, label: "Finish it" }, secondary: { href: later, label: "Not now" },
    why: `You get this because deadline reminders are on. Not now stops reminders about ${these}.`, manage: { href: `https://${host}/accounts?tab=settings`, label: "Turn reminders off" },
  });
  return { subject, text: `Hi ${name},\n\n${lines}\n\nFinish it: ${finish}\nNot now (no more reminders about ${items.length > 1 ? "these" : "this"}): ${later}\n\n${foot}\n\nRemy`, html };
}

/** "Tue, Nov 25" from 2026-11-25. */
const nice = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** Weekly digest: on the student's career-time day (Sunday if none), once a week, only when there's news. */
/** `branded` (owners while it's tested) adds Remy's branded HTML; students keep the plain-text email. */
export function weeklyDigest(ws: Workspace, today: string, weekday: number, host: string, branded = false, account = "") {
  if (!ws.settings.notify.weeklyPlan || !ws.onboarding.done || quietOn(ws.settings, today)) return null;
  if (weekday !== (ws.settings.careerTime?.day ?? 0) || ws.lastDigest === today) return null;
  const since = ws.lastDigestAt || new Date(Date.parse(today + "T12:00:00Z") - 7 * 864e5).toISOString();
  // Best fits first, so the subject and the top of the list name the opening most worth opening.
  const fresh = ws.jobs.filter((j) => (j.foundAt || "") > since && !ws.hiddenJobIds.includes(j.id) && !ws.fits[j.id]?.excluded && ws.fits[j.id]?.regionMatch !== false)
    .sort((a, b) => (ws.fits[b.id]?.score || 0) - (ws.fits[a.id]?.score || 0));
  const soon = ws.calendar.filter((c) => c.kind === "Deadline" && c.date >= today && days(today, c.date) <= 7);
  // Saved openings Remy's background check found closed since the last digest.
  const saved = new Set([...ws.savedJobIds, ...ws.applications.map((a) => a.jobId)]);
  const closed = ws.jobs.filter((j) => { const c = j.checks?.[0]; return saved.has(j.id) && !!c && c.at > since && (c.result === "closed-signal" || c.httpStatus === 404 || c.httpStatus === 410); });
  if (!fresh.length && !soon.length && !closed.length) return null;
  const name = firstName(ws) || (branded && account.trim().split(/\s+/)[0]) || "there";
  const parts = [
    fresh.length ? `${fresh.length} new opening${fresh.length > 1 ? "s" : ""} for you:\n${fresh.slice(0, 3).map((j) => `• ${j.title} at ${j.company}`).join("\n")}` : "",
    soon.length ? `Closing in the next 7 days:\n${soon.map((c) => `• ${c.title} (${c.date})`).join("\n")}` : "",
    closed.length ? `No longer open (Remy checked the pages):\n${closed.slice(0, 3).map((j) => `• ${j.title} at ${j.company}`).join("\n")}` : "",
    ws.linkedin && days(ws.linkedin.at.slice(0, 10), today) >= LINKEDIN_RECHECK_DAYS ? `Your LinkedIn check is over a month old. Save a fresh PDF from LinkedIn and upload it on the Resume page to see what's missing.` : "",
  ].filter(Boolean);
  // A real employer in the subject is what gets an email opened ("Frost Bank and 2 more new openings for you").
  const lead = (j: { company: string; title: string }) => j.company.trim() || j.title;
  const subject = fresh.length ? `${lead(fresh[0])}${fresh.length > 1 ? ` and ${fresh.length - 1} more new opening${fresh.length > 2 ? "s" : ""}` : fresh[0].company.trim() ? `: ${fresh[0].title}` : ""} for you`
    : soon.length ? `${soon[0].title}${soon.length > 1 ? ` and ${soon.length - 1} more deadline${soon.length > 2 ? "s" : ""}` : ""} this week`
    : `${lead(closed[0])} closed its posting`;
  const text = `Hi ${name},\n\n${parts.join("\n\n")}\n\nOpen Remy: https://${host}/\n\nYou get this because the weekly digest is on. Turn it off in Account → Appearance & alerts.\n\nRemy`;
  if (!branded) return { subject, text };
  const job = (j: { title: string; company: string }) => ({ title: j.title, sub: j.company, href: `https://${host}/opportunities` });
  const html = brandEmail({
    host, name: name === "there" ? "" : name, heading: "Your week with Remy", preheader: subject,
    blocks: [
      para("Here's what changed since last week."),
      fresh.length ? label(`${fresh.length} new opening${fresh.length > 1 ? "s" : ""} for you`) + rows(fresh.slice(0, 3).map(job)) : "",
      soon.length ? label("Closing in the next 7 days") + rows(soon.map((c) => ({ title: c.title, sub: `Closes ${nice(c.date)}` }))) : "",
      closed.length ? label("No longer open") + para("Remy checked the pages and these postings are gone.", true) + rows(closed.slice(0, 3).map((j) => ({ title: j.title, sub: j.company }))) : "",
      ws.linkedin && days(ws.linkedin.at.slice(0, 10), today) >= LINKEDIN_RECHECK_DAYS ? label("LinkedIn") + para("Your LinkedIn check is over a month old. Save a fresh PDF from LinkedIn and upload it on the Resume page to see what's missing.") : "",
    ].filter(Boolean),
    primary: { href: `https://${host}/`, label: "Open Remy" },
    why: "You get this once a week because the weekly digest is on.", manage: { href: `https://${host}/accounts?tab=settings`, label: "Turn it off" },
  });
  return { subject, text, html };
}
