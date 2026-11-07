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
  return Object.assign(new Error(`${who ? who + " isn't" : "You're not"} in Remy's Founding Cohort yet. Remy is invite-only during the beta: apply with the form, then sign in with this same email once you're accepted.`), { status: 403, code: "beta" });
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
    subject: "You're in: welcome to Remy's Founding Cohort",
    text: `You're in Remy's Founding Cohort.\n\nSign in at https://${host}/signin with exactly this email address: "Continue with Email" sends you a 6-digit code, or use Google if this is your Google account's address. Setup takes about 5 minutes.\n\nAs a founding member, you've agreed to use Remy about once a week and answer one short check-in. Tell us anything Remy gets wrong: that's how it gets better.\n\nThe Remy team\nremy.careercoach@gmail.com`,
  };
}
