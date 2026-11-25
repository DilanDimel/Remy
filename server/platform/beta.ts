// Founding Cohort (beta) access. With OR_BETA_ONLY=true, only accepted emails (the beta list an owner keeps on the
// Admin page) and Remy's owners/team can sign in or keep using Remy; guest workspaces are off. Students apply with the
// team's form (OR_BETA_FORM_URL). Off by default, so nothing changes until the switch is set on a server.
import type { Me } from "@shared/types";
import { isOwner, studentsOnly } from "./admin";
import { q, q1 } from "./sql";

// Instant access (Nov 24, Julio's friends didn't want to apply first): one owner switch on the Admin page lets anyone sign
// in, with daily limits on the heavy AI features. Off (no row) keeps today's invite-only beta; turning it off again is
// the way back to a waitlist. Kept in site_settings so it flips without a redeploy.
let openCache = { at: 0, open: false };
export async function openAccess() {
  if (Date.now() - openCache.at <= 30_000) return openCache.open;
  const r = await q("SELECT value FROM site_settings WHERE key = 'open_access'");
  openCache = { at: Date.now(), open: r[0]?.value === "true" };
  return openCache.open;
}
export async function setOpenAccess(by: string, open: boolean) {
  await q(`INSERT INTO site_settings (key, value, updated_by) VALUES ('open_access', $1, $2)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`, [String(open), by]);
  openCache = { at: Date.now(), open };
}
/** Invite-only right now: the server's switch is on and owners haven't opened access. */
export const betaOn = async () => process.env.OR_BETA_ONLY === "true" && !(await openAccess());

// Open access: a daily cap on tailoring, the AI feature that costs the most (owners are never capped). AI mock
// interviews already have their own cap of 3 a week (shared/interview.ts), and every account has 120 AI calls a day.
export const TAILOR_PER_DAY = 5;
export const heavyKind = (purpose: string) => (/^Tailor for /.test(purpose) ? "tailor" : "");
export const tailorLimitMessage = `You've tailored ${TAILOR_PER_DAY} resumes today, the daily limit while Remy is in beta. It resets within 24 hours; everything else still works.`;
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
/** On the beta tester list? Testers are Beta Insiders now (Nov 24), whatever the invite-only switch says. */
export const onList = async (email: string) => !!email && (await accepted()).has(normEmail(email));

/** Can this email use Remy right now? Always yes with the switch off. */
export async function emailAllowed(email: string) {
  if (!(await betaOn())) return true;
  const e = normEmail(email);
  if (!e) return false;
  return (await accepted()).has(e) || (await isOwner({ kind: "google", email: e }));
}

/** Can this signed-in identity use Remy right now? Guests and demo visitors can't while the switch is on;
 *  "local" (a developer's own machine) always can. */
export async function meAllowed(me: Pick<Me, "kind" | "email">) {
  if (me.kind === "local" || !(await betaOn())) return true;
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
    text: `You're in: you're one of Remy's Beta Insiders.\n\nSign in at https://${host}/signin with exactly this email address: type it in the email box and Remy sends you a 6-digit code, or use Google if this is your Google account's address. Setup takes about 5 minutes.\n\nAs a founding member, you've agreed to use Remy about once a week. Tell us anything Remy gets wrong: that's how it gets better.\n\nThe Remy team\nhello@remyai.org`,
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

// ---------- Beta Insider replaces the form (Nov 24) ----------
// Joining in the app asks the form's questions; the answers go in the same table, so form applicants and insiders are
// one list. A Founding Cohort row keeps its decision and cohort and only gains answers it was missing.
export type InsiderAnswers = { goal: string; stuck: string; tools: string; source: string };
const KEEP = ["name", "school", "major", "class_year", "goal", "stuck", "tools", "source"].map((c) => `${c}=COALESCE(NULLIF(beta_applications.${c}, ''), EXCLUDED.${c})`).join(", ");
export async function saveInsider(email: string, p: { name: string; school: string; major: string; classYear: string }, a: Partial<InsiderAnswers>) {
  const e = normEmail(email);
  if (!EMAIL.test(e)) return;
  await q(
    `INSERT INTO beta_applications (email, name, school, major, class_year, goal, stuck, tools, source, feedback, terms, status, cohort, decided_by, decided_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Yes: Beta Insider check-ins every two weeks','Agreed to the beta terms in the app','accepted','Beta Insider','joined in the app',now())
     ON CONFLICT (email) DO UPDATE SET ${KEEP}, updated_at=now()`,
    [e, clip(p.name), clip(p.school), clip(p.major), clip(p.classYear), clip(a.goal), clip(a.stuck), clip(a.tools), clip(a.source)],
  );
}

/** Everyone in the beta for the owners' Students tab: form applicants, the sign-in list and insiders, one row per email,
 *  with whether they signed up, how many days they used Remy and their Beta Insider status. Read live, so nothing is copied. */
export async function students() {
  const people = await q(
    `WITH p AS (SELECT email FROM beta_applications UNION SELECT email FROM beta_list
                UNION SELECT lower(u.email) FROM users u JOIN workspaces w ON w.user_id = u.id WHERE w.data ? 'insider' AND u.email <> ''
                -- Every account too (Nov 25): since "Let everyone in", most students sign up without applying.
                UNION SELECT lower(email) FROM users WHERE kind IN ('google','supabase') AND email <> '')
     SELECT p.email, a.name, a.school, a.major, a.class_year, a.goal, a.stuck, a.tools, a.source, a.status, a.cohort, a.received_at,
            l.note, l.added_at, u.created_at AS signed_up, w.data->'insider' AS insider,
            jsonb_array_length(COALESCE(w.data->'visits', '[]'::jsonb)) AS days, w.data->'visits'->>-1 AS last_day,
            w.data->'profile'->>'name' AS profile_name, w.data->'profile'->>'school' AS profile_school
     FROM p LEFT JOIN beta_applications a ON a.email = p.email LEFT JOIN beta_list l ON l.email = p.email
     LEFT JOIN LATERAL (SELECT id, created_at FROM users WHERE lower(email) = p.email AND kind IN ('google','supabase') ORDER BY created_at LIMIT 1) u ON true
     LEFT JOIN workspaces w ON w.user_id = u.id
     ORDER BY COALESCE(a.received_at, l.added_at, u.created_at) DESC LIMIT 3000`,
  );
  const surveys = await q("SELECT message, detail, at FROM error_reports WHERE place = 'insider-survey' ORDER BY at DESC LIMIT 200");
  // Profile counts, one per email (a Google and an email sign-in for the same person count once), team left out.
  const c = (await q1(
    `WITH s AS (SELECT lower(u.email) AS email, MIN(u.created_at) AS created_at, MAX(w.updated_at) AS seen,
                       bool_or(COALESCE((w.data->'onboarding'->>'done')::boolean, false)) AS set_up,
                       bool_or(w.data->'resume' IS NOT NULL AND w.data->'resume' <> 'null'::jsonb) AS resume
                FROM users u LEFT JOIN workspaces w ON w.user_id = u.id WHERE ${await studentsOnly()} AND u.email <> '' GROUP BY 1)
     SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'America/Chicago') AT TIME ZONE 'America/Chicago')::int AS today,
            COUNT(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week,
            COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS month,
            COUNT(*) FILTER (WHERE seen > now() - interval '1 day')::int AS active_today,
            COUNT(*) FILTER (WHERE seen > now() - interval '7 days')::int AS active_week,
            COUNT(*) FILTER (WHERE set_up)::int AS set_up, COUNT(*) FILTER (WHERE resume)::int AS resume,
            (SELECT COUNT(DISTINCT lower(email))::int FROM users WHERE kind IN ('google','supabase') AND email <> '') AS accounts
     FROM s`,
  )) || {};
  const n = (k: string) => Number(c[k] || 0);
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    counts: { total: n("total"), today: n("today"), week: n("week"), month: n("month"), activeToday: n("active_today"), activeWeek: n("active_week"), setUp: n("set_up"), resume: n("resume"), team: Math.max(0, n("accounts") - n("total")) },
    people: people.map((r) => ({
      email: String(r.email), name: String(r.name || r.profile_name || ""), school: String(r.school || r.profile_school || ""), major: String(r.major || ""), classYear: String(r.class_year || ""),
      goal: String(r.goal || ""), stuck: String(r.stuck || ""), tools: String(r.tools || ""), source: String(r.source || ""),
      status: (r.status ? String(r.status) : "accepted") as AppStatus, onList: !!r.added_at, cohort: String(r.cohort || r.note || ""),
      appliedAt: iso(r.received_at), signedUpAt: iso(r.signed_up), days: Number(r.days || 0), lastDay: r.last_day ? String(r.last_day) : null,
      insider: (r.insider as { joinedAt: string; surveyAt?: string } | null) || null,
    })),
    surveys: surveys.map((r) => ({ question: String(r.message).split(" — ")[0], answer: String(r.message).split(" — ").slice(1).join(" — "), email: String(r.detail), at: iso(r.at)! })),
  };
}
