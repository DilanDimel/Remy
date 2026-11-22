// Google Calendar connection. With the calendar.app.created permission Remy can only create and manage its
// own "Remy" calendar in the student's account: it never sees their other calendars or events.
// Disconnecting or deleting the Remy account deletes that calendar right away.
import crypto from "node:crypto";
import type { CalItem } from "@shared/types";
import { q, q1 } from "../platform/sql";

const ID = process.env.GCAL_CLIENT_ID || "";
const SECRET = process.env.GCAL_CLIENT_SECRET || "";
const SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
const API = "https://www.googleapis.com/calendar/v3";
export const gcalReady = () => !!(ID && SECRET);

// Refresh tokens are encrypted at rest, so a copy of the database alone can't reach anyone's calendar.
const key = () => crypto.createHash("sha256").update("remy-gcal:" + SECRET).digest();
export function seal(s: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(s, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}
export function unseal(s: string) {
  const b = Buffer.from(s, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

export function authUrl(state: string, redirect: string) {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  for (const [k, v] of Object.entries({ client_id: ID, redirect_uri: redirect, response_type: "code", scope: SCOPE, access_type: "offline", prompt: "consent", state })) u.searchParams.set(k, v);
  return u.toString();
}

async function token(params: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: ID, client_secret: SECRET, ...params }) });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error_description || j.error || "Google sign-in failed"), { code: j.error });
  return j as { access_token: string; refresh_token?: string; scope?: string };
}

async function api(tok: string, method: string, path: string, body?: unknown): Promise<any> {
  const r = await fetch(API + path, { method, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 204) return null;
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error?.message || `Google Calendar error ${r.status}`), { status: r.status });
  return j;
}

type Row = { refresh: string; calendar_id: string; tz: string };
const row = async (userId: string) => (await q1("SELECT refresh, calendar_id, tz FROM google_calendar WHERE user_id=$1", [userId])) as Row | undefined;
const access = async (r: Row) => (await token({ refresh_token: unseal(r.refresh), grant_type: "refresh_token" })).access_token;
const cal = (r: Row) => `/calendars/${encodeURIComponent(r.calendar_id)}`;

export const connected = async (userId: string) => !!(await row(userId));

/** Google's consent → a new calendar of Remy's own in that account. */
async function createCalendar(code: string, redirect: string, tz: string, summary: string, description: string) {
  const t = await token({ code, redirect_uri: redirect, grant_type: "authorization_code" });
  if (!t.refresh_token || !(t.scope || "").includes(SCOPE)) throw Object.assign(new Error("Google didn't give Remy calendar access. Try again and allow it."), { status: 400 });
  const c = await api(t.access_token, "POST", "/calendars", { summary, description, timeZone: tz });
  return { refresh: seal(t.refresh_token), calendar_id: c.id as string, tz };
}

/** Finishes Google's consent: creates the "Remy" calendar and remembers it (replacing an older connection). */
export async function connect(userId: string, code: string, redirect: string, tz: string) {
  const r = await createCalendar(code, redirect, tz, "Remy", "Deadlines, interviews and events from Remy. Deleted automatically if you disconnect or delete your Remy account.");
  await disconnect(userId);
  await q(
    `INSERT INTO google_calendar (user_id, refresh, calendar_id, tz) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id) DO UPDATE SET refresh=EXCLUDED.refresh, calendar_id=EXCLUDED.calendar_id, tz=EXCLUDED.tz, connected_at=now()`,
    [userId, r.refresh, r.calendar_id, r.tz],
  );
}

/** Deletes the Remy calendar from the student's Google account and forgets the connection.
 *  false when Google wouldn't delete it (e.g. the student already removed Remy's access in Google). */
export async function disconnect(userId: string): Promise<boolean> {
  const r = await row(userId);
  if (!r) return true;
  const removed = await removeCalendar(r);
  await q("DELETE FROM google_calendar WHERE user_id=$1", [userId]);
  return removed;
}
async function removeCalendar(r: Row): Promise<boolean> {
  let removed = true;
  try {
    const tok = await access(r);
    await api(tok, "DELETE", cal(r)).catch((e) => { if (e.status !== 404 && e.status !== 410) throw e; });
  } catch (e: any) {
    removed = false;
    console.error("Couldn't delete the Remy Google calendar:", e?.message);
  }
  await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(unseal(r.refresh)), { method: "POST" }).catch(() => {});
  return removed;
}

/** Google event ids allow a–v and 0–9; hex fits. Stable per Remy item, so updates replace instead of duplicating. */
export const eventId = (itemId: string) => "rem" + crypto.createHash("sha1").update(itemId).digest("hex");
const nextDay = (d: string) => new Date(Date.parse(d + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10);
const plusHour = (t: string) => { const [h, m] = t.split(":").map(Number); return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(h >= 23 ? 59 : m).padStart(2, "0")}`; };
export function toEvent(it: CalItem, tz: string) {
  const timed = /^\d{2}:\d{2}$/.test(it.time);
  return {
    id: eventId(it.id), status: "confirmed", summary: it.title, description: [it.kind, it.notes].filter(Boolean).join("\n\n"),
    start: timed ? { dateTime: `${it.date}T${it.time}:00`, timeZone: tz } : { date: it.date },
    end: timed ? { dateTime: `${it.date}T${plusHour(it.time)}:00`, timeZone: tz } : { date: nextDay(it.date) },
  };
}

/** Makes the Remy calendar match the student's Remy calendar items exactly. */
export async function sync(userId: string, items: CalItem[]) {
  const r = await row(userId);
  if (r) await mirror(r, items);
}
async function mirror(r: Row, items: CalItem[]) {
  const tok = await access(r);
  const want = new Map(items.filter((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.date)).map((i) => [eventId(i.id), toEvent(i, r.tz)]));
  const have = new Set<string>();
  let page = "";
  do {
    const j = await api(tok, "GET", `${cal(r)}/events?maxResults=2500${page ? `&pageToken=${page}` : ""}`);
    for (const e of j.items || []) have.add(e.id);
    page = j.nextPageToken || "";
  } while (page);
  for (const [id, ev] of want) {
    if (have.has(id)) await api(tok, "PUT", `${cal(r)}/events/${id}`, ev);
    else await api(tok, "POST", `${cal(r)}/events`, ev).catch((e) => (e.status === 409 ? api(tok, "PUT", `${cal(r)}/events/${id}`, ev) : Promise.reject(e)));
  }
  for (const id of have) if (!want.has(id)) await api(tok, "DELETE", `${cal(r)}/events/${id}`).catch(() => {});
}

// Calendar edits often come in bursts; sync once they settle.
const timers = new Map<string, NodeJS.Timeout>();
export function syncSoon(userId: string, load: () => Promise<CalItem[]>) {
  clearTimeout(timers.get(userId));
  timers.set(userId, setTimeout(() => {
    timers.delete(userId);
    load().then((items) => sync(userId, items)).catch((e) => console.error("Google Calendar sync failed:", e?.message));
  }, 1500));
}

// ---------- the team's calendar (owners' dashboard) ----------
// One "Remy team" calendar in the team's shared Google account, mirroring the dashboard's meetings.
const teamRow = async () => (await q1("SELECT refresh, calendar_id, tz, connected_by, connected_at FROM team_calendar WHERE id='team'")) as (Row & { connected_by: string; connected_at: string }) | undefined;
export async function teamStatus() {
  const r = gcalReady() ? await teamRow() : undefined;
  return { available: gcalReady(), connectedBy: r?.connected_by || "", connectedAt: r?.connected_at || null };
}
export async function connectTeam(by: string, code: string, redirect: string, tz: string) {
  const r = await createCalendar(code, redirect, tz, "Remy team", "Team meetings from Remy's owners' dashboard, with who's going. Deleted if the dashboard disconnects it.");
  await disconnectTeam();
  await q("INSERT INTO team_calendar (id, refresh, calendar_id, tz, connected_by) VALUES ('team',$1,$2,$3,$4)", [r.refresh, r.calendar_id, r.tz, by]);
}
export async function disconnectTeam(): Promise<boolean> {
  const r = await teamRow();
  if (!r) return true;
  const removed = await removeCalendar(r);
  await q("DELETE FROM team_calendar WHERE id='team'");
  return removed;
}
let teamTimer: NodeJS.Timeout | undefined;
export function syncTeamSoon(load: () => Promise<CalItem[]>) {
  clearTimeout(teamTimer);
  teamTimer = setTimeout(async () => {
    try {
      const r = await teamRow();
      if (r) await mirror(r, await load());
    } catch (e: any) { console.error("Team Google Calendar sync failed:", e?.message); }
  }, 1500);
}
