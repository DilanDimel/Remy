// Founding Cohort (beta) access. With OR_BETA_ONLY=true, only accepted emails (the beta list an owner keeps on the
// Admin page) and Remy's owners/team can sign in or keep using Remy; guest workspaces are off. Students apply with the
// team's form (OR_BETA_FORM_URL). Off by default, so nothing changes until the switch is set on a server.
import type { Me } from "@shared/types";
import { isOwner } from "./admin";
import { q } from "./sql";

export const betaOn = () => process.env.OR_BETA_ONLY === "true";
export const betaFormUrl = () => {
  const u = (process.env.OR_BETA_FORM_URL || "").trim();
  return /^https:\/\/\S+$/.test(u) ? u : "";
};
export const normEmail = (e: string) => String(e || "").trim().toLowerCase().slice(0, 254);
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

// Read on every request while the switch is on, so a short cache; adding or removing an email clears it at once.
let cache: { at: number; set: Set<string> } = { at: 0, set: new Set() };
let version = 0; // bumped on every change, so a read that started before a removal isn't cached as current
async function accepted() {
  if (Date.now() - cache.at <= 30_000) return cache.set;
  const v = version;
  const set = new Set((await q("SELECT email FROM beta_list")).map((r) => normEmail(String(r.email))));
  if (v === version) cache = { at: Date.now(), set };
  return set;
}
export const clearBetaCache = () => { version++; cache.at = 0; };

/** Can this email use Remy right now? Always yes with the switch off. */
export async function emailAllowed(email: string) {
  if (!betaOn()) return true;
  const e = normEmail(email);
  if (!e) return false;
  return (await accepted()).has(e) || (await isOwner({ kind: "google", email: e }));
}

/** Can this signed-in identity use Remy right now? Guests and demo visitors can't while the switch is on;
 *  "local" (a developer's own machine) always can. */
export async function meAllowed(me: Pick<Me, "kind" | "email">) {
  if (!betaOn() || me.kind === "local") return true;
  if (me.kind !== "google" && me.kind !== "supabase") return false;
  return emailAllowed(me.email);
}

export function betaError(email = "") {
  const who = normEmail(email);
  return Object.assign(new Error(`${who ? who + " isn't" : "You're not"} on Remy's beta tester list yet. Remy is invite-only during the beta: apply with the form, then sign in with this same email once you're accepted.`), { status: 403, code: "beta" });
}

// ---------- owners' list ----------
export async function list() {
  return (await q("SELECT email, note, added_by, added_at, invited_at FROM beta_list ORDER BY added_at DESC")).map((r) => ({
    email: String(r.email), note: String(r.note || ""), addedBy: String(r.added_by || ""),
    addedAt: new Date(r.added_at).toISOString(), invitedAt: r.invited_at ? new Date(r.invited_at).toISOString() : null,
  }));
}

/** Adds every valid address in pasted text (commas, spaces or new lines between them). Returns which were new,
 *  which were already there and which didn't look like emails. */
export async function add(by: string, text: string, note = "") {
  const parts = String(text || "").slice(0, 20_000).split(/[\s,;]+/).map(normEmail).filter(Boolean);
  const wrong = parts.filter((p) => !EMAIL.test(p));
  const emails = [...new Set(parts.filter((p) => EMAIL.test(p)))].slice(0, 500);
  const added: string[] = [], already: string[] = [];
  for (const e of emails) {
    const r = await q("INSERT INTO beta_list (email, note, added_by) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING email", [e, String(note || "").slice(0, 200), by]);
    (r.length ? added : already).push(e);
  }
  clearBetaCache();
  return { added, already, wrong: [...new Set(wrong)].slice(0, 50) };
}

export async function remove(email: string) {
  await q("DELETE FROM beta_list WHERE email = $1", [normEmail(email)]);
  clearBetaCache();
}

export async function markInvited(email: string) {
  await q("UPDATE beta_list SET invited_at = now() WHERE email = $1", [normEmail(email)]);
}

export function welcomeEmail(host: string) {
  return {
    subject: "You're in: welcome to the Remy beta",
    text: `You're in: you're one of Remy's beta testers.\n\nSign in at https://${host}/signin with exactly this email address: "Continue with Email" sends you a 6-digit code, or use Google if this is your Google account's address. Setup takes about 5 minutes.\n\nAs a founding member, you've agreed to use Remy about once a week. Tell us anything Remy gets wrong: that's how it gets better.\n\nThe Remy team\nhello@remyai.org`,
  };
}

// ---------- applications from the Google Form ----------
// The form's script (docs/beta-form-hook.gs) posts { answers: { "<question title>": "<answer>" } } the moment someone
// submits. Questions are matched by words in their titles, so a slightly reworded question still lands in the right place.
export type AppStatus = "new" | "accepted" | "next" | "declined";
export const APP_STATUSES: AppStatus[] = ["new", "accepted", "next", "declined"];
type Answers = { name: string; school: string; major: string; classYear: string; goal: string; stuck: string; tools: string; feedback: string; source: string; terms: string };
export type Application = Answers & { email: string; status: AppStatus; cohort: string; decidedBy: string; decidedAt: string | null; receivedAt: string };
const FIELDS: [keyof Answers, RegExp][] = [
  ["name", /\bname\b/i], ["school", /school|university|college/i], ["major", /\bmajor\b/i], ["classYear", /\byear\b/i],
  ["goal", /land next|trying to land/i], ["stuck", /stuck/i], ["tools", /toolkit|\btools?\b/i], ["feedback", /feedback/i],
  ["source", /hear about|\bsource\b|\bsrc\b/i], ["terms", /terms|\bage\b/i],
];
const clip = (v: unknown, n = 300) => (Array.isArray(v) ? v.join(", ") : String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, n);

/** Turns the form's answers into one application; null when there's no usable email. */
export function parseAnswers(answers: Record<string, unknown>): (Answers & { email: string }) | null {
  const entries = Object.entries(answers && typeof answers === "object" ? answers : {}).slice(0, 40);
  const emailAt = entries.findIndex(([k]) => /e-?mail/i.test(k));
  const email = normEmail(clip(entries[emailAt]?.[1], 254));
  if (emailAt < 0 || !EMAIL.test(email)) return null;
  const used = new Set([emailAt]);
  const out = {} as Answers;
  for (const [field, re] of FIELDS) {
    const i = entries.findIndex(([k], j) => !used.has(j) && re.test(k));
    if (i >= 0) used.add(i);
    out[field] = i >= 0 ? clip(entries[i][1]) : "";
  }
  return { email, ...out };
}

export async function saveApplication(a: Answers & { email: string }) {
  await q(
    `INSERT INTO beta_applications (email, name, school, major, class_year, goal, stuck, tools, feedback, source, terms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, school=EXCLUDED.school, major=EXCLUDED.major, class_year=EXCLUDED.class_year,
       goal=EXCLUDED.goal, stuck=EXCLUDED.stuck, tools=EXCLUDED.tools, feedback=EXCLUDED.feedback, source=EXCLUDED.source, terms=EXCLUDED.terms, updated_at=now()`,
    [a.email, a.name, a.school, a.major, a.classYear, a.goal, a.stuck, a.tools, a.feedback, a.source, a.terms],
  );
}

export async function applications(): Promise<Application[]> {
  return (await q("SELECT * FROM beta_applications ORDER BY received_at DESC LIMIT 2000")).map((r) => ({
    email: String(r.email), name: String(r.name), school: String(r.school), major: String(r.major), classYear: String(r.class_year),
    goal: String(r.goal), stuck: String(r.stuck), tools: String(r.tools), feedback: String(r.feedback), source: String(r.source), terms: String(r.terms),
    status: String(r.status) as AppStatus, cohort: String(r.cohort), decidedBy: String(r.decided_by),
    decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null, receivedAt: new Date(r.received_at).toISOString(),
  }));
}

/** Records the team's decision. Accepting also puts the email on the beta list, so they can sign in;
 *  moving an accepted application back takes them off it. Returns whether the email was newly accepted. */
export async function decide(by: string, email: string, status: AppStatus, cohort = "") {
  const e = normEmail(email);
  const before = await q("SELECT status FROM beta_applications WHERE email=$1", [e]);
  if (!before.length) throw Object.assign(new Error("Application not found."), { status: 404 });
  await q("UPDATE beta_applications SET status=$2, cohort=$3, decided_by=$4, decided_at=now() WHERE email=$1", [e, status, String(cohort || "").slice(0, 60), by]);
  if (status === "accepted") return (await add(by, e, cohort ? `${cohort} · from the form` : "From the form")).added.length > 0;
  // Only an entry this form accept created is taken back; someone an owner added by hand keeps access.
  if (String(before[0].status) === "accepted" && (await q("SELECT 1 FROM beta_list WHERE email=$1 AND note LIKE '%from the form'", [e])).length) await remove(e);
  return false;
}

/** After a cohort closes: declined applications are deleted (agreed Nov 7: keep only what the team needs). */
export async function deleteDeclined() {
  return (await q("DELETE FROM beta_applications WHERE status='declined' RETURNING email")).length;
}
