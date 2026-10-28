// The owners' dashboard: how Remy is used, the errors students hit, and the team's own
// to-dos, meetings and hours. Students' resumes, chats and files are never shown here.
import type { Me } from "@shared/types";
import { q, q1 } from "./sql";
import { uid } from "./ids";

/** Owners are the signed-in accounts whose email is in OWNER_EMAILS (comma-separated). Guests never are. */
export function isOwner(me: Pick<Me, "kind" | "email">) {
  const list = (process.env.OWNER_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
  return (me.kind === "google" || me.kind === "supabase") && !!me.email && list.includes(me.email.toLowerCase());
}

const cut = (v: unknown, n: number) => String(v ?? "").slice(0, n);

/** Saves an error a student hit. Kept 60 days; at most a few thousand rows. */
export async function recordError(kind: "browser" | "server", place: string, message: string, detail = "", userId = "") {
  try {
    await q("INSERT INTO error_reports (kind, place, message, detail, user_id) VALUES ($1, $2, $3, $4, $5)", [kind, cut(place, 200), cut(message, 500), cut(detail, 2000), cut(userId, 80)]);
    if (Math.random() < 0.02) await q("DELETE FROM error_reports WHERE at < now() - interval '60 days'");
  } catch (e: any) {
    console.error("could not record error", e?.message);
  }
}

const n = (r?: Record<string, any>) => Number(r?.n ?? 0);

export async function overview() {
  const users = await q("SELECT kind, COUNT(*)::int AS n FROM users GROUP BY kind");
  const daily = await q(
    `SELECT to_char(date_trunc('day', created_at AT TIME ZONE 'America/Chicago'), 'YYYY-MM-DD') AS day,
            COUNT(*) FILTER (WHERE kind IN ('google','supabase'))::int AS signed_in, COUNT(*) FILTER (WHERE kind = 'guest')::int AS guests
     FROM users WHERE created_at > now() - interval '14 days' GROUP BY 1 ORDER BY 1`,
  );
  const active = await q1(
    `SELECT COUNT(*) FILTER (WHERE updated_at > now() - interval '1 day')::int AS d1,
            COUNT(*) FILTER (WHERE updated_at > now() - interval '7 days')::int AS d7,
            COUNT(*) FILTER (WHERE updated_at > now() - interval '30 days')::int AS d30
     FROM workspaces w JOIN users u ON u.id = w.user_id WHERE u.kind IN ('google','supabase')`,
  );
  // How far signed-in students get. Counts only; nothing a student wrote is read out.
  const funnel = await q1(
    `SELECT COUNT(*)::int AS accounts,
            COUNT(*) FILTER (WHERE (data->>'started')::boolean)::int AS started,
            COUNT(*) FILTER (WHERE data ? 'resume' AND data->'resume' IS NOT NULL AND data->'resume' <> 'null'::jsonb)::int AS resume,
            COUNT(*) FILTER (WHERE (data->'onboarding'->>'done')::boolean)::int AS setup_done,
            COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(data->'applications', '[]'::jsonb)) > 0)::int AS applied,
            COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(data->'chat', '[]'::jsonb)) > 0)::int AS chatted
     FROM workspaces w JOIN users u ON u.id = w.user_id WHERE u.kind IN ('google','supabase')`,
  );
  // AI calls in the last 7 days, from each workspace's AI log (purpose, success, speed; no content).
  const ai = await q(
    `SELECT e->>'purpose' AS purpose, COUNT(*)::int AS calls, COUNT(*) FILTER (WHERE (e->>'ok')::boolean IS NOT TRUE)::int AS failed,
            COALESCE(ROUND(AVG((e->>'ms')::numeric)), 0)::int AS avg_ms
     FROM workspaces, jsonb_array_elements(COALESCE(data->'aiLog', '[]'::jsonb)) e
     WHERE (e->>'at') > to_char(now() - interval '7 days', 'YYYY-MM-DD"T"HH24:MI:SS') GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
  );
  const errors7 = await q1("SELECT COUNT(*)::int AS n FROM error_reports WHERE at > now() - interval '7 days'");
  return {
    users: Object.fromEntries(users.map((r) => [r.kind, r.n])),
    daily,
    active: { day: active?.d1 ?? 0, week: active?.d7 ?? 0, month: active?.d30 ?? 0 },
    funnel,
    ai,
    errorsThisWeek: n(errors7),
  };
}

export async function errors() {
  const recent = await q("SELECT id, at, kind, place, message, detail FROM error_reports ORDER BY at DESC LIMIT 100");
  const top = await q(
    `SELECT message, kind, MIN(place) AS place, COUNT(*)::int AS times, COUNT(DISTINCT NULLIF(user_id, ''))::int AS students, MAX(at) AS last
     FROM error_reports WHERE at > now() - interval '30 days' GROUP BY message, kind ORDER BY times DESC LIMIT 15`,
  );
  return { recent, top };
}

// ---------- the team's own workspace ----------
export async function team(me: string) {
  const [tasks, events, hours, open] = await Promise.all([
    q("SELECT * FROM team_tasks ORDER BY done, (due = ''), due, created_at"),
    q("SELECT * FROM team_events WHERE date >= to_char(now() - interval '30 days', 'YYYY-MM-DD') ORDER BY date, time"),
    q(
      `SELECT member, ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(end_at, now()) - start_at)) / 3600)::numeric, 1)::float AS hours,
              ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(end_at, now()) - start_at)) / 3600) FILTER (WHERE start_at > now() - interval '7 days')::numeric, 1)::float AS week
       FROM time_entries GROUP BY member ORDER BY member`,
    ),
    q("SELECT * FROM time_entries ORDER BY start_at DESC LIMIT 40"),
  ]);
  const mine = open.find((e) => e.member === me && !e.end_at);
  return { tasks, events, hours, entries: open, clockedIn: mine ? mine.start_at : null };
}

export async function saveTask(me: string, b: any) {
  if (b.id) {
    await q("UPDATE team_tasks SET title = COALESCE($2, title), owner = COALESCE($3, owner), due = COALESCE($4, due), notes = COALESCE($5, notes), done = COALESCE($6, done) WHERE id = $1",
      [cut(b.id, 60), b.title == null ? null : cut(b.title, 300), b.owner == null ? null : cut(b.owner, 120), b.due == null ? null : cut(b.due, 10), b.notes == null ? null : cut(b.notes, 2000), typeof b.done === "boolean" ? b.done : null]);
  } else {
    if (!cut(b.title, 300).trim()) throw Object.assign(new Error("Give the to-do a title."), { status: 400 });
    await q("INSERT INTO team_tasks (id, title, owner, due, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6)", [uid("tt"), cut(b.title, 300), cut(b.owner, 120), cut(b.due, 10), cut(b.notes, 2000), me]);
  }
}
export const deleteTask = (id: string) => q("DELETE FROM team_tasks WHERE id = $1", [cut(id, 60)]);

export async function addEvent(me: string, b: any) {
  if (!cut(b.title, 300).trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) throw Object.assign(new Error("Give the meeting a title and a date."), { status: 400 });
  await q("INSERT INTO team_events (id, title, date, time, who, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [uid("te"), cut(b.title, 300), b.date, /^\d{2}:\d{2}$/.test(String(b.time)) ? b.time : "", cut(b.who, 300), cut(b.notes, 2000), me]);
}
export const deleteEvent = (id: string) => q("DELETE FROM team_events WHERE id = $1", [cut(id, 60)]);

/** Clock in starts an entry; clock out ends the open one. Each owner clocks only themselves. */
export async function clock(me: string, action: "in" | "out", note = "") {
  const open = await q1("SELECT id FROM time_entries WHERE member = $1 AND end_at IS NULL", [me]);
  if (action === "in") {
    if (open) throw Object.assign(new Error("You're already clocked in."), { status: 409 });
    await q("INSERT INTO time_entries (id, member, note) VALUES ($1, $2, $3)", [uid("tm"), me, cut(note, 300)]);
  } else {
    if (!open) throw Object.assign(new Error("You're not clocked in."), { status: 409 });
    await q("UPDATE time_entries SET end_at = now(), note = CASE WHEN $2 = '' THEN note ELSE $2 END WHERE id = $1", [open.id, cut(note, 300)]);
  }
}
