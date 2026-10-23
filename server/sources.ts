import fs from "node:fs";
import path from "node:path";
import type { Job, Requirement, Workspace } from "@shared/types";
import { htmlToText } from "./parse";
import { uid } from "./db";
import { abroad, FIELD_SEARCH, FIELD_TITLES, regionMatch } from "./fit";

// Live openings from employers' own career sites (Greenhouse, Lever, Ashby, Workday).
// These are the boards companies use to publish their own careers pages, so each
// posting links straight back to the employer. No login, no scraping of
// third-party aggregators.

type Board = { ats: "greenhouse" | "lever" | "ashby" | "workday"; slug: string; company: string; fields?: string[] };

// Employers whose career sites Remy reads, with the fields they hire for (server/data/employers.json).
export const EMPLOYERS: Board[] = (JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "server", "data", "employers.json"), "utf8")).employers as { company: string; ats: Board["ats"]; board: string; fields: string[] }[])
  .map((e) => ({ ats: e.ats, slug: e.board, company: e.company, fields: e.fields }));

// Fallback when the directory can't be read is the original starting set.
export const DEFAULT_BOARDS: Board[] = EMPLOYERS.length ? EMPLOYERS : [
  { ats: "greenhouse", slug: "point72", company: "Point72" },
  { ats: "greenhouse", slug: "robinhood", company: "Robinhood" },
  { ats: "greenhouse", slug: "stripe", company: "Stripe" },
  { ats: "greenhouse", slug: "coinbase", company: "Coinbase" },
  { ats: "greenhouse", slug: "duolingo", company: "Duolingo" },
  { ats: "greenhouse", slug: "affirm", company: "Affirm" },
  { ats: "greenhouse", slug: "sofi", company: "SoFi" },
  { ats: "greenhouse", slug: "chime", company: "Chime" },
  { ats: "greenhouse", slug: "toast", company: "Toast" },
  { ats: "greenhouse", slug: "squarespace", company: "Squarespace" },
  { ats: "lever", slug: "palantir", company: "Palantir" },
  { ats: "lever", slug: "plaid", company: "Plaid" },
  { ats: "ashby", slug: "ramp", company: "Ramp" },
  { ats: "ashby", slug: "mercury", company: "Mercury" },
];

const EARLY = /\b(intern(ship)?s?|co-?op|new grad(uate)?|early career|entry[- ]level|campus|university|student|summer analyst|analyst program|rotational|apprentice|fellow(ship)?|insight|externship)\b/i;
const SENIOR = /\b(senior|sr\.?|staff|principal|lead|manager|director|head of|vp|vice president|ii|iii|iv)\b/i;
// Roles meant for graduate students, skipped for undergraduates.
const GRAD_LEVEL = /\b(graduate intern(ship)?|mba|ph\.?\s?d|doctoral|postdoc|post-doc|master'?s|graduate student|j\.?d\.?)\b/i;
const KEYWORDS = [
  "Excel", "PowerPoint", "Python", "SQL", "R ", "Tableau", "Power BI", "financial modeling", "valuation", "accounting", "data analysis", "analytics",
  "market research", "communication", "written communication", "presentation", "teamwork", "leadership", "problem solving", "attention to detail",
  "customer", "sales", "marketing", "social media", "content", "CRM", "Salesforce", "HubSpot", "project management", "research", "statistics",
  "economics", "finance", "computer science", "JavaScript", "Java", "machine learning", "operations", "consulting", "GPA",
];

function sentences(text: string) {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?•])\s+|\s+•\s+/).map((s) => s.trim()).filter((s) => s.length > 20 && s.length < 400);
}
/** 3–5 things the posting asks for, each with the exact sentence it came from. */
export function requirementsFrom(text: string): Requirement[] {
  const out: Requirement[] = [];
  const sents = sentences(text);
  for (const k of KEYWORDS) {
    if (out.length >= 5) break;
    const re = new RegExp(`\\b${k.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const s = sents.find((x) => re.test(x));
    if (s && !out.some((o) => o.keyword.toLowerCase() === k.trim().toLowerCase())) out.push({ id: uid("rq"), keyword: k.trim(), quote: s });
  }
  return out;
}
function eligibilityFrom(text: string) {
  return sentences(text).filter((s) => /graduat|class of|enrolled|sophomore|junior|senior|freshm|first-year|degree|work authori|sponsor|gpa/i.test(s)).slice(0, 4);
}
function kindOf(title: string): Job["kind"] {
  return /intern|co-?op|summer analyst|externship/i.test(title) ? "internship" : /program|fellow|insight|rotational/i.test(title) ? "program" : "job";
}

type Raw = { title: string; location: string; url: string; text: string; posted?: string; detail?: () => Promise<{ text: string; location?: string }> };
async function getJson(url: string): Promise<any> {
  const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "RemyBot/1.0 (student career assistant)" }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
// Workday's public career-site search (the same request the career page makes; approach from
// the open-source career-ops project, MIT). Board = "tenant|wdN|site".
const BROWSER_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
// Workday sites tag postings "Intern", "Student", "Early Careers"...; filtering on that beats keyword search,
// which matches loosely and sorts newest-first (so "finance intern" returns mostly senior roles).
const EARLY_FACET = /\bintern|student|early career|universit|campus|co-?op|new college grad/i;
const NOT_EARLY_FACET = /internal|non-intern|pharmacy|non-usa/i;
function earlyFacets(facets: any[], param = "", out: Record<string, string[]> = {}) {
  for (const f of facets || []) {
    const p = f.facetParameter || param;
    if (f.values) earlyFacets(f.values, p, out);
    else if (f.id && !/location/i.test(p) && EARLY_FACET.test(f.descriptor || "") && !NOT_EARLY_FACET.test(f.descriptor || "")) (out[p] ||= []).push(f.id);
  }
  return out;
}
async function workday(b: Board, field: string): Promise<Raw[]> {
  const [tenant, wd, site] = b.slug.split("|");
  const origin = `https://${tenant}.${wd}.myworkdayjobs.com`, cxs = `${origin}/wday/cxs/${tenant}/${site}`;
  const list = async (appliedFacets: Record<string, string[]>, searchText: string, offset: number) => {
    const r = await fetch(`${cxs}/jobs`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": BROWSER_UA }, body: JSON.stringify({ appliedFacets, limit: 20, offset, searchText }), signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  const facets = earlyFacets((await list({}, "", 0)).facets);
  // Only one facet group at a time: Workday ANDs groups, and the same postings are usually tagged in each.
  const [param] = Object.keys(facets).sort((a, z) => Number(/subtype/i.test(z)) - Number(/subtype/i.test(a)));
  const applied = param ? { [param]: facets[param] } : {};
  let query = param ? field : `${field} intern`.trim();
  const out: Raw[] = [];
  for (const offset of [0, 20]) {
    let page = (await list(applied, query, offset)).jobPostings || [];
    // Nothing for "finance" among this employer's internships: show its internships and let the title checks decide.
    if (!page.length && !offset && param && query) page = (await list(applied, (query = ""), 0)).jobPostings || [];
    for (const x of page) out.push({
      title: String(x.title || ""), location: String(x.locationsText || ""), url: `${origin}/${site}${x.externalPath}`, text: "", posted: x.postedOn,
      detail: async () => {
        const d = await (await fetch(`${cxs}${x.externalPath}`, { headers: { accept: "application/json", "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(5000) })).json();
        const info = d.jobPostingInfo || {};
        return { text: htmlToText(String(info.jobDescription || "")), location: [info.location, ...(info.additionalLocations || [])].filter(Boolean).join("; ") };
      },
    });
    if (page.length < 20) break;
  }
  return out;
}
async function fetchBoard(b: Board, field: string): Promise<Raw[]> {
  if (b.ats === "workday") return workday(b, field);
  if (b.ats === "greenhouse") {
    const j = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.slug)}/jobs?content=true`);
    return (j.jobs || []).map((x: any) => ({ title: String(x.title || ""), location: String(x.location?.name || ""), url: String(x.absolute_url || ""), text: htmlToText(decodeEntities(String(x.content || ""))), posted: x.updated_at }));
  }
  if (b.ats === "lever") {
    const j = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(b.slug)}?mode=json`);
    return (Array.isArray(j) ? j : []).map((x: any) => ({
      title: String(x.text || ""), location: [x.categories?.location, x.workplaceType === "remote" ? "Remote" : ""].filter(Boolean).join(" · "), url: String(x.hostedUrl || x.applyUrl || ""),
      text: [x.descriptionPlain, ...(x.lists || []).map((l: any) => `${l.text}: ${htmlToText(String(l.content || ""))}`), x.additionalPlain].filter(Boolean).join("\n"), posted: x.createdAt ? new Date(x.createdAt).toISOString() : undefined,
    }));
  }
  const j = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(b.slug)}`);
  return (j.jobs || []).map((x: any) => ({ title: String(x.title || ""), location: [x.location, x.isRemote ? "Remote" : ""].filter(Boolean).join(" · "), url: String(x.jobUrl || x.applyUrl || ""), text: String(x.descriptionPlain || htmlToText(String(x.descriptionHtml || ""))), posted: x.publishedAt }));
}
function decodeEntities(s: string) {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

/** Turns a company name into board guesses on all three ATSs. */
export function boardsFor(company: string): Board[] {
  const base = company.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  if (!base) return [];
  return (["greenhouse", "lever", "ashby"] as const).map((ats) => ({ ats, slug: base, company }));
}

/** Scans boards in parallel and returns early-career postings that suit the student. */
export async function discoverJobs(ws: Workspace, boards: Board[], limit = 25): Promise<{ jobs: Job[]; scanned: number; reached: string[] }> {
  const fields = (ws.profile.targetRoles + "," + ws.profile.major + "," + ws.profile.interests).toLowerCase().split(/[,;/]+/).map((x) => x.trim()).filter((x) => x.length > 2);
  const titleFits = FIELD_TITLES.filter(([field]) => field.test(fields.join(" "))).map(([, title]) => title);
  // Workday needs a search word; use the student's first field ("finance").
  const field = FIELD_SEARCH.find((_, k) => FIELD_TITLES[k][0].test(fields.join(" "))) || "";
  const undergrad = !/grad/i.test(ws.profile.classYear);
  const known = new Set([...ws.jobs.map((j) => j.applyUrl), ...ws.jobs.map((j) => j.sourceUrl)]);
  const reached: string[] = [];
  const found: { job: Job; rel: number }[] = [];
  let i = 0;
  const worker = async () => {
    while (i < boards.length) {
      const b = boards[i++];
      let raws: Raw[] = [];
      try { raws = await fetchBoard(b, field); } catch { continue; }
      if (!raws.length) continue;
      reached.push(b.company);
      let details = 0;
      for (const r of raws) {
        if (!r.url || known.has(r.url) || !EARLY.test(r.title) || (SENIOR.test(r.title) && !/intern|co-?op|new grad|student/i.test(r.title))) continue;
        if (undergrad && GRAD_LEVEL.test(r.title)) continue;
        if (titleFits.length && !titleFits.some((t) => t.test(r.title))) continue;
        // Skip places the student didn't ask for before spending a detail read on them.
        const where = (location: string) => { const m = regionMatch(ws, { location, format: /remote/i.test(location) ? "Remote" : "" } as Job); return m ?? !abroad(location); };
        if (!/^\d+ locations?$/i.test(r.location) && !where(r.location)) continue;
        // Workday lists only titles; read the full posting for the few that pass the title checks.
        if (r.detail && !r.text) {
          if (details++ >= 6) continue;
          try { const d = await r.detail(); r.text = d.text; if (d.location) r.location = d.location; } catch { continue; }
        }
        if (!where(r.location)) continue;
        const same = `${b.company}|${r.title}|${r.location}`.toLowerCase();
        if (known.has(same)) continue;
        known.add(same);
        const hay = `${r.title} ${r.text.slice(0, 3000)}`.toLowerCase();
        const rel = fields.filter((f) => hay.includes(f)).length;
        const job: Job = {
          id: uid("j"), kind: kindOf(r.title), title: r.title, company: b.company, location: r.location || "Not stated",
          format: /remote/i.test(r.location) ? "Remote" : "", dates: "", deadline: "", deadlineText: "Not stated on the board — check the posting",
          eligibility: eligibilityFrom(r.text), requirements: requirementsFrom(r.text), summary: r.text.replace(/\s+/g, " ").slice(0, 420),
          applyUrl: r.url, sourceUrl: r.url, sourceName: `${b.company} careers (${b.ats[0].toUpperCase() + b.ats.slice(1)} job board)`,
          label: "Live", checkedAt: new Date().toISOString(), checks: [], origin: "imported", postingText: r.text.slice(0, 12000),
        };
        known.add(r.url);
        found.push({ job, rel });
      }
    }
  };
  await Promise.all(Array.from({ length: 12 }, worker));
  // Most relevant to the student's fields first; keep a few from each company.
  found.sort((a, b) => b.rel - a.rel);
  const perCompany = new Map<string, number>();
  const jobs: Job[] = [];
  for (const f of found) {
    const n = perCompany.get(f.job.company) || 0;
    if (n >= 4 || jobs.length >= limit) continue;
    if (fields.length && f.rel === 0 && found.some((x) => x.rel > 0)) continue;
    perCompany.set(f.job.company, n + 1);
    jobs.push(f.job);
  }
  return { jobs, scanned: boards.length, reached };
}
