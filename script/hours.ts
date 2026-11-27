// Rebuilds docs/ai/hours/estimated.json: everyone's timestamped work (commits on every PR branch and main, opened PRs,
// plus extra events such as Dilan's Claude threads), which the server turns into "auto, estimated" hours each hour.
// Run: npm run hours:estimate [-- --extra events.json]   (extra = a JSON array of [who, isoTime, what])
// Each run keeps the events already in the file and adds new ones, so older extra events are never lost.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { toBlocks, type Ev } from "../shared/autoHours";

const REPO = "DilanDimel/Remy";
const FILE = "docs/ai/hours/estimated.json";
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 << 20 });
type Person = { name: string; login: string; lead?: boolean };
const people: Person[] = JSON.parse(fs.readFileSync("docs/ai/owners.json", "utf8")).people;
const lead = people.find((p) => p.lead)!;

/** The person behind a commit author: the login in a GitHub noreply email, else a name that starts with theirs. */
export function personFor(name: string, email: string): Person | undefined {
  const login = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i)?.[1]?.toLowerCase();
  const first = name.trim().toLowerCase().split(/\s+/)[0] || "";
  return people.find((p) => p.login.toLowerCase() === login) || people.find((p) => first.length > 2 && first.startsWith(p.name.toLowerCase()));
}

async function prs(): Promise<{ number: number; login: string; created: string; title: string }[]> {
  // gh where it's installed (signed in, no rate limit), else the public API.
  let list: any[];
  try {
    list = JSON.parse(execFileSync("gh", ["api", "--paginate", "--slurp", `repos/${REPO}/pulls?state=all&per_page=100`], { encoding: "utf8", maxBuffer: 256 << 20 })).flat();
  } catch {
    list = [];
    for (let page = 1; page < 30; page++) {
      const r = await fetch(`https://api.github.com/repos/${REPO}/pulls?state=all&per_page=100&page=${page}`, { headers: { accept: "application/vnd.github+json", "user-agent": "remy-hours" } });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      const got = (await r.json()) as any[];
      list.push(...got);
      if (got.length < 100) break;
    }
  }
  return list.map((p) => ({ number: p.number, login: String(p.user?.login || ""), created: p.created_at, title: String(p.title) }));
}

async function main() {
  const extra = process.argv.indexOf("--extra");
  git("fetch", "-q", "origin", "+refs/pull/*/head:refs/remotes/pr/*", "+refs/heads/main:refs/remotes/origin/main");
  const all = await prs();
  const refsOf = (who?: Person) => all.filter((p) => (who ? personFor("", `${p.login}@users.noreply.github.com`) === who : true)).map((p) => `refs/remotes/pr/${p.number}`)
    .filter((r) => { try { git("rev-parse", "-q", "--verify", r); return true; } catch { return false; } });
  // A commit by an AI with no GitHub login (Claude) counts for the person whose PR branches alone hold it, else the lead.
  const ownerOf = new Map<string, Person>();
  for (const p of people.filter((x) => !x.lead)) {
    const mine = refsOf(p);
    if (!mine.length) continue;
    const others = refsOf().filter((r) => !mine.includes(r));
    for (const h of git("log", "--format=%H", ...mine, "--not", "refs/remotes/origin/main", ...others).split("\n").filter(Boolean)) ownerOf.set(h, p);
  }
  const evs: Ev[] = [];
  const log = git("log", "--format=%H%x1f%aI%x1f%an%x1f%ae%x1f%s", "refs/remotes/origin/main", ...refsOf());
  for (const line of log.split("\n").filter(Boolean)) {
    const [h, at, name, email, subject] = line.split("\x1f");
    const who = personFor(name, email) || ownerOf.get(h) || (/anthropic|claude/i.test(name + email) ? lead : undefined);
    if (who) evs.push([who.name, new Date(at).toISOString(), subject]);
  }
  for (const p of all) {
    const who = personFor("", `${p.login}@users.noreply.github.com`);
    if (who) evs.push([who.name, new Date(p.created).toISOString(), `Opened PR #${p.number}: ${p.title}`]);
  }
  if (extra > 0) evs.push(...(JSON.parse(fs.readFileSync(process.argv[extra + 1], "utf8")) as Ev[]));
  const old: Ev[] = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")).events : [];
  const byKey = new Map<string, Ev>();
  for (const e of [...old, ...evs]) byKey.set(`${e[0]}|${e[1].slice(0, 16)}`, [e[0], e[1].slice(0, 16) + "Z", e[2].slice(0, 120)]);
  const events = [...byKey.values()].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
  const until = new Date(Math.max(...events.map((e) => Date.parse(e[1])))).toISOString();
  fs.mkdirSync("docs/ai/hours", { recursive: true });
  // One event per line, so each night's change is a short diff.
  fs.writeFileSync(FILE, `{\n"_readme": "See README.md here. Written by npm run hours:estimate; the server adds anything newer from GitHub.",\n"until": ${JSON.stringify(until)},\n"events": [\n${events.map((e) => JSON.stringify(e)).join(",\n")}\n]\n}\n`);
  const hours: Record<string, number> = {};
  for (const b of toBlocks(events)) hours[b.who] = (hours[b.who] || 0) + (Date.parse(b.end) - Date.parse(b.start)) / 3600_000;
  console.log(`${events.length} events up to ${until}.`, Object.entries(hours).map(([w, h]) => `${w} ${h.toFixed(1)} h`).join(", "));
}

if (process.argv[1]?.endsWith("hours.ts")) main().catch((e) => { console.error(e); process.exit(1); });
