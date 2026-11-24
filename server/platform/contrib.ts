// The shared AI system (docs/ai/) on the owners' dashboard: hours and AI cost from merged PRs, what each person's AI
// says it's working on, and requests between AIs with their proof. Reads the public repo, so no token is needed;
// nothing is stored but time entries (the rest stays in server memory, for the Supabase data limit).
import { q, q1 } from "./sql";
import { uid } from "./ids";
import { parseStatus, activeClaims, trackRequests, type AiStatus, type Tracked } from "@shared/aiStatus";

const REPO = "DilanDimel/Remy";
const headers = (): Record<string, string> => ({ accept: "application/vnd.github+json", "user-agent": "remy-dashboard", ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) });
const raw = async (file: string) => {
  const r = await fetch(`https://raw.githubusercontent.com/${REPO}/main/${file}`, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`${file}: ${r.status}`);
  return r.text();
};
type Person = { name: string; login: string; status: string };
const owners = async (): Promise<Person[]> => JSON.parse(await raw("docs/ai/owners.json")).people;

/** "Hours: 2.5" and "AI cost: $0.80" from a PR description; template placeholders read as 0. */
export function prNumbers(body: string) {
  const num = (re: RegExp) => Math.max(0, Number(body.match(re)?.[1] || 0)) || 0;
  return { hours: Math.min(16, num(/Hours:\s*([\d.]+)/i)), cost: num(/AI cost:\s*\$?\s*([\d.]+)/i) };
}

/** The one teammate whose name starts with the person's first name in docs/ai/owners.json.
 *  shortcut: first-name match keeps GitHub logins out of the database; add a login column if two teammates share a first name. */
export function memberFor(name: string, members: { email: string; name: string }[]) {
  const first = name.trim().toLowerCase();
  const hits = members.filter((m) => m.name.trim().toLowerCase().split(/\s+/)[0] === first);
  return hits.length === 1 ? hits[0] : undefined;
}

/** Adds hours and AI cost from PRs merged in the last 3 days, once each. Runs hourly in the background sweep. */
export async function importMergedPrs(members: { email: string; name: string }[], log: (actor: string, action: string, detail: string) => Promise<void>) {
  const people = await owners();
  const r = await fetch(`https://api.github.com/repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=30`, { headers: headers(), signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  let added = 0;
  for (const pr of (await r.json()) as any[]) {
    if (!pr.merged_at || Date.now() - Date.parse(pr.merged_at) > 3 * 86400_000) continue;
    const { hours, cost } = prNumbers(pr.body || "");
    const person = people.find((p) => p.login.toLowerCase() === String(pr.user?.login).toLowerCase());
    const m = person && memberFor(person.name, members);
    if (!m || (!hours && !cost)) continue;
    const ref = `pr:${pr.number}`;
    if (await q1("SELECT 1 FROM time_entries WHERE ref = $1", [ref])) continue;
    const end = new Date(pr.merged_at);
    let start = new Date(+end - hours * 3600_000);
    // Time already clocked in that stretch isn't counted twice: the PR keeps its AI cost and shows 0 h.
    if (await q1("SELECT 1 FROM time_entries WHERE member = $1 AND start_at < $3 AND COALESCE(end_at, now()) > $2", [m.email, start.toISOString(), end.toISOString()])) start = end;
    const h = (+end - +start) / 3600_000;
    await q("INSERT INTO time_entries (id, member, start_at, end_at, note, source, ref, ai_cost) VALUES ($1, $2, $3, $4, $5, 'pr', $6, $7) ON CONFLICT DO NOTHING",
      [uid("tm"), m.email, start.toISOString(), end.toISOString(), `PR #${pr.number}: ${String(pr.title).slice(0, 200)}`, ref, cost]);
    await log(m.email, "Merged a PR", `#${pr.number} ${String(pr.title).slice(0, 120)} (${h.toFixed(1)} h${cost ? `, $${cost.toFixed(2)} AI` : ""})`);
    added++;
  }
  return added;
}

export type AiTeam = { people: { name: string; updated: string; workingOn: string[]; claims: AiStatus["claims"] }[]; requests: Tracked[] };
let cache: { at: number; team: AiTeam } = { at: 0, team: { people: [], requests: [] } };
/** Everyone's status file and the requests between them, cached in memory for 30 minutes. */
export async function aiTeam(): Promise<AiTeam> {
  if (Date.now() - cache.at < 30 * 60_000) return cache.team;
  try {
    const files = await Promise.all((await owners()).map(async (p) => ({ name: p.name, status: parseStatus(await raw(p.status)) })));
    const week = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    cache = {
      at: Date.now(),
      team: {
        people: files.map(({ name, status: s }) => ({ name, updated: s.updated, workingOn: s.workingOn, claims: activeClaims(s.claims) })),
        requests: trackRequests(files).filter((r) => !["done", "declined"].includes(r.state) || r.date >= week),
      },
    };
  } catch (e: any) { console.error("ai status read failed", e?.message); cache.at = Date.now() - 25 * 60_000; } // try again in 5 minutes
  return cache.team;
}
