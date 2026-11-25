// What a job title or a major means in the government's occupation codes (2018 SOC, as O*NET uses them), so a posting
// can be matched to a student by occupation instead of by keyword lists. Title → SOC: about 50,000 O*NET titles,
// matched exactly first, then by shared words weighted by how rare they are. Major → SOC: the NCES CIP 2020 to SOC 2018
// crosswalk, the major matched to a program name the same way. No AI and no network: one file read at start-up.
// Data: O*NET 30.2 (U.S. Department of Labor, CC BY 4.0) and NCES CIP-SOC crosswalk (public domain); see server/data/SOURCES.md.
// Measured on 159 hand-labelled posting titles (Nov 25, 2026): exact code 62%, right major group 80%, right code in the top 10 91%.
import fs from "node:fs";
import path from "node:path";

type Data = { occupations: Record<string, string>; zones: Record<string, number>; titles: [string, string][]; cip: [string, string[]][] };
const DATA: Data = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "server", "data", "onet-titles.json"), "utf8"));

// Words that say a role's level or schedule, not what the job is ("Summer 2027 Finance Intern" is a finance job).
const LEVEL = /^(intern(ship)?s?|co-?ops?|program(me)?s?|summer|fall|spring|winter|seasonal|20\d\d|trainee|apprentice(ship)?|junior|jr|entry|level|new|grad(uate)?s?|recent|part|time|full|temporary|temp|i{1,3}|iv|1|2|3|university|undergrad(uate)?|early|careers?|opportunit(y|ies)|corporate|academy|campus|student|onsite|remote|hybrid|pool|m\/f\/d|us|usa|united|states|the|and|of|for|in|at|a|an|to|with|launch|working|position|role|team|bilingual|title)$/;
const SYN: Record<string, string> = {
  dev: "developer", eng: "engineer", engineering: "engineer", swe: "software engineer", sde: "software engineer", ml: "machine learning", ai: "artificial intelligence",
  hr: "human resources", it: "information technology", ux: "user experience", ui: "user interface", qa: "quality assurance", "fp&a": "financial planning analysis",
  pm: "project manager", bdr: "business development representative", sdr: "sales development representative", rn: "registered nurse", ehs: "environmental health safety",
  cyber: "cybersecurity", cybersecurity: "information security", accountant: "accounting", accounts: "accounting", auditor: "audit", auditing: "audit", marketer: "marketing",
  financial: "finance", analytics: "analyst", analysis: "analyst", analytic: "analyst", designer: "design", developer: "develop", development: "develop", researcher: "research",
  scientist: "science", sciences: "science", scientific: "science", teacher: "teach", teaching: "teach", tech: "technician", nursing: "nurse", legal: "law", lawyer: "law",
  attorney: "law", sales: "sale", selling: "sale", operations: "operation", manager: "manage", management: "manage", managing: "manage", backend: "software", frontend: "software",
  fullstack: "software", "full-stack": "software", assurance: "audit", recruitment: "recruiter", recruiting: "recruiter", sourcing: "purchasing", procurement: "purchasing",
  banking: "banker", comms: "communications", communication: "communications", journalism: "journalist", reporter: "journalist", sysadmin: "systems administrator", administration: "administrator",
};
const KEEP_S = new Set(["sales", "analysis", "physics", "economics", "logistics", "mathematics", "statistics", "graphics", "robotics", "electronics", "operations", "news", "aids"]);

export function words(s: string): string[] {
  const t = s.toLowerCase().replace(/&/g, " & ").replace(/fp ?& ?a/g, "fp&a").replace(/cyber[ -]security/g, "cybersecurity");
  const out: string[] = [];
  for (const raw of t.match(/[a-z][a-z0-9&+/'.-]*/g) || []) {
    const w = raw.replace(/^[.'\-/]+|[.'\-/]+$/g, "");
    if (!w || w === "&" || LEVEL.test(w)) continue;
    for (let x of (Object.hasOwn(SYN, w) ? SYN[w] : w).split(" ")) {
      if (x.length > 3 && x.endsWith("s") && !x.endsWith("ss") && !KEEP_S.has(x)) x = x.slice(0, -1);
      out.push(x);
    }
  }
  return [...new Set(out)];
}

type Index = { rows: { soc: string; w: string[] }[]; byWord: Map<string, number[]>; idf: Map<string, number>; exact: Map<string, Set<string>> };
function build(list: [string, string][]): Index {
  const rows: Index["rows"] = [], byWord = new Map<string, number[]>(), exact = new Map<string, Set<string>>();
  for (const [title, soc] of list) {
    const k = title.toLowerCase().trim();
    if (!exact.has(k)) exact.set(k, new Set());
    exact.get(k)!.add(soc);
    const w = words(title);
    if (!w.length) continue;
    for (const x of w) { if (!byWord.has(x)) byWord.set(x, []); byWord.get(x)!.push(rows.length); }
    rows.push({ soc, w });
  }
  const idf = new Map([...byWord].map(([x, ids]) => [x, Math.log(rows.length / ids.length)]));
  return { rows, byWord, idf, exact };
}
let titleIndex: Index | null = null;
const titles = () => (titleIndex ||= build(DATA.titles));

// Parts of a posting title that name a place, not the job ("Analyst - Dallas, TX").
const PLACE = /\b(remote|onsite|on-site|hybrid)\b|,\s*[A-Z]{2}\b/i;
function segments(title: string) {
  const t = title.replace(/\([^)]*\)|\[[^\]]*\]/g, "  ");
  const parts = t.split(/\s[-–—|:]\s|[–—|:]|,\s|\s-(?=\S)|(?<=\S)-\s/).map((p) => p.trim()).filter(Boolean);
  const kept = parts.filter((p) => !PLACE.test(p) || p.split(/\s+/).length > 3);
  return kept.length ? kept : [t];
}

function score(ix: Index, text: string, bySegment = true) {
  const best = new Map<string, number>();
  for (const seg of bySegment ? segments(text) : [text]) {
    const q = words(seg).filter((x) => ix.idf.has(x));
    if (!q.length) continue;
    const qw = q.reduce((n, x) => n + ix.idf.get(x)!, 0);
    const head = q[q.length - 1];
    const seen = new Set<number>();
    for (const x of q) for (const i of ix.byWord.get(x)!) seen.add(i);
    for (const i of seen) {
      const { soc, w } = ix.rows[i];
      const shared = q.reduce((n, x) => n + (w.includes(x) ? ix.idf.get(x)! : 0), 0);
      const own = w.reduce((n, x) => n + (ix.idf.get(x) || 0), 0);
      const s = (2 * shared) / (qw + own) + (w.includes(head) ? 0.15 : 0);
      if (s > (best.get(soc) ?? -Infinity)) best.set(soc, s);
    }
  }
  return best;
}

export type SocMatch = { soc: string; title: string; score: number };
/** The likeliest occupations for a job title, best first (up to 10). Empty when no word of it is known. */
export function matchTitle(title: string): { soc: string; title: string; score: number; candidates: SocMatch[] } | null {
  if (!words(title).length) return null; // "Intern" alone says nothing about the job
  const ix = titles();
  const named = (soc: string, s: number): SocMatch => ({ soc, title: DATA.occupations[soc] || soc, score: Math.round(s * 1000) / 1000 });
  const hit = ix.exact.get(title.toLowerCase().trim());
  let list: SocMatch[];
  if (hit) list = [...hit].sort().map((soc) => named(soc, 1));
  else {
    const best = score(ix, title);
    const teaching = /teach|professor|instructor|lecturer|faculty/i.test(title);
    for (const [soc, s] of best) {
      let v = s;
      if (soc.startsWith("25-1") && !teaching) v -= 0.3; // postsecondary teachers, unless the title says so
      if (soc.slice(3, 7).endsWith("99")) v -= 0.04; // "all other" catch-alls lose ties
      if (soc.startsWith("55-")) v -= 0.3; // military
      best.set(soc, v);
    }
    list = [...best].sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0])).slice(0, 10).map(([soc, s]) => named(soc, s));
  }
  return list.length ? { ...list[0], candidates: list } : null;
}

/** O*NET Job Zone (1 = little preparation … 5 = extensive), or null when O*NET has none for the code. */
export const jobZone = (soc: string): number | null => DATA.zones[soc.slice(0, 7)] ?? null;

let cipIndex: Index | null = null;
/** The occupations a major leads to, from the CIP to SOC crosswalk: the program names the major matches best (ties
 *  included), all their occupations. Empty when nothing matches. */
export function majorSocs(major: string): string[] {
  const ix = (cipIndex ||= build(DATA.cip.map(([name], i) => [name, String(i)])));
  const exact = ix.exact.get(major.toLowerCase().trim());
  let picks: string[];
  if (exact) picks = [...exact];
  else {
    const best = [...score(ix, major, false)].sort((a, z) => z[1] - a[1]);
    if (!best.length || best[0][1] < 0.5) return [];
    picks = best.filter(([, s]) => s >= best[0][1] - 0.02).map(([k]) => k);
  }
  return [...new Set(picks.flatMap((k) => DATA.cip[Number(k)][1]))].sort();
}
