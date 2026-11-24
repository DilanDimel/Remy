import type { ChatAction, Workspace } from "./types";
import { reviewResume } from "./review";
import { sameEmployer } from "./org";
import { dailyStreak, streakDays } from "./daily";

// Owners (Nov 23, "Remy feels alive" #1): Remy notices something on the page you're on and offers to do it, one tap.
// "Do it" runs the same action as asking him in chat (POST /api/remy/act), so it shows in his chat with Undo.
// At most one offer per page; "Not now" hides that offer for good (settings.offersSeen).

/** "Quiet week" (owners): through settings.quietUntil, Remy keeps to himself. */
export const quietOn = (s: { quietUntil?: string }, today: string) => !!s.quietUntil && s.quietUntil >= today;

export const PREP_HEAD = "Prep sheet from Remy";

export interface Offer { id: string; pages: string[]; text: string; label: string; action: ChatAction }

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10) + "T12:00:00Z") - Date.parse(a.slice(0, 10) + "T12:00:00Z")) / 864e5);
const when = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

/** Every offer Remy could make now, most urgent first. `today` is the student's local day, YYYY-MM-DD. */
export function remyOffers(ws: Pick<Workspace, "jobs" | "savedJobIds" | "hiddenJobIds" | "applications" | "tracker" | "calendar" | "resume" | "profile" | "settings" | "game" | "jobFeedback" | "steps" | "chat">, today: string, hour = 12): Offer[] {
  if (quietOn(ws.settings, today)) return [];
  const seen = new Set(ws.settings.offersSeen || []);
  const out: Offer[] = [];
  // An interview within 3 days with no prep sheet yet (on Calendar, where the sheet lands).
  for (const c of ws.calendar.filter((x) => x.kind === "Interview" && x.date >= today && daysBetween(today, x.date) <= 3 && !(x.notes || "").startsWith(PREP_HEAD)))
    out.push({ id: `prep:${c.id}`, pages: ["/calendar"], text: `Want a one-page prep sheet for ${c.title}? Your pitch, your best stories and good questions to ask, right on the event.`, label: "Make it", action: { kind: "prep", calId: c.id } });
  // An interview today or tomorrow: practice it now.
  for (const c of ws.calendar.filter((x) => x.kind === "Interview" && x.date >= today && daysBetween(today, x.date) <= 1)) {
    const job = c.linkedId ? ws.jobs.find((j) => j.id === c.linkedId) : ws.jobs.find((j) => c.title.toLowerCase().includes(j.company.toLowerCase()));
    out.push({ id: `iv:${c.id}`, pages: ["/", "/calendar", "/interview", "/progress"], text: `${/interview/i.test(c.title) ? c.title : `Your interview (${c.title})`} is ${when(daysBetween(today, c.date))}. Want a quick mock interview${job ? ` for ${job.company}` : ""} now?`, label: "Practice now", action: { kind: "start", what: "interview", ...(job ? { jobId: job.id } : {}) } });
  }
  // A saved opening closing within 3 days that isn't started.
  if (ws.resume) for (const id of ws.savedJobIds) {
    const j = ws.jobs.find((x) => x.id === id);
    if (!j?.deadline || j.kind === "event" || ws.applications.some((a) => a.jobId === j.id)) continue;
    const n = daysBetween(today, j.deadline);
    if (n < 0 || n > 3) continue;
    out.push({ id: `close:${j.id}`, pages: ["/", "/opportunities"], text: `${j.title} at ${j.company} closes ${when(n)}. Want me to start your resume and cover letter for it?`, label: "Start it", action: { kind: "tailor", jobId: j.id } });
  }
  // Applied two weeks ago, no news, no follow-up yet.
  for (const t of ws.tracker.filter((x) => x.status === "Applied" && !x.followUp)) {
    const at = t.events.filter((e) => e.status === "Applied").pop()?.at;
    if (!at || daysBetween(at, today) < 14) continue;
    out.push({ id: `follow:${t.id}`, pages: ["/progress"], text: `No news from ${t.company} in ${daysBetween(at, today)} days. That's normal. Want a follow-up to-do for this week?`, label: "Add it", action: { kind: "task", title: `Follow up with ${t.company}${t.role ? ` about ${t.role}` : ""}`, why: "A short, polite check-in two weeks after applying keeps you on their radar.", due: "" } });
  }
  // A dream employer has an opening they haven't decided on.
  const dreams = (ws.profile.dreamEmployers || "").split(/[,;]+/).map((d) => d.trim()).filter((d) => d.length > 1);
  const dream = dreams.length ? ws.jobs.find((j) => j.kind !== "event" && !ws.savedJobIds.includes(j.id) && !ws.hiddenJobIds.includes(j.id) && dreams.some((d) => sameEmployer(d, j.company))) : undefined;
  if (dream) out.push({ id: `dream:${dream.id}`, pages: ["/", "/opportunities"], text: `${dream.company} is one of your dream employers, and they have an opening: ${dream.title}. Want me to keep it?`, label: "Keep it", action: { kind: "interest", jobId: dream.id, more: true } });
  // Weak resume lines: fix them together.
  if (ws.resume) {
    const weak = reviewResume(ws.resume.doc, { listLike: true }).todo.filter((x) => x.kind === "numbers" || x.kind === "verbs").reduce((n, x) => n + ("bullets" in x ? x.bullets.length : 0), 0);
    if (weak >= 2) out.push({ id: `fix:${ws.resume.editedAt || ws.resume.uploadedAt}`, pages: ["/", "/resume"], text: `${weak} lines on your resume could be stronger. Want me to rewrite them? I'll use only what you already wrote, one line at a time.`, label: "Let's fix them", action: { kind: "start", what: "resumeFix" } });
  }
  // Evening, a streak of 2+ days and nothing yet today: one quick thing keeps it (no guilt, just the offer).
  const st = dailyStreak(streakDays(ws), today);
  if (hour >= 17 && st.days >= 2 && !st.todayDone) out.push({ id: `streak:${today}`, pages: ["/", "/path", "/opportunities"], text: `Your ${st.days}-day streak is still open today. One minute keeps it going: want to Keep or Pass one opening?`, label: "Show me one", action: { kind: "go", link: "/opportunities", label: "Opportunities" } });
  return out.filter((o) => !seen.has(o.id));
}

/** The one offer for this page, or none. */
export const offerFor = (offers: Offer[], path: string) => offers.find((o) => o.pages.includes(path));
