// "Using Remy" (Admin → Team & hours): how much each owner uses Remy themselves, with the same rules for everyone.
// Owner accounts only: every write checks isOwner first, so students are never stored. Pages, actions and minutes,
// never what anyone typed. Minutes are kept 90 days.
import type { Me, OwnerActivity, OwnerUse } from "@shared/types";
import { q } from "./sql";
import { isOwner, people } from "./admin";

const TZ = "America/Chicago";
const DEVICES = ["desktop", "phone", "app"] as const;
type Device = (typeof DEVICES)[number];
/** The shared target the team agreed on (Nov 26): use Remy like a student on at least 3 days a week. */
export const GOAL_DAYS = 3;

// First part of the page address → the name people know. Website and app paths both land here.
const AREAS: Record<string, string> = {
  "": "Home", index: "Home", path: "My Path", resume: "Resume", tailor: "Resume", opportunities: "Jobs", jobs: "Jobs", job: "Jobs", progress: "Progress",
  community: "Community", calendar: "Calendar", rewards: "Rewards", interview: "Interview", round: "Interview", remy: "Remy chat", accounts: "Account",
  account: "Account", profile: "Account", sources: "Account", news: "What's new", admin: "Owners' dashboard", hours: "Progress", more: "Account",
};
export const DASHBOARD = "Owners' dashboard";
/** Areas a student can open, for "not opened in 30 days". */
const STUDENT_AREAS = ["Home", "My Path", "Resume", "Jobs", "Interview", "Remy chat", "Community", "Calendar", "Rewards", "Progress"];
export const areaOf = (path: unknown) => AREAS[String(path || "").replace(/^\/+/, "").split(/[/?#]/)[0].toLowerCase()] || "Other";

// Route pattern → what it means. Only these show under "Did this week"; everything else still counts as use.
const ACTIONS: Record<string, string> = {
  "POST /api/remy/ask": "asked Remy", "POST /api/ai/chat": "asked Remy", "POST /api/remy/act": "let Remy do something",
  "PUT /api/jobs/:id/interest": "saved jobs", "POST /api/jobs/import": "added jobs", "POST /api/applications": "started applications",
  "POST /api/applications/:id/generate": "tailored resumes", "POST /api/interviews": "mock interviews", "POST /api/resume/upload": "uploaded resumes",
  "POST /api/builder/save": "built resumes", "POST /api/ai/outreach": "drafted outreach", "POST /api/ai/pitch": "practised a pitch", "POST /api/feedback": "sent feedback",
};

/** One beat a minute while an owner has Remy on screen and is using it. Anyone else: nothing is stored. */
export async function beat(me: Pick<Me, "kind" | "email"> | null, body: any, now = new Date()) {
  if (!me || !(await isOwner(me))) return false;
  const device: Device = DEVICES.includes(body?.device) ? body.device : "desktop";
  const minute = new Date(Math.floor(+now / 60_000) * 60_000).toISOString();
  await q(
    `INSERT INTO owner_minutes (email, minute, device, area) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email, minute) DO UPDATE SET device = EXCLUDED.device, area = EXCLUDED.area`,
    [me.email!.toLowerCase(), minute, device, areaOf(body?.path)],
  );
  if (now.getUTCMinutes() === 0) await q("DELETE FROM owner_minutes WHERE minute < now() - interval '90 days'"); // tidy up about once an hour
  return true;
}

/** A finished action (non-GET request that worked) by an owner, by route pattern. */
export async function action(me: Me, method: string, pattern: string) {
  if (!me.owner || method === "GET" || !me.email || /^\/api\/(admin|team|signals|client-error|auth)/.test(pattern)) return;
  await q(
    `INSERT INTO owner_actions (email, day, action, n) VALUES ($1, (now() AT TIME ZONE '${TZ}')::date, $2, 1)
     ON CONFLICT (email, day, action) DO UPDATE SET n = owner_actions.n + 1`,
    [me.email.toLowerCase(), `${method} ${pattern}`.slice(0, 120)],
  );
}

const GAP_MIN = 30; // a new visit after 30 quiet minutes
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

/** The last 7 days (today included, Chicago time) for every owner, plus 8 weeks of totals. Owners only (route checks). */
export async function activity(me: string, now = new Date()): Promise<OwnerActivity> {
  const days = Array.from({ length: 7 }, (_, i) => ymd(new Date(+now - (6 - i) * 86400_000)));
  const [members, rows, acts] = await Promise.all([
    people(),
    q(`SELECT email, minute, device, area, to_char(minute AT TIME ZONE '${TZ}', 'YYYY-MM-DD') AS day FROM owner_minutes
       WHERE minute >= $1::timestamptz - interval '56 days' ORDER BY minute`, [now.toISOString()]),
    q(`SELECT email, action, sum(n)::int AS n FROM owner_actions WHERE day >= $1::date GROUP BY email, action`, [days[0]]),
  ]);
  const weekStart = days[0], prevStart = ymd(new Date(+now - 13 * 86400_000));
  const list: OwnerUse[] = members.map((m) => {
    const mine = rows.filter((r) => r.email === m.email);
    const week = mine.filter((r) => r.day >= weekStart);
    const recent = mine.filter((r) => +new Date(r.minute) >= +now - 30 * 86400_000);
    const count = (xs: typeof rows, key: string) => xs.reduce((o, r) => ((o[r[key]] = (o[r[key]] || 0) + 1), o), {} as Record<string, number>);
    const byArea = count(week, "area"), byDay = count(week, "day"), byDev = count(week, "device");
    let visits = 0, last = 0;
    for (const r of week) { const t = +new Date(r.minute); if (!last || t - last > GAP_MIN * 60_000) visits++; last = t; }
    const lastRow = mine[mine.length - 1];
    const areas = Object.entries(byArea).sort((a, b) => b[1] - a[1]).map(([name, minutes]) => ({ name, minutes }));
    const openedRecently = new Set(recent.map((r) => r.area));
    return {
      email: m.email,
      name: m.name,
      me: m.email === me,
      minutes: week.length,
      prevMinutes: mine.filter((r) => r.day >= prevStart && r.day < weekStart).length,
      perDay: days.map((d) => byDay[d] || 0),
      visits,
      lastSeen: lastRow ? new Date(lastRow.minute).toISOString() : null,
      lastDevice: lastRow ? lastRow.device : null,
      devices: { desktop: byDev.desktop || 0, phone: byDev.phone || 0, app: byDev.app || 0 },
      areas,
      dashboard: byArea[DASHBOARD] || 0,
      weeks: Array.from({ length: 8 }, (_, i) => {
        const from = +now - (7 - i + 1) * 7 * 86400_000, to = from + 7 * 86400_000;
        return mine.filter((r) => { const t = +new Date(r.minute); return t > from && t <= to; }).length;
      }),
      did: Object.entries(acts.filter((a) => a.email === m.email).reduce((o, a) => { const l = ACTIONS[a.action]; if (l) o[l] = (o[l] || 0) + Number(a.n); return o; }, {} as Record<string, number>))
        .sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n })),
      notOpened: STUDENT_AREAS.filter((a) => !openedRecently.has(a)),
    };
  });
  list.sort((a, b) => a.name.localeCompare(b.name));
  return { days, goalDays: GOAL_DAYS, people: list };
}
