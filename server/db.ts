import crypto from "node:crypto";
import type { Me, Workspace } from "@shared/types";
import { q, q1, tx } from "./sql";

export const nowIso = () => new Date().toISOString();
export { uid } from "./ids";
export const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function emptyWorkspace(): Workspace {
  return {
    version: 2,
    started: false,
    onboarding: { step: 0, done: false, answers: [], questions: [] },
    profile: {
      name: "", preferredName: "", email: "", applicationEmail: "", school: "", major: "", classYear: "",
      graduation: "", location: "", targetRoles: "", goals: "", interests: "", workAuth: "", relocation: "",
      regions: "", opportunityTypes: "", gpa: "", minors: "", timeline: "", avoid: "", dreamEmployers: "", path: "", goal: "",
    },
    imports: [],
    memory: [],
    jobs: [],
    savedJobIds: [],
    fits: {},
    hiddenJobIds: [],
    applications: [],
    tracker: [],
    inbox: [],
    suggestions: [],
    tasks: [],
    calendar: [],
    contacts: [],
    outreach: [],
    chat: [],
    aiLog: [],
    incidents: [],
    settings: { theme: "system", assistantOpen: true, navCollapsed: false, notify: { deadlines: true, statusChanges: true, weeklyPlan: false } },
    updatedAt: nowIso(),
  };
}

export async function ensureUser(me: Me) {
  // New user: insert. Signed-in user: keep name, email and photo current. Guests never change.
  await q(
    `INSERT INTO users (id, kind, email, name, picture) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, picture = EXCLUDED.picture
     WHERE users.kind IN ('google','supabase')`,
    [me.id, me.kind, me.email, me.name, me.picture],
  );
}
export async function getUser(id: string): Promise<Me | null> {
  const r = await q1("SELECT id, kind, email, name, picture, school_email FROM users WHERE id=$1", [id]);
  return r ? { id: r.id, kind: r.kind, email: r.email, name: r.name, picture: r.picture, ...(r.school_email ? { schoolEmail: r.school_email } : {}) } : null;
}

// ---------- email sign-in codes ----------
/** Stores a new sign-in code for an email (replacing any pending one) and returns it to be emailed. */
export async function newSigninCode(email: string): Promise<string> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const e = email.toLowerCase();
  await q(
    `INSERT INTO signin_codes (email, code_hash, expires_at, tries) VALUES ($1,$2,$3,0)
     ON CONFLICT (email) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, tries = 0`,
    [e, sha("signin:" + e + ":" + code), new Date(Date.now() + CODE_MINUTES * 60_000)],
  );
  return code;
}
/** Checks a sign-in code; "ok" uses it up. Five wrong tries or ten minutes and it's gone. */
export async function checkSigninCode(email: string, code: string): Promise<"ok" | "wrong" | "expired" | "none"> {
  const e = email.toLowerCase();
  return tx(async (run) => {
    const r = (await run("SELECT code_hash, expires_at, tries FROM signin_codes WHERE email=$1 FOR UPDATE", [e]))[0];
    if (!r) return "none";
    if (new Date(r.expires_at).getTime() < Date.now() || r.tries >= MAX_TRIES) {
      await run("DELETE FROM signin_codes WHERE email=$1", [e]);
      return "expired";
    }
    if (sha("signin:" + e + ":" + code) !== r.code_hash) {
      await run("UPDATE signin_codes SET tries = tries + 1 WHERE email=$1", [e]);
      return "wrong";
    }
    await run("DELETE FROM signin_codes WHERE email=$1", [e]);
    return "ok";
  });
}
/** The signed-in account that already uses this email (the most recently active one), if any. */
export async function userByEmail(email: string): Promise<Me | null> {
  const r = await q1(
    `SELECT u.id FROM users u LEFT JOIN workspaces w ON w.user_id = u.id
     WHERE lower(u.email) = lower($1) AND u.kind IN ('google','supabase') ORDER BY w.updated_at DESC NULLS LAST LIMIT 1`,
    [email],
  );
  return r ? getUser(String(r.id)) : null;
}

// ---------- school email verification ----------
const CODE_MINUTES = 10;
const MAX_TRIES = 5;
const codeHash = (userId: string, code: string) => sha(userId + ":" + code);

/** Who already verified this school email, if anyone. */
export async function schoolEmailOwner(email: string): Promise<string | null> {
  const r = await q1("SELECT id FROM users WHERE lower(school_email) = lower($1)", [email]);
  return r ? r.id : null;
}
/** Stores a new code (replacing any pending one) and returns it to be emailed. */
export async function newSchoolCode(userId: string, email: string): Promise<string> {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await q(
    `INSERT INTO school_email_codes (user_id, email, code_hash, expires_at, tries) VALUES ($1,$2,$3,$4,0)
     ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, tries = 0`,
    [userId, email.toLowerCase(), codeHash(userId, code), new Date(Date.now() + CODE_MINUTES * 60_000)],
  );
  return code;
}
/** Checks a code. "ok" marks the school email verified and uses the code up. */
export async function checkSchoolCode(userId: string, code: string): Promise<{ result: "ok" | "wrong" | "expired" | "none" | "taken"; email?: string }> {
  return tx(async (run) => {
    const r = (await run("SELECT email, code_hash, expires_at, tries FROM school_email_codes WHERE user_id=$1 FOR UPDATE", [userId]))[0];
    if (!r) return { result: "none" };
    if (new Date(r.expires_at).getTime() < Date.now() || r.tries >= MAX_TRIES) {
      await run("DELETE FROM school_email_codes WHERE user_id=$1", [userId]);
      return { result: "expired" };
    }
    if (codeHash(userId, code) !== r.code_hash) {
      await run("UPDATE school_email_codes SET tries = tries + 1 WHERE user_id=$1", [userId]);
      return { result: "wrong" };
    }
    const owner = (await run("SELECT id FROM users WHERE lower(school_email) = lower($1) AND id <> $2", [r.email, userId]))[0];
    if (owner) return { result: "taken" };
    await run("UPDATE users SET school_email=$2, school_email_at=now() WHERE id=$1", [userId, r.email]);
    await run("DELETE FROM school_email_codes WHERE user_id=$1", [userId]);
    return { result: "ok", email: r.email };
  });
}
export async function removeSchoolEmail(userId: string) {
  await q("UPDATE users SET school_email=NULL, school_email_at=NULL WHERE id=$1", [userId]);
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 30;
  await q("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)", [sha(token), userId, new Date(expires)]);
  return { token, expires };
}
export async function sessionUser(token: string): Promise<string | null> {
  const r = await q1("SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at > now()", [sha(token)]);
  return r ? r.user_id : null;
}
export async function deleteSession(token: string) {
  await q("DELETE FROM sessions WHERE token_hash=$1", [sha(token)]);
}

function fromStored(data: any): Workspace {
  if (!data || data.version !== 2) return emptyWorkspace();
  // forward-fill any keys added later
  const empty = emptyWorkspace();
  const ws: Workspace = { ...empty, ...data, profile: { ...empty.profile, ...data.profile }, settings: { ...empty.settings, ...data.settings } };
  // Sample contacts/emails and the old TCU alumni list (no permission to use it) were removed; drop any saved copies.
  const gone = (c: { id: string; label?: string }) => c.id.startsWith("alum-") || c.label === "Demo data";
  ws.outreach = ws.outreach.filter((o) => !ws.contacts.some((c) => c.id === o.contactId && gone(c)));
  ws.contacts = ws.contacts.filter((c) => !gone(c));
  ws.inbox = ws.inbox.filter((m) => m.label !== "Sample email");
  // Accounts made before "Match device" stored "light" without anyone choosing it.
  if (ws.settings.theme === "light" && !ws.settings.themeChosen) ws.settings.theme = "system";
  return ws;
}
export async function loadWorkspace(userId: string): Promise<Workspace> {
  const r = await q1("SELECT data FROM workspaces WHERE user_id=$1", [userId]);
  return fromStored(r && (typeof r.data === "string" ? JSON.parse(r.data) : r.data));
}
export async function hasWorkspace(userId: string) {
  return !!(await q1("SELECT 1 FROM workspaces WHERE user_id=$1", [userId]));
}
// Postgres can't store the NUL character in JSON, and pasted or uploaded text sometimes contains it.
const noNul = (_k: string, v: unknown) => (typeof v === "string" && v.includes("\u0000") ? v.replace(/\u0000/g, "") : v);
function trimForSave(ws: Partial<Workspace>) {
  if (ws.aiLog && ws.aiLog.length > 300) ws.aiLog = ws.aiLog.slice(-300);
  if (ws.chat && ws.chat.length > 200) ws.chat = ws.chat.slice(-200);
}
/** Replaces the whole stored workspace. */
export async function saveWorkspace(userId: string, ws: Workspace) {
  ws.updatedAt = nowIso();
  trimForSave(ws);
  const data = JSON.stringify(ws, noNul);
  if (data.length > 4_000_000) throw Object.assign(new Error("Workspace is too large."), { status: 413 });
  await q(
    `INSERT INTO workspaces (user_id, data, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [userId, data],
  );
}
/** Writes only the given top-level sections, merged into what's stored in one statement,
 *  so two requests saving different sections at the same moment both keep their changes.
 *  Returns the full stored workspace after the merge. */
export async function saveSections(userId: string, sections: Partial<Workspace>): Promise<Workspace> {
  const patch = { ...sections, updatedAt: nowIso() } as Partial<Workspace>;
  trimForSave(patch);
  const json = JSON.stringify(patch, noNul);
  if (json.length > 4_000_000) throw Object.assign(new Error("Workspace is too large."), { status: 413 });
  const base = JSON.stringify({ ...emptyWorkspace(), ...patch }, noNul);
  const r = await q1(
    `INSERT INTO workspaces (user_id, data, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET data = workspaces.data || $3::jsonb, updated_at = now()
     RETURNING data`,
    [userId, base, json],
  );
  const stored = typeof r!.data === "string" ? JSON.parse(r!.data) : r!.data;
  if (JSON.stringify(stored).length > 4_000_000) throw Object.assign(new Error("Workspace is too large."), { status: 413 });
  return fromStored(stored);
}
export async function deleteWorkspace(userId: string) {
  await q("DELETE FROM workspaces WHERE user_id=$1", [userId]);
  await q("DELETE FROM files WHERE user_id=$1", [userId]);
}
/** Everything stored about a user: workspace, files, AI usage, sessions and the account row. */
export async function deleteAccount(userId: string) {
  await tx(async (run) => {
    await run("DELETE FROM workspaces WHERE user_id=$1", [userId]);
    await run("DELETE FROM files WHERE user_id=$1", [userId]);
    await run("DELETE FROM ai_usage WHERE user_id=$1", [userId]);
    await run("DELETE FROM sessions WHERE user_id=$1", [userId]);
    await run("DELETE FROM users WHERE id=$1", [userId]);
  });
}
/** Removes expired sessions and guest accounts untouched for `days` days. Returns how many guests were removed. */
export async function cleanupOld(days = 30) {
  await q("DELETE FROM sessions WHERE expires_at < now()");
  const stale = await q(
    `SELECT u.id FROM users u LEFT JOIN workspaces w ON w.user_id = u.id
     WHERE u.kind = 'guest' AND COALESCE(w.updated_at, u.created_at) < now() - make_interval(days => $1::int)`,
    [days],
  );
  for (const { id } of stale) await deleteAccount(id);
  return stale.length;
}

// Guests are free to create, so they get a smaller daily allowance, and the whole
// site has a daily budget so scripted accounts can't drain the shared AI quota.
const SITE_DAILY_AI = Number(process.env.OR_AI_DAILY_BUDGET) || 1500;
export async function aiAllowed(userId: string, guest = false): Promise<{ ok: boolean; message?: string }> {
  await q("DELETE FROM ai_usage WHERE at < now() - interval '1 day'");
  const r = await q1(
    `SELECT COUNT(*)::int AS site,
            COUNT(*) FILTER (WHERE user_id = $1)::int AS day,
            COUNT(*) FILTER (WHERE user_id = $1 AND at > now() - interval '1 minute')::int AS recent
     FROM ai_usage`,
    [userId],
  );
  if (r!.site >= SITE_DAILY_AI) return { ok: false, message: "Remy's AI has reached today's limit for the whole site. It resets within 24 hours; everything else still works." };
  const dayMax = guest ? 40 : 120;
  if (r!.day >= dayMax) return { ok: false, message: guest ? "Guest workspaces get 40 AI requests a day. Sign in to get more." : "Daily AI limit reached for this account (120 requests per 24 hours)." };
  if (r!.recent >= 12) return { ok: false, message: "That was a lot of AI requests at once. Please wait a minute and try again." };
  await q("INSERT INTO ai_usage (user_id) VALUES ($1)", [userId]);
  return { ok: true };
}

// Original uploaded files (the base resume), kept so students can preview and
// download exactly what they uploaded. One per kind per user.
export async function saveFile(userId: string, kind: string, name: string, mime: string, data: Buffer) {
  await q(
    `INSERT INTO files (user_id, kind, name, mime, data) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, kind) DO UPDATE SET name = EXCLUDED.name, mime = EXCLUDED.mime, data = EXCLUDED.data, at = now()`,
    [userId, kind, name, mime, data],
  );
}
export async function getFile(userId: string, kind: string): Promise<{ name: string; mime: string; data: Buffer } | null> {
  const r = await q1("SELECT name, mime, data FROM files WHERE user_id=$1 AND kind=$2", [userId, kind]);
  return r ? { name: r.name, mime: r.mime, data: Buffer.from(r.data) } : null;
}
export async function deleteFile(userId: string, kind: string) {
  await q("DELETE FROM files WHERE user_id=$1 AND kind=$2", [userId, kind]);
}
export async function deleteFiles(userId: string) {
  await q("DELETE FROM files WHERE user_id=$1", [userId]);
}
