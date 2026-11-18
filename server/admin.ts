// The owners' dashboard: how Remy is used, the errors students hit, and the team's own
// to-dos, meetings, hours and a log of who did what. Students' resumes, chats and files are never shown here.
import type { CalItem, Me } from "@shared/types";
import * as gcal from "./gcal";
import { q, q1 } from "./sql";
import { loadWorkspace } from "./db";
import { milestones } from "@shared/progress";
import { uid } from "./ids";
import { emailReady } from "./email";

const cut = (v: unknown, n: number) => String(v ?? "").slice(0, n);
const bad = (message: string, status = 400) => Object.assign(new Error(message), { status });

// ---------- who is an owner ----------
// OWNER_EMAILS (set on the server) are the founders; they add the rest of the team from the dashboard.
const envOwners = () => (process.env.OWNER_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
let members: { at: number; set: Set<string> } = { at: 0, set: new Set() };
async function memberEmails() {
  if (Date.now() - members.at > 30_000) members = { at: Date.now(), set: new Set((await q("SELECT email FROM team_members")).map((r) => String(r.email))) };
  return members.set;
}
/** Owners are signed-in accounts (never guests) whose email is in OWNER_EMAILS or was added in the dashboard. */
export async function isOwner(me: Pick<Me, "kind" | "email">) {
  if ((me.kind !== "google" && me.kind !== "supabase") || !me.email) return false;
  const e = me.email.toLowerCase();
  return envOwners().includes(e) || (await memberEmails()).has(e);
}

export async function logAction(actor: string, action: string, detail = "") { await log(actor, action, detail); }
async function log(actor: string, action: string, detail = "") {
  await q("INSERT INTO team_activity (actor, action, detail) VALUES ($1, $2, $3)", [actor, cut(action, 200), cut(detail, 500)]);
}

// Long enough for a whole "Send feedback" note (the box takes 1,000 characters); browser errors are shorter anyway.
const MESSAGE_MAX = 1000;
/** Errors thrown by a visitor's browser extension (crypto wallets, ad blockers), not by Remy. */
export const fromExtension = (stack: string) => /(chrome|moz|safari-web)-extension:\/\//.test(stack || "");
/** Saves an error a student hit. Kept 60 days. */
export async function recordError(kind: "browser" | "server" | "feedback", place: string, message: string, detail = "", userId = "") {
  try {
    await q("INSERT INTO error_reports (kind, place, message, detail, user_id) VALUES ($1, $2, $3, $4, $5)", [kind, cut(place, 200), cut(message, MESSAGE_MAX), cut(detail, 2000), cut(userId, 80)]);
    if (Math.random() < 0.02) await q("DELETE FROM error_reports WHERE at < now() - interval '60 days'");
  } catch (e: any) {
    console.error("could not record error", e?.message);
  }
}

// ---------- overview ----------
const SIGNED_IN_ANY = "u.kind IN ('google','supabase')";
/** Real students: signed in, and not a team member (founders, added members) or one of their "+" test addresses
 *  ("dilan+live1103@gmail.com" is dilan@gmail.com testing), nor an address in EXCLUDE_EMAILS. */
export async function studentsOnly() {
  const team = new Set([...envOwners(), ...(await memberEmails()), ...(process.env.EXCLUDE_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean)]);
  if (!team.size) return SIGNED_IN_ANY;
  const list = [...team].map((e) => `'${e.replace(/'/g, "''")}'`).join(",");
  return `${SIGNED_IN_ANY} AND lower(regexp_replace(COALESCE(u.email, ''), '\\+[^@]*@', '@')) NOT IN (${list})`;
}
// AI log purposes → the feature a student was using.
const FEATURES: [string, string][] = [
  ["Reading a resume", "e->>'purpose' = 'Parse resume'"],
  ["Building a resume", "e->>'purpose' LIKE 'Resume builder%'"],
  ["Importing LinkedIn or other profiles", "e->>'purpose' LIKE 'Import %'"],
  ["Remy chat", "e->>'purpose' = 'Assistant chat'"],
  ["Tailoring a resume and letter", "e->>'purpose' LIKE 'Tailor for %'"],
  ["Career explainer", "e->>'purpose' = 'Explain a career'"],
  ["Starting plan", "e->>'purpose' = 'Initial plan'"],
  ["Finding openings", "e->>'purpose' = 'Pick employers'"],
  ["Outreach drafts", "e->>'purpose' = 'Draft outreach'"],
];

export async function overview() {
  const SIGNED_IN = await studentsOnly();
  const totals = await q1(
    `SELECT COUNT(*) FILTER (WHERE ${SIGNED_IN})::int AS students,
            COUNT(*) FILTER (WHERE ${SIGNED_IN} AND u.created_at > now() - interval '7 days')::int AS new_week,
            COUNT(*) FILTER (WHERE ${SIGNED_IN} AND u.created_at <= now() - interval '7 days' AND u.created_at > now() - interval '14 days')::int AS new_prev
     FROM users u`,
  );
  const active = await q1(
    `SELECT COUNT(*) FILTER (WHERE w.updated_at > now() - interval '7 days')::int AS week,
            COUNT(*) FILTER (WHERE w.updated_at <= now() - interval '7 days' AND w.updated_at > now() - interval '14 days')::int AS prev,
            COUNT(*) FILTER (WHERE w.updated_at > now() - interval '1 day')::int AS today
     FROM workspaces w JOIN users u ON u.id = w.user_id WHERE ${SIGNED_IN}`,
  );
  const daily = await q(
    `SELECT to_char(date_trunc('day', u.created_at AT TIME ZONE 'America/Chicago'), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
     FROM users u WHERE ${SIGNED_IN} AND u.created_at > now() - interval '14 days' GROUP BY 1 ORDER BY 1`,
  );
  // How far signed-in students get. Counts only; nothing a student wrote is read out.
  const funnel = await q1(
    `SELECT COUNT(*)::int AS accounts,
            COUNT(*) FILTER (WHERE COALESCE(w.data->'profile'->>'goal', '') <> '' OR w.data->'onboarding'->>'focus' IS NOT NULL OR (w.data->'onboarding'->>'done')::boolean)::int AS goal,
            COUNT(*) FILTER (WHERE w.data->'resume' IS NOT NULL AND w.data->'resume' <> 'null'::jsonb)::int AS resume,
            COUNT(*) FILTER (WHERE (w.data->'onboarding'->>'step')::int >= 4 OR (w.data->'onboarding'->>'done')::boolean)::int AS questions,
            COUNT(*) FILTER (WHERE (w.data->'onboarding'->>'step')::int >= 5 OR (w.data->'onboarding'->>'done')::boolean)::int AS plan,
            COUNT(*) FILTER (WHERE (w.data->'onboarding'->>'step')::int >= 3 OR (w.data->'onboarding'->>'done')::boolean)::int AS prefs,
            COUNT(*) FILTER (WHERE (w.data->'onboarding'->>'done')::boolean)::int AS setup_done,
            COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(w.data->'chat', '[]'::jsonb)) > 0)::int AS chatted,
            COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(w.data->'applications', '[]'::jsonb)) > 0)::int AS applied
     FROM workspaces w JOIN users u ON u.id = w.user_id WHERE ${SIGNED_IN}`,
  );
  const since = "(e->>'at') > to_char(now() - interval '7 days', 'YYYY-MM-DD\"T\"HH24:MI:SS')";
  const features = await Promise.all(FEATURES.map(async ([name, where]) => {
    const r = await q1(`SELECT COUNT(DISTINCT w.user_id)::int AS students, COUNT(*)::int AS uses FROM workspaces w JOIN users u ON u.id = w.user_id, jsonb_array_elements(COALESCE(w.data->'aiLog', '[]'::jsonb)) e WHERE ${SIGNED_IN} AND ${since} AND ${where}`);
    return { name, students: r?.students ?? 0, uses: r?.uses ?? 0 };
  }));
  // AI spend comes from the cost OpenRouter reports per call (logged since 2026-10-28).
  const ai = await q1(
    `SELECT COUNT(*)::int AS calls, COUNT(*) FILTER (WHERE (e->>'ok')::boolean IS NOT TRUE)::int AS failed,
            COALESCE(SUM((e->>'cost')::numeric), 0)::float AS cost, COUNT(e->'cost')::int AS priced,
            COALESCE(ROUND(AVG((e->>'ms')::numeric)), 0)::int AS avg_ms
     FROM workspaces, jsonb_array_elements(COALESCE(data->'aiLog', '[]'::jsonb)) e WHERE ${since}`,
  );
  // North star: students who did a real career step (not just chatting) — started an application,
  // tailored a resume, drafted outreach or worked on their resume — in each of the last two weeks.
  const ts = (days: number) => `to_char(now() - interval '${days} days', 'YYYY-MM-DD"T"HH24:MI:SS')`;
  const stepIn = (from: number, to: number) => `EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(w.data->'applications', '[]'::jsonb) || COALESCE(w.data->'outreach', '[]'::jsonb)) x
      WHERE (x->>'createdAt') > ${ts(from)} AND (x->>'createdAt') <= ${ts(to)}
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(w.data->'aiLog', '[]'::jsonb)) e
      WHERE (e->>'purpose' LIKE 'Tailor for %' OR e->>'purpose' LIKE 'Resume builder%') AND (e->>'at') > ${ts(from)} AND (e->>'at') <= ${ts(to)}
    )`;
  const north = await q1(
    `SELECT COUNT(*) FILTER (WHERE ${stepIn(7, 0)})::int AS week, COUNT(*) FILTER (WHERE ${stepIn(14, 7)})::int AS prev
     FROM workspaces w JOIN users u ON u.id = w.user_id WHERE ${SIGNED_IN}`,
  );
  // Return: of students who signed up 8–35 days ago, the share who opened Remy again in days 1–7 (week 1);
  // of those who signed up 29–56 days ago, the share back in days 22–28 (week 4). Dates only, nothing they wrote.
  const back = (from: number, to: number, minAge: number, maxAge: number) => `
    SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(COALESCE(w.data->'visits', '[]'::jsonb)) v
      WHERE v::date BETWEEN (u.created_at AT TIME ZONE 'America/Chicago')::date + ${from} AND (u.created_at AT TIME ZONE 'America/Chicago')::date + ${to}))::int AS back
    FROM users u JOIN workspaces w ON w.user_id = u.id
    WHERE ${SIGNED_IN} AND u.created_at <= now() - interval '${minAge} days' AND u.created_at > now() - interval '${maxAge} days'`;
  const w1 = await q1(back(1, 7, 8, 35)), w4 = await q1(back(22, 28, 29, 56));
  // Road to an offer: how many students reached each milestone (counts only).
  // shortcut: reads every signed-in workspace; move to SQL past ~1,000 students.
  const road = new Map<string, number>();
  for (const r of await q(`SELECT w.user_id FROM workspaces w JOIN users u ON u.id = w.user_id WHERE ${SIGNED_IN}`))
    for (const m of milestones(await loadWorkspace(String(r.user_id)))) road.set(m.label, (road.get(m.label) || 0) + (m.done ? 1 : 0));
  // Emails: who left each one on, and how many got a weekly digest in the last 7 days.
  const mail = await q1(
    `SELECT COUNT(*) FILTER (WHERE w.data->'settings'->'notify'->>'deadlines' = 'true')::int AS reminders,
            COUNT(*) FILTER (WHERE w.data->'settings'->'notify'->>'weeklyPlan' = 'true')::int AS digest,
            COUNT(*) FILTER (WHERE (w.data->>'lastDigestAt') > ${ts(7)})::int AS digests_week
     FROM workspaces w JOIN users u ON u.id = w.user_id WHERE ${SIGNED_IN}`,
  );
  const openErrors = await q1("SELECT COUNT(DISTINCT message) FILTER (WHERE kind <> 'feedback')::int AS n, COUNT(*) FILTER (WHERE kind = 'feedback')::int AS feedback FROM error_reports WHERE fixed_at IS NULL AND at > now() - interval '30 days'");
  return {
    students: totals?.students ?? 0, newWeek: totals?.new_week ?? 0, newPrev: totals?.new_prev ?? 0,
    northWeek: north?.week ?? 0, northPrev: north?.prev ?? 0,
    road: [...road].map(([label, n]) => ({ label, n })),
    returnWeek1: { cohort: w1?.n ?? 0, back: w1?.back ?? 0 }, returnWeek4: { cohort: w4?.n ?? 0, back: w4?.back ?? 0 },
    activeWeek: active?.week ?? 0, activePrev: active?.prev ?? 0, activeToday: active?.today ?? 0,
    daily, funnel, features: features.filter((f) => f.uses).sort((a, b) => b.students - a.students || b.uses - a.uses),
    ai: { calls: ai?.calls ?? 0, failed: ai?.failed ?? 0, cost: ai?.cost ?? 0, priced: ai?.priced ?? 0, avgMs: ai?.avg_ms ?? 0 },
    openErrors: openErrors?.n ?? 0, feedback: openErrors?.feedback ?? 0,
    emails: { ready: emailReady(), reminders: mail?.reminders ?? 0, digest: mail?.digest ?? 0, digestsWeek: mail?.digests_week ?? 0 },
  };
}

// ---------- errors ----------
export async function errors() {
  const open = await q(
    `SELECT message, kind, MIN(place) AS place, COUNT(DISTINCT place)::int AS places, COUNT(*)::int AS times, COUNT(DISTINCT NULLIF(user_id, ''))::int AS students, MAX(at) AS last, MIN(at) AS first,
            (SELECT detail FROM error_reports d WHERE d.message = e.message AND d.kind = e.kind ORDER BY at DESC LIMIT 1) AS detail
     FROM error_reports e WHERE fixed_at IS NULL AND kind <> 'feedback' AND at > now() - interval '30 days' GROUP BY message, kind ORDER BY MAX(at) DESC LIMIT 30`,
  );
  // What students wrote with "Send feedback": one row each, until someone marks it handled.
  const feedback = await q("SELECT id, at, place, message, detail AS email FROM error_reports WHERE kind = 'feedback' AND fixed_at IS NULL ORDER BY at DESC LIMIT 200");
  const fixed = await q(
    `SELECT message, kind, MAX(fixed_at) AS fixed_at, MAX(fixed_by) AS fixed_by, COUNT(*)::int AS times
     FROM error_reports WHERE fixed_at > now() - interval '30 days' GROUP BY message, kind ORDER BY MAX(fixed_at) DESC LIMIT 15`,
  );
  return { open, fixed, feedback };
}
/** Marks every open report of one error as fixed. If it happens again, it shows up as open again. */
export async function fixError(me: string, message: string, kind: string) {
  const r = await q1("WITH u AS (UPDATE error_reports SET fixed_at = now(), fixed_by = $3 WHERE message = $1 AND kind = $2 AND fixed_at IS NULL RETURNING 1) SELECT COUNT(*)::int AS n FROM u", [cut(message, MESSAGE_MAX), cut(kind, 20), me]);
  if (r?.n) await log(me, kind === "feedback" ? "Handled feedback" : "Marked an error fixed", message);
}

// ---------- the team ----------
async function people() {
  const added = await q("SELECT email, name, added_by, added_at FROM team_members ORDER BY added_at");
  const env = envOwners();
  const all = [...new Set([...env, ...added.map((m) => String(m.email))])];
  const names = new Map((await q("SELECT lower(email) AS email, name FROM users WHERE lower(email) = ANY($1)", [all])).map((r) => [r.email, r.name]));
  return all.map((email) => {
    const row = added.find((m) => m.email === email);
    return { email, name: String(row?.name || names.get(email) || email.split("@")[0]), founder: env.includes(email), addedBy: row?.added_by || "", addedAt: row?.added_at || null };
  });
}

export async function team(me: string) {
  const [members, tasks, events, hours, entries, activity, rsvps, calendar] = await Promise.all([
    people(),
    q("SELECT * FROM team_tasks ORDER BY (due = ''), due, created_at"),
    q("SELECT * FROM team_events WHERE date >= to_char(now() - interval '30 days', 'YYYY-MM-DD') ORDER BY date, time"),
    q(
      `SELECT member, ROUND((SUM(EXTRACT(EPOCH FROM (COALESCE(end_at, now()) - start_at))) / 3600)::numeric, 1)::float AS hours,
              ROUND((COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(end_at, now()) - start_at))) FILTER (WHERE start_at > now() - interval '7 days'), 0) / 3600)::numeric, 1)::float AS week
       FROM time_entries GROUP BY member ORDER BY member`,
    ),
    q("SELECT * FROM time_entries ORDER BY start_at DESC LIMIT 60"),
    q("SELECT * FROM team_activity ORDER BY at DESC LIMIT 80"),
    q("SELECT event_id, member, answer FROM team_event_rsvps"),
    gcal.teamStatus(),
  ]);
  const mine = entries.find((e) => e.member === me && !e.end_at);
  for (const e of events) e.rsvps = Object.fromEntries(rsvps.filter((r) => r.event_id === e.id).map((r) => [r.member, r.answer]));
  return { me, members, tasks, events, hours, entries, activity, calendar, clockedIn: mine ? mine.start_at : null };
}

export async function addMember(me: string, b: any) {
  const email = cut(b.email, 200).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad("Enter the email your teammate signs in to Remy with.");
  await q("INSERT INTO team_members (email, name, added_by) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name", [email, cut(b.name, 80).trim(), me]);
  members.at = 0;
  await log(me, "Added a teammate", `${cut(b.name, 80) || email} (${email})`);
}
export async function removeMember(me: string, email: string) {
  const e = email.toLowerCase();
  if (e === me) throw bad("You can't remove yourself.");
  if (envOwners().includes(e)) throw bad("Founders are set on the server (OWNER_EMAILS) and can't be removed here.");
  await q("DELETE FROM team_members WHERE email = $1", [e]);
  members.at = 0;
  await log(me, "Removed a teammate", e);
}

/** Assigned teammates as stored: lowercase emails, comma-separated (one column, no migration for to-dos). */
export const emails = (v: unknown) => [...new Set((Array.isArray(v) ? v : String(v ?? "").split(",")).map((x) => cut(x, 200).trim().toLowerCase()).filter((x) => x.includes("@")))].slice(0, 12).join(",");

export async function saveTask(me: string, b: any) {
  if (b.id) {
    const before = await q1("SELECT * FROM team_tasks WHERE id = $1", [cut(b.id, 60)]);
    if (!before) throw bad("That to-do isn't there anymore.", 404);
    // A column move (status) or the old done checkbox; done always matches the Done column.
    const status = ["todo", "doing", "done"].includes(b.status) ? b.status : typeof b.done === "boolean" ? (b.done ? "done" : "todo") : null;
    const done = status ? status === "done" : null;
    await q(
      `UPDATE team_tasks SET title = COALESCE($2, title), assignee = COALESCE($3, assignee), due = COALESCE($4, due), notes = COALESCE($5, notes),
              done = COALESCE($6, done), status = COALESCE($8, status),
              done_by = CASE WHEN $6 IS TRUE AND NOT done THEN $7 WHEN $6 IS FALSE THEN '' ELSE done_by END,
              done_at = CASE WHEN $6 IS TRUE AND NOT done THEN now() WHEN $6 IS FALSE THEN NULL ELSE done_at END
       WHERE id = $1`,
      [before.id, b.title == null ? null : cut(b.title, 300), b.assignee == null ? null : emails(b.assignee), b.due == null ? null : cut(b.due, 10), b.notes == null ? null : cut(b.notes, 2000), done, me, status],
    );
    if (done === true && !before.done) await log(me, "Finished a to-do", before.title);
    else if (status === "doing" && before.status !== "doing") await log(me, "Started a to-do", before.title);
    else if (done === false && before.done) await log(me, "Reopened a to-do", before.title);
    else if (b.assignee != null && emails(b.assignee) !== before.assignee) await log(me, "Assigned a to-do", `${before.title} → ${emails(b.assignee).replace(/,/g, ", ") || "nobody"}`);
  } else {
    const title = cut(b.title, 300).trim();
    if (!title) throw bad("Give the to-do a title.");
    await q("INSERT INTO team_tasks (id, title, assignee, due, notes, created_by) VALUES ($1, $2, $3, $4, $5, $6)", [uid("tt"), title, emails(b.assignee), cut(b.due, 10), cut(b.notes, 2000), me]);
    await log(me, "Added a to-do", emails(b.assignee) ? `${title} → ${emails(b.assignee).replace(/,/g, ", ")}` : title);
  }
}
export async function deleteTask(me: string, id: string) {
  const t = await q1("DELETE FROM team_tasks WHERE id = $1 RETURNING title", [cut(id, 60)]);
  if (t) await log(me, "Deleted a to-do", t.title);
}

export async function addEvent(me: string, b: any) {
  if (!cut(b.title, 300).trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) throw bad("Give the meeting a title and a date.");
  const id = uid("te");
  await q("INSERT INTO team_events (id, title, date, time, who, notes, created_by, assignees) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [id, cut(b.title, 300), b.date, /^\d{2}:\d{2}$/.test(String(b.time)) ? b.time : "", cut(b.who, 300), cut(b.notes, 2000), me, emails(b.assignees)]);
  // Whoever adds a meeting is going, unless they say otherwise.
  await q("INSERT INTO team_event_rsvps (event_id, member, answer) VALUES ($1, $2, 'yes')", [id, me]);
  await log(me, "Added a meeting", `${cut(b.title, 300)} on ${b.date}`);
  syncTeamCalendar();
}
/** Changes which teammates are on a meeting. */
export async function setEventPeople(me: string, id: string, assignees: unknown) {
  const e = await q1("UPDATE team_events SET assignees = $2 WHERE id = $1 RETURNING title, date, assignees", [cut(id, 60), emails(assignees)]);
  if (!e) throw bad("That meeting isn't there anymore.", 404);
  await log(me, "Set who's on a meeting", `${e.title} on ${e.date} → ${e.assignees.replace(/,/g, ", ") || "nobody"}`);
  syncTeamCalendar();
}
export async function deleteEvent(me: string, id: string) {
  const e = await q1("DELETE FROM team_events WHERE id = $1 RETURNING title, date", [cut(id, 60)]);
  if (e) await log(me, "Removed a meeting", `${e.title} on ${e.date}`);
  syncTeamCalendar();
}
const ANSWERS: Record<string, string> = { yes: "Going", maybe: "Maybe", no: "Can't go" };
/** A teammate's answer for a meeting: yes | maybe | no, or "" to take it back. */
export async function rsvp(me: string, id: string, answer: string) {
  const e = await q1("SELECT title, date FROM team_events WHERE id = $1", [cut(id, 60)]);
  if (!e) throw bad("That meeting isn't there anymore.", 404);
  if (!answer) await q("DELETE FROM team_event_rsvps WHERE event_id = $1 AND member = $2", [cut(id, 60), me]);
  else if (ANSWERS[answer]) await q(
    `INSERT INTO team_event_rsvps (event_id, member, answer) VALUES ($1, $2, $3)
     ON CONFLICT (event_id, member) DO UPDATE SET answer = EXCLUDED.answer, at = now()`, [cut(id, 60), me, answer]);
  else throw bad("Answer going, maybe or can't go.");
  await log(me, answer ? `${ANSWERS[answer]}: a meeting` : "Took back a meeting answer", `${e.title} on ${e.date}`);
  syncTeamCalendar();
}

/** The dashboard's meetings as calendar items, each with who's going in its notes. */
export async function teamCalendarItems(): Promise<CalItem[]> {
  const [events, rsvps, ppl] = await Promise.all([
    q("SELECT * FROM team_events WHERE date >= to_char(now() - interval '30 days', 'YYYY-MM-DD')"),
    q("SELECT event_id, member, answer FROM team_event_rsvps"),
    people(),
  ]);
  const name = (email: string) => ppl.find((p) => p.email === email)?.name || email.split("@")[0];
  return events.map((e) => {
    const said = (a: string) => rsvps.filter((r) => r.event_id === e.id && r.answer === a).map((r) => name(r.member));
    const lines = Object.entries(ANSWERS).map(([a, label]) => { const n = said(a); return n.length ? `${label} (${n.length}): ${n.join(", ")}` : ""; }).filter(Boolean);
    return { id: e.id, title: e.title, date: e.date, time: e.time, kind: "Event", source: "Owners' dashboard",
      notes: [e.assignees && `Team: ${String(e.assignees).split(",").map(name).join(", ")}`, e.who && `With ${e.who}`, e.notes, lines.join("\n"), "Answer in Remy's owners' dashboard → Calendar."].filter(Boolean).join("\n") } as CalItem;
  });
}
export const syncTeamCalendar = () => { if (gcal.gcalReady()) gcal.syncTeamSoon(teamCalendarItems); };

/** Clock in starts an entry; clock out ends the open one. Each owner clocks only themselves. */
export async function clock(me: string, action: "in" | "out", note = "") {
  const open = await q1("SELECT id, start_at FROM time_entries WHERE member = $1 AND end_at IS NULL", [me]);
  if (action === "in") {
    if (open) throw bad("You're already clocked in.", 409);
    await q("INSERT INTO time_entries (id, member, note) VALUES ($1, $2, $3)", [uid("tm"), me, cut(note, 300)]);
    await log(me, "Clocked in", note);
  } else {
    if (!open) throw bad("You're not clocked in.", 409);
    await q("UPDATE time_entries SET end_at = now(), note = CASE WHEN $2 = '' THEN note ELSE $2 END WHERE id = $1", [open.id, cut(note, 300)]);
    const h = (Date.now() - new Date(open.start_at).getTime()) / 3600_000;
    await log(me, "Clocked out", `${h.toFixed(1)} h${note ? `: ${note}` : ""}`);
  }
}
