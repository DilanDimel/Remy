// Career pins (owners only, Nov 23 2026, Dilan: "badges, and the student must see what they have and what unlocks
// each"). Pins are badges for real career steps, never busywork: every one is counted from data Remy already keeps, and
// tiered pins count quality (tailored applications, finished stories), not raw volume. Firsts already pay XP in xpOf
// (resume, application, interview, offer), so they add none here; the rest pay XP per tier.
import type { Workspace } from "./types";
import { counters } from "./game";
import { dailyStreak, streakDays } from "./daily";

export type PinKind = "first" | "craft" | "grit" | "secret";
export type Pin = {
  id: string; kind: PinKind; name: string; how: string; link: string;
  /** Counts needed for each tier: one number = a single pin, three = bronze, silver, gold. */
  tiers: number[]; xp: number[]; unit?: string;
  /** Secret pins show only this until earned. */
  hint?: string;
  count: (w: Workspace) => number;
};
export const TIER_NAME = ["Bronze", "Silver", "Gold"];
export const KIND_LABEL: Record<PinKind, string> = { first: "Firsts", craft: "Craft", grit: "Grit", secret: "Secret" };

const SENT = new Set(["Applied", "Received", "Heard back", "Interview", "Offer", "Rejected", "No reply"]);
const interviewed = (t: Workspace["tracker"][number]) => t.status === "Interview" || t.status === "Offer" || t.events.some((e) => e.status === "Interview" || e.status === "Offer");
const firstAt = (t: Workspace["tracker"][number], s: string) => t.events.filter((e) => e.status === s).map((e) => e.at).sort()[0] || "";
/** Times the student did something real (rated, a career step, wrote to Remy), for the time-of-day pins. */
const actTimes = (w: Workspace) => [...Object.values(w.jobFeedback || {}).map((f) => f.updatedAt || f.createdAt), ...(w.steps || []).map((s) => s.at),
  ...(w.chat || []).filter((m) => m.role === "user").map((m) => m.at)].map((at) => new Date(at || "")).filter((d) => !isNaN(+d));
const gapDays = (a: string, b: string) => Math.round((+new Date(b + "T12:00:00") - +new Date(a + "T12:00:00")) / 864e5);

export const PINS: Pin[] = [
  { id: "resume", kind: "first", name: "Resume ready", how: "Confirm your resume on the Resume page", link: "/resume", tiers: [1], xp: [0], count: (w) => (w.resume?.confirmedAt ? 1 : 0) },
  { id: "pitch", kind: "first", name: "Elevator pitch", how: "Save your 30-second pitch", link: "/interview", tiers: [1], xp: [30], count: (w) => (w.pitch?.text?.trim() ? 1 : 0) },
  { id: "linkedin", kind: "first", name: "LinkedIn checked", how: "Upload your LinkedIn PDF for Remy to check", link: "/community", tiers: [1], xp: [30], count: (w) => (w.linkedin?.text ? 1 : 0) },
  { id: "applied", kind: "first", name: "First application", how: "Send an application and mark it Applied", link: "/progress", tiers: [1], xp: [0], count: (w) => (counters(w).sent > 0 ? 1 : 0) },
  { id: "interview", kind: "first", name: "First interview", how: "Get an interview and mark it in Progress", link: "/progress", tiers: [1], xp: [0], count: (w) => (w.tracker.some(interviewed) ? 1 : 0) },
  { id: "offer", kind: "first", name: "First offer", how: "Get an offer and mark it in Progress", link: "/progress", tiers: [1], xp: [0], count: (w) => (w.tracker.some((t) => t.status === "Offer" || t.events.some((e) => e.status === "Offer")) ? 1 : 0) },

  { id: "tailor", kind: "craft", name: "Tailor", how: "Tailor your resume for an opening", unit: "tailored", link: "/opportunities", tiers: [1, 5, 15], xp: [25, 60, 150], count: (w) => counters(w).tailored },
  { id: "story", kind: "craft", name: "Storyteller", how: "Finish an interview story (all four parts)", unit: "stories", link: "/interview", tiers: [1, 3, 6], xp: [25, 60, 150], count: (w) => (w.stories || []).filter((s) => s.situation && s.task && s.action && s.result).length },
  { id: "practice", kind: "craft", name: "Practice reps", how: "Finish a mock interview", unit: "mock interviews", link: "/interview", tiers: [1, 3, 8], xp: [25, 60, 150], count: (w) => (w.interviews || []).filter((i) => i.finishedAt).length },
  { id: "network", kind: "craft", name: "Networker", how: "Add someone you met", unit: "people", link: "/community", tiers: [1, 5, 15], xp: [25, 60, 150], count: (w) => w.contacts.length },
  { id: "numbers", kind: "craft", name: "Numbers person", how: "Add a real number to a resume line", unit: "lines with numbers", link: "/resume", tiers: [3, 8, 15], xp: [25, 60, 150], count: (w) => counters(w).numbered },
  { id: "explorer", kind: "craft", name: "Explorer", how: "Decode a job on My Path", unit: "jobs decoded", link: "/path?play=1", tiers: [3, 10, 25], xp: [25, 60, 150], count: (w) => (w.game?.known || []).length },
  { id: "steady", kind: "craft", name: "Steady", how: "Keep a daily streak going", unit: "days in a row (best)", link: "/path", tiers: [7, 30, 100], xp: [25, 60, 150], count: (w) => dailyStreak(streakDays(w)).best },
  { id: "hours", kind: "craft", name: "In the field", how: "Log volunteering, shadowing or work hours", unit: "hours", link: "/progress", tiers: [10, 50, 150], xp: [25, 60, 150], count: (w) => Math.floor((w.hours || []).reduce((n, h) => n + h.hours, 0)) },

  { id: "thickskin", kind: "grit", name: "Thick skin", how: "After a rejection, add the next steps Remy suggests", link: "/progress", tiers: [1], xp: [50], count: (w) => w.tracker.filter((t) => t.recovery === "added").length },
  { id: "bounce", kind: "grit", name: "Bounce back", how: "Land an interview after a rejection", link: "/progress", tiers: [1], xp: [75], count: (w) => {
    const no = w.tracker.map((t) => firstAt(t, "Rejected")).filter(Boolean).sort()[0];
    return no && w.tracker.some((t) => { const at = firstAt(t, "Interview") || firstAt(t, "Offer"); return at > no; }) ? 1 : 0;
  } },
  { id: "comeback", kind: "grit", name: "Comeback", how: "Come back after two weeks away and do one real step", link: "/", tiers: [1], xp: [50], count: (w) => {
    const ks = Object.keys(streakDays(w).days || {}).sort();
    return ks.some((k, i) => i > 0 && gapDays(ks[i - 1], k) >= 14) ? 1 : 0;
  } },

  { id: "nightowl", kind: "secret", name: "Night owl", hint: "Remy notices when you work late.", how: "Did a real step between midnight and 4 AM", link: "/", tiers: [1], xp: [40], count: (w) => (actTimes(w).some((d) => d.getHours() < 4) ? 1 : 0) },
  { id: "earlybird", kind: "secret", name: "Early bird", hint: "Some people get going before breakfast.", how: "Did a real step before 7 AM", link: "/", tiers: [1], xp: [40], count: (w) => (actTimes(w).some((d) => d.getHours() >= 4 && d.getHours() < 7) ? 1 : 0) },
  { id: "allround", kind: "secret", name: "All-rounder", hint: "Try a little of everything.", how: "Bronze or better on every Craft pin", link: "/rewards", tiers: [1], xp: [100], count: (w) => (PINS.filter((p) => p.kind === "craft").every((p) => p.count(w) >= p.tiers[0]) ? 1 : 0) },
];

export type PinState = Pin & { n: number; tier: number; next: number | null; earned: boolean };
/** Each pin with how far the student is: tier = tiers reached (0 = not yet), next = the count for the next tier. */
export function pinsOf(w: Workspace): PinState[] {
  return PINS.map((p) => { const n = p.count(w), tier = p.tiers.filter((t) => n >= t).length; return { ...p, n, tier, next: p.tiers[tier] ?? null, earned: tier > 0 }; });
}
/** The pin colour for its tier, as a palette token: single pins orange, then bronze, silver and gold. */
export const pinColor = (p: PinState) => (p.tiers.length === 1 ? "var(--fox)" : ["", "var(--fox-deep)", "var(--faint)", "var(--amber)"][p.tier]);
/** Earned pins, best first (gold, silver, then the rest; firsts before craft on a tie), for Remy's lapel and corkboard. */
export const topPins = (w: Workspace, n = 8) => pinsOf(w).filter((p) => p.earned)
  .map((p, i) => ({ p, rank: (p.tiers.length === 1 ? 1 : p.tier) * 100 - i })).sort((a, b) => b.rank - a.rank).slice(0, n).map((x) => x.p);
/** XP from pins, added to the season XP (shared/game.ts xpOf). */
export const pinXp = (w: Workspace) => pinsOf(w).reduce((s, p) => s + p.xp.slice(0, p.tier).reduce((a, b) => a + b, 0), 0);
/** Pins (and tiers) earned since the student last saw them, for the "new pin" moment. */
export const newPins = (w: Workspace, seen: Record<string, number> = w.game?.pins || {}) => pinsOf(w).filter((p) => p.tier > (seen[p.id] || 0));
export const pinsSeen = (w: Workspace) => Object.fromEntries(pinsOf(w).filter((p) => p.tier).map((p) => [p.id, p.tier]));
