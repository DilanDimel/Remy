import type { Job, Workspace } from "@shared/types";
import { firstName } from "@shared/names";
import { quietOn } from "@shared/remyOffers";
import { isOwner } from "../platform/admin";
import { loadWorkspace, recentStudents, saveSections, uid } from "../platform/db";
import { emailReady, sendEmail } from "../notify/email";
import { brandEmail, opening, para } from "../notify/layout";

// Stage 5 of the redesign: Remy reaches out first. One email about the best new opening, with Yes (opens tailoring
// for that opening) and Not now. How often is the student's choice (daily, weekly, off; weekly by default).
export type NudgeEvery = "daily" | "weekly" | "off";
export interface Nudge { id: string; jobId: string; at: string; answer?: "yes" | "later"; answeredAt?: string }

const MIN_SCORE = 60; // fit score (server/jobs/fit.ts) for "this fits you": out of about 120
const FRESH_DAYS = 3; // only openings Remy found in the last few days, so a nudge never points to an old posting

const daysAgo = (iso: string, now: Date) => (now.getTime() - Date.parse(iso)) / 864e5;

/** Fresh openings that fit, best first: found in the last few days, not passed or hidden, eligible, in the student's area. */
function fitting(ws: Workspace, now: Date, skip: Set<string>): Job[] {
  const fit = (j: Job) => ws.fits[j.id];
  return ws.jobs
    .filter((j) => j.kind !== "event" && !skip.has(j.id) && !!j.foundAt && daysAgo(j.foundAt, now) <= FRESH_DAYS)
    .filter((j) => { const f = fit(j); return !!f && !f.excluded && !f.closed && f.eligibility !== "unlikely" && f.regionMatch !== false && (f.score || 0) >= MIN_SCORE; })
    .sort((a, b) => (fit(b)!.score || 0) - (fit(a)!.score || 0));
}

/** Applications Remy drafted overnight that the student hasn't opened or decided on yet. */
const waitingDraft = (ws: Workspace, jobId: string) => ws.applications.find((a) => a.jobId === jobId && a.overnight && !a.changes.some((c) => c.status !== "pending"));

/** The opening worth one email now, or null: none due yet, nothing fits, or the student turned nudges off.
 *  An opening Remy already drafted overnight still counts (the email then offers the draft). */
export function nudgeFor(ws: Workspace, now: Date): Job | null {
  const every: NudgeEvery = ws.settings.nudges || "weekly";
  if (every === "off" || !ws.onboarding.done || quietOn(ws.settings, now.toISOString().slice(0, 10))) return null;
  const sent = ws.nudges || [];
  const last = sent[sent.length - 1];
  if (last && daysAgo(last.at, now) < (every === "daily" ? 0.9 : 6.9)) return null;
  const started = ws.applications.filter((a) => !waitingDraft(ws, a.jobId)).map((a) => a.jobId);
  const skip = new Set([...sent.map((n) => n.jobId), ...ws.savedJobIds, ...ws.hiddenJobIds, ...started]);
  return fitting(ws, now, skip)[0] || null;
}

/** Stage 5b: the openings worth a tailored draft overnight (top `max` fresh fits with no application yet). */
export function overnightPicks(ws: Workspace, now: Date, max = 2): Job[] {
  if (!ws.onboarding.done || !ws.resume?.confirmedAt) return [];
  const skip = new Set([...ws.hiddenJobIds, ...ws.applications.map((a) => a.jobId), ...(ws.nudges || []).filter((n) => n.answer === "later").map((n) => n.jobId)]);
  return fitting(ws, now, skip).slice(0, max);
}

/** The email: plain text plus Remy's branded HTML with two buttons. Both links open Remy (signed in) on the exact step.
 *  `account` is the sign-in account's name, used when the workspace has no name yet (no more "Hi there"). */
export function nudgeEmail(ws: Workspace, job: Job, nudgeId: string, host: string, account = "") {
  const name = firstName(ws) || account.trim().split(/\s+/)[0] || "";
  const where = job.company.trim() || "an employer";
  const draft = waitingDraft(ws, job.id);
  // A draft Remy already made opens as it is (go=1 would redo it).
  const yes = draft ? `https://${host}/resume?tab=tailor&app=${draft.id}&nudge=${nudgeId}&a=yes` : `https://${host}/resume?tab=tailor&job=${encodeURIComponent(job.id)}&go=1&nudge=${nudgeId}&a=yes`;
  const later = `https://${host}/opportunities?nudge=${nudgeId}&a=later`;
  const why = ws.fits[job.id]?.why || "";
  const subject = `${where}: ${job.title} fits you`;
  const what = ({ job: "job", internship: "internship", program: "program", campus: "campus job", event: "event" } as const)[job.kind] || "opening";
  const ask = draft
    ? `I already drafted a tailored resume and cover letter for it. Want to look?`
    : `Want me to tailor your resume for it? You'll see every change before anything is saved.`;
  const yesLabel = draft ? "Yes, show me" : "Yes, tailor it";
  const how = { daily: "at most once a day", weekly: "at most once a week" }[ws.settings.nudges === "daily" ? "daily" : "weekly"];
  const foot = `You get this ${how} because Remy's match emails are on.`;
  const text = `Hi ${name || "there"},\n\nA new ${what} at ${where} fits you: ${job.title}. ${ask}${why ? `\n\n${why}` : ""}\n\n${yesLabel}: ${yes}\nNot now: ${later}\n\n${foot} Change how often in Account → Appearance & alerts.\n\nRemy`;
  const html = brandEmail({
    host, name, heading: `A new ${what} fits you`, preheader: `${job.title} at ${where}. ${ask}`,
    blocks: [opening({ kicker: where, title: job.title, why }), para(ask)],
    primary: { href: yes, label: yesLabel }, secondary: { href: later, label: "Not now" },
    why: foot, manage: { href: `https://${host}/accounts?tab=settings`, label: "Change how often" },
  });
  return { subject, text, html };
}

/** Records the student's answer from an email button, once. Returns the updated list, or null for an unknown id. */
export function answerNudge(list: Nudge[] | undefined, id: string, answer: "yes" | "later", at: string): Nudge[] | null {
  const n = (list || []).find((x) => x.id === id);
  if (!n) return null;
  if (n.answer) return list!;
  return list!.map((x) => (x.id === id ? { ...x, answer, answeredAt: at } : x));
}

/** The background run (after the openings search): one email per student who is due. Only students who opened Remy
 *  since `activeSince` (14 days, the proposal's rule) and finished setup.
 *  OWNERS ONLY while the redesign is tested: no student gets one until Dilan releases it. */
export async function sendNudges(activeSince: string, send: typeof sendEmail = sendEmail, now = new Date()) {
  if (send === sendEmail && !emailReady()) return 0;
  const host = process.env.PUBLIC_HOST || "remyai.org";
  let sent = 0;
  for (const u of await recentStudents(activeSince, true)) {
    if (!(await isOwner({ kind: u.kind as "google", email: u.email }))) continue;
    const ws = await loadWorkspace(u.id);
    const job = nudgeFor(ws, now);
    if (!job) continue;
    const id = uid("n");
    const { subject, text, html } = nudgeEmail(ws, job, id, host, u.name);
    try { await send(ws.profile.applicationEmail || u.email, subject, text, html); } catch (e: any) { console.error("match email failed", e?.message); continue; }
    await saveSections(u.id, { nudges: [...(ws.nudges || []), { id, jobId: job.id, at: now.toISOString() }].slice(-100) });
    sent++;
  }
  return sent;
}
