// The shared AI system (docs/ai/README.md), for any AI tool.
//   npm run check:ai                       CI: status file updated, no silent overlap with someone else's area or claim
//   npm run ai:brief [-- --me Julio] [--touch path ...] [--vault folder]
//                                          one page: rules, who's on what, claims, requests, open PRs, last 24 hours,
//                                          and warnings for the paths you're about to touch
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseStatus, activeClaims, covers, type AiStatus } from "../shared/aiStatus";

const root = path.resolve(import.meta.dirname, "..");
const REPO = "DilanDimel/Remy";
const read = (f: string) => (fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), "utf8") : "");

type Person = { name: string; login: string; status: string; role: string; lead?: boolean; owns: string[] };
const people: Person[] = JSON.parse(read("docs/ai/owners.json")).people;
const statusOf = (p: Person): AiStatus => parseStatus(read(p.status));

/** Who else's owned area or active claim covers `file`. */
function holders(file: string, except?: Person) {
  return people.filter((p) => p !== except).flatMap((p) => {
    const why = [
      ...p.owns.filter((o) => covers(o, file)).map(() => "owns it"),
      ...activeClaims(statusOf(p).claims).filter((c) => c.paths.some((c2) => covers(c2, file))).map((c) => `claimed until ${c.until} (branch ${c.branch || "?"})`),
    ];
    return why.length ? [{ person: p, why: why[0] }] : [];
  });
}

// ---------- check:ai ----------
function check() {
  const author = process.env.PR_AUTHOR || "";
  const body = process.env.PR_BODY || "";
  const base = process.env.BASE_SHA || "origin/main";
  if (!author) return console.log("check:ai: not a pull request, nothing to check.");
  const diff = (filter = "") => execFileSync("git", ["diff", "--name-only", ...(filter ? [filter] : []), `${base}...HEAD`], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const files = diff();
  const added = diff("--diff-filter=A");
  const me = people.find((p) => p.login.toLowerCase() === author.toLowerCase());
  const errors: string[] = [], warnings: string[] = [];

  if (!me) warnings.push(`${author} isn't in docs/ai/owners.json yet. Ask the lead to add you.`);
  const code = files.filter((f) => !f.startsWith("docs/") && !f.startsWith("shared/news/"));
  // The lead's many Claude threads coordinate inside Dilan's project, so lead.md isn't required on every PR (it would conflict).
  if (me && !me.lead && code.length && !files.includes(me.status))
    errors.push(`Update your status file ${me.status} in this PR (template: docs/ai/status/README.md).`);

  const coordinated = (name: string) => new RegExp(`Coordinated with:[^\\n]*\\b${name}\\b`, "i").test(body);
  const clash = new Map<string, string[]>();
  for (const f of files) for (const h of holders(f, me)) {
    if (f === h.person.status) continue; // touching someone's status file is caught by review, not here
    if (!coordinated(h.person.name)) clash.set(h.person.name, [...(clash.get(h.person.name) || []), `${f} (${h.person.name} ${h.why})`]);
  }
  for (const [name, list] of clash)
    errors.push(`This PR touches ${name}'s files:\n    ${list.join("\n    ")}\n  Talk to ${name} first, then add "Coordinated with: ${name}" to the PR description.`);

  if (me && files.includes(me.status)) {
    const limit = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
    for (const c of statusOf(me).claims) {
      if (!c.until || !c.branch) errors.push(`Claim ${c.paths.join(", ")} needs a branch and an "until YYYY-MM-DD" date.`);
      else if (c.until > limit) errors.push(`Claim ${c.paths.join(", ")} runs past ${limit}. Claims last at most 3 days; renew it when needed.`);
    }
  }

  const ui = files.filter((f) => f.startsWith("client/src/") && !f.endsWith(".test.ts"));
  if (ui.length && !files.some((f) => f.startsWith("shared/news/"))) {
    const id = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
    warnings.push(`No What's new note. If people will see this change, add shared/news/${id}.ts:\n    export default { kind: "Improved", title: "<what changed, in plain words>", body: "<one or two sentences>", owners: true } satisfies NewsNote;`);
  }
  const newUi = added.filter((f) => /^client\/src\/(pages|components)\/.+\.tsx$/.test(f));
  const gated = ui.some((f) => fs.existsSync(path.join(root, f)) && /useOwnerView|isOwner|redesign-2|useAccess|features/.test(read(f)));
  if (newUi.length && !gated) warnings.push(`New screens (${newUi.join(", ")}) and none of the changed files mention useOwnerView. New features stay owners-only until Dilan releases them.`);

  for (const w of warnings) console.log(`::warning::${w.replace(/\n/g, "%0A")}\n${w}\n`);
  for (const e of errors) console.log(`::error::${e.replace(/\n/g, "%0A")}\n${e}\n`);
  console.log(errors.length ? `check:ai: ${errors.length} problem(s).` : `check:ai: ok (${files.length} files).`);
  process.exit(errors.length ? 1 : 0);
}

// ---------- ai:brief ----------
// The repo is public, so no token is needed (60 requests an hour); a GITHUB_TOKEN raises that, and a bad one is skipped.
async function gh(url: string, token = process.env.GITHUB_TOKEN): Promise<any> {
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "remy-ai-brief" };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(`https://api.github.com/repos/${REPO}/${url}`, { headers });
  if (r.status === 401 && token) return gh(url, "");
  if (!r.ok) throw new Error(`GitHub ${r.status}`);
  return r.json();
}
const prFiles = async (n: number): Promise<string[]> => (await gh(`pulls/${n}/files?per_page=100`)).map((f: any) => f.filename);

async function brief(args: string[]) {
  const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const meName = opt("--me");
  const me = people.find((p) => p.name.toLowerCase() === meName?.toLowerCase());
  const touchAt = args.indexOf("--touch");
  const after = touchAt >= 0 ? args.slice(touchAt + 1) : [];
  const end = after.findIndex((a) => a.startsWith("--"));
  const touch = end < 0 ? after : after.slice(0, end);
  const out: string[] = [];
  const say = (s = "") => out.push(s);

  say(`# Remy briefing, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC${me ? ` (for ${me.name})` : ""}`);
  say("Rules: CLAUDE.md (build and code rules, every AI), docs/ai/CONTEXT.md (who owns what, now), docs/ai/DECISIONS.md (team decisions).");

  let open: any[] = [], merged: any[] = [], offline = "";
  try {
    open = await gh("pulls?state=open&per_page=50");
    for (const pr of open) pr.files = await prFiles(pr.number);
    const day = Date.now() - 86400_000;
    merged = (await gh("pulls?state=closed&sort=updated&direction=desc&per_page=40")).filter((p: any) => p.merged_at && +new Date(p.merged_at) > day);
    for (const pr of merged) pr.files = me ? await prFiles(pr.number) : []; // only needed for "touches your area"
  } catch (e) { offline = `Couldn't reach GitHub (${(e as Error).message}); open PRs and the last 24 hours are missing. Check them on github.com/${REPO}/pulls, or set GITHUB_TOKEN for a higher limit.`; }
  const who = (login: string) => people.find((p) => p.login.toLowerCase() === login.toLowerCase())?.name || login;
  const mine = (files: string[]) => (me ? files.filter((f) => holders(f).some((h) => h.person === me)) : []);

  // Early warning: before writing code, see who else is on the paths you're about to touch.
  const warn: string[] = [];
  const watch = [...touch, ...(me ? activeClaims(statusOf(me).claims).flatMap((c) => c.paths) : [])];
  for (const t of watch) {
    for (const h of holders(t, me)) warn.push(`${t}: ${h.person.name} ${h.why}.`);
    for (const pr of open) if (who(pr.user.login) !== me?.name && pr.files.some((f: string) => covers(t, f) || covers(f, t))) warn.push(`${t}: open PR #${pr.number} "${pr.title}" by ${who(pr.user.login)} touches it.`);
  }
  say("\n## Warnings");
  say(warn.length ? [...new Set(warn)].map((w) => `- ${w}`).join("\n") : touch.length || me ? "- None for the paths you named." : "- Run with --touch <paths> (or --me <name>) to check for overlap before you start.");

  const requests = people.flatMap((p) => statusOf(p).requests.map((r) => ({ from: p.name, ...r })));
  const forMe = me ? requests.filter((r) => r.to.toLowerCase() === me.name.toLowerCase()) : requests;
  say(`\n## ${me ? "Requests for you" : "Requests between AIs"}`);
  say(forMe.length ? forMe.map((r) => `- From ${r.from}${me ? "" : ` to ${r.to}`}: ${r.text}`).join("\n") : "- None.");

  say("\n## Last 24 hours (merged)");
  if (offline) say(`- ${offline}`);
  else say(merged.length ? merged.map((p) => { const m = mine(p.files); return `- #${p.number} ${p.title} (${who(p.user.login)})${m.length ? ` **touches your area: ${m.join(", ")}**` : ""}`; }).join("\n") : "- Nothing merged.");

  say("\n## Who's on what");
  for (const p of people) {
    const s = statusOf(p);
    say(`### ${p.name}: ${p.role}`);
    say(`Status updated ${s.updated || "never"}. Owns: ${p.owns.length ? p.owns.join(", ") : "everything not owned by someone else"}.`);
    for (const w of s.workingOn) say(`- ${w}`);
    for (const c of activeClaims(s.claims)) say(`- Claim: ${c.paths.join(", ")} (branch ${c.branch}, until ${c.until})`);
  }

  say("\n## Open PRs");
  if (offline) say(`- ${offline}`);
  else say(open.length ? open.map((p) => `- #${p.number} ${p.title} (${who(p.user.login)}, ${p.head.ref}): ${p.files.slice(0, 12).join(", ")}${p.files.length > 12 ? ` and ${p.files.length - 12} more` : ""}`).join("\n") : "- None.");

  say("\n---\n");
  say(read("docs/ai/CONTEXT.md"));
  say(read("docs/ai/DECISIONS.md"));

  const text = out.join("\n");
  const vault = opt("--vault");
  if (vault) {
    const dir = path.resolve(vault, "remy");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "BRIEF.md"), text);
    console.log(`Wrote ${path.join(dir, "BRIEF.md")}`);
  } else console.log(text);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "check") check();
else if (cmd === "brief") await brief(rest);
else if (cmd) { console.error("Use: tsx script/ai.ts check | brief"); process.exit(1); }
