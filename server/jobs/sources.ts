import fs from "node:fs";
import path from "node:path";
import type { Job, Requirement, Workspace } from "@shared/types";
import { htmlToText } from "../resume/parse";
import { postingLines } from "@shared/postingText";
import { topSkills } from "@shared/requirements";
import { uid } from "../platform/ids";
import { abroad, COUNTRY_IN_TEXT, FIELD_SEARCH, FIELD_TITLES, regionMatch, chosenFieldText, relocateReason } from "./fit";
import { q, q1 } from "../platform/sql";
import { interestEnabled, preferenceAdjustment } from "./ranking";

// Live openings from employers' own career sites (Greenhouse, Lever, Ashby, Workday, SmartRecruiters,
// Oracle Cloud, Eightfold, Phenom and AppliTrack school-district boards).
// These are the boards companies use to publish their own careers pages, so each
// posting links straight back to the employer. No login, no scraping of
// third-party aggregators.

type Board = { ats: "greenhouse" | "lever" | "ashby" | "workday" | "smartrecruiters" | "oracle" | "eightfold" | "phenom" | "usajobs" | "applitrack" | "schoolspring" | "taleo" | "careeronestop"; slug: string; company: string; fields?: string[]; metros?: Metro[]; preview?: boolean };

// Employers whose career sites Remy reads, with the fields they hire for (server/data/employers.json).
export const EMPLOYERS: Board[] = (JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "server", "data", "employers.json"), "utf8")).employers as { company: string; ats: Board["ats"]; board: string; fields: string[]; metros?: Metro[]; preview?: boolean }[])
  .map((e) => ({ ats: e.ats, slug: e.board, company: e.company, fields: e.fields, metros: e.metros, preview: e.preview }));

// Texas metros an employer can be tagged with (employers.json "metros"). Austin and Houston were empty for every field
// on Nov 21, 2026: all of Remy's school districts were in DFW and nothing preferred an employer in the student's city.
export type Metro = "dfw" | "austin" | "houston";
const METRO_WORDS: [Metro, RegExp][] = [
  ["dfw", /\b(dallas|fort worth|ft\.? worth|dfw|arlington|plano|irving|frisco|denton|garland|mckinney|richardson|carrollton|lewisville|mesquite|grand prairie|keller|grapevine|southlake)\b/gi],
  ["austin", /\b(austin|round rock|san marcos|cedar park|pflugerville|leander)\b/gi],
  ["houston", /\b(houston|katy|sugar land|the woodlands|pasadena|pearland|league city|humble|galveston|baytown)\b/gi],
];
// A town name followed by another state ("Arlington, VA", "Pasadena, CA", "Austin, MN") isn't the Texas one.
const OTHER_STATE = /^\s*,?\s*(?!tx\b|texas\b)(a[klrz]|c[aot]|d[ce]|fl|ga|hi|i[adln]|k[sy]|la|m[adeinost]|n[cdehjmvy]|o[hkr]|pa|ri|s[cd]|tn|ut|v[at]|w[aivy]|alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new \w+|north \w+|ohio|oklahoma|oregon|pennsylvania|rhode island|south \w+|tennessee|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i;
/** The Texas metros a student's places name. "Anywhere in Texas" means all three. */
export function metrosIn(places: string): Metro[] {
  if (/\banywhere in (texas|tx)\b|\ball of texas\b/i.test(places)) return ["dfw", "austin", "houston"];
  return METRO_WORDS.filter(([, re]) => [...places.matchAll(re)].some((m) => !OTHER_STATE.test(places.slice((m.index || 0) + m[0].length)))).map(([m]) => m);
}
/** Employers in the student's metros first, then ones with no metro (national), then other metros' (a DFW student's
 *  15 reads shouldn't go to Austin school districts). Order within each group is kept. No metro named, or all three
 *  ("Anywhere in Texas", so national employers aren't crowded out): unchanged. Employers the student liked stay first
 *  and ones they keep hiding or marked "Not for me" stay last, as orderEmployers put them (skeptic review). */
export function preferMetros<T extends { metros?: Metro[] }>(list: T[], places: string, pinned: (e: T) => boolean = () => false, demoted: (e: T) => boolean = () => false): T[] {
  const mine = metrosIn(places);
  const rank = (e: T) => (pinned(e) ? -1 : demoted(e) ? 3 : !mine.length || mine.length === 3 || !e.metros?.length ? 1 : e.metros.some((m) => mine.includes(m)) ? 0 : 2);
  return list.map((e, i) => ({ e, i, r: rank(e) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.e);
}


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

const EARLY = /\b(junior|trainee|(?:teaching|research|marketing|legal|administrative) assistant|intern(ship)?s?|co-?op|new grad(uate)?|early career|entry[- ]level|campus|university|student|summer analyst|analyst program|rotational|apprentice|fellow(ship)?|insight|cadets?|recruits?|extern(ship)?s?|nurse residen\w*|graduate nurse|nurse intern|new grad rn|freshm[ae]n|sophomores?|first[- ]year|discover\w*|explore|launch|ambassadors?|leadership program|diversity program|pathways|recent graduate|trainee)\b/i;
const SENIOR = /\b(senior|sr\.?|staff|principal|lead|manager|director|head of|vp|vice president|professor|ii|iii|iv)\b/i;
// What the job itself involves: a posting's sentences minus benefits, "about us", equal-opportunity and
// "any major" lines, which mention fields without being about the work (from Julio's relevance design).
const NOT_DUTIES = /benefit|insurance|wellness|discount|equal opportunity|protected by law|about us|our (company|platform|mission)|any major|qualifications:|we provide|perks/i;
export const duties = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).filter((x) => !NOT_DUTIES.test(x)).join(" ");
// Roles meant for graduate students, skipped for undergraduates.
const GRAD_LEVEL = /\b(graduate intern(ship)?|intern,?\s*graduate|mba|ph\.?\s?d|doctoral|postdoc|post-doc|master'?s|graduate student|j\.?d\.?|law student|law clerk|medical student|residency program|school psycholog\w*|diagnostician|licensed specialist)\b/i;


function sentences(text: string) {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?•])\s+|\s+•\s+/).map((s) => s.trim()).filter((s) => s.length > 20 && s.length < 400);
}
/** 3–5 things the posting asks for, each with the exact sentence it came from. */
export function requirementsFrom(text: string): Requirement[] {
  const out: Requirement[] = [];
  const sents = sentences(text);
  // The 5 most specific skills the posting names, across fields (tools before broad words like "operations").
  for (const r of topSkills(sents, 5)) out.push({ id: uid("rq"), ...r });
  return out;
}
function eligibilityFrom(text: string) {
  return sentences(text).filter((s) => /graduat|class of|enrolled|sophomore|junior|senior|freshm|first-year|degree|work authori|sponsor|gpa/i.test(s)).slice(0, 4);
}
/** Internship, early-career program or job, from the title. A program is a named student/early-career program,
 *  not a job whose title merely contains "program" or "launch" ("Program Manager", "Launch Engineer", "Resident Engineer"). */
export function kindOf(title: string): Job["kind"] {
  if (/intern|extern|co-?op|summer analyst/i.test(title)) return "internship";
  const program = /\b(program|programme)\b(?!\s*(manager|management|coordinator|analyst|specialist|director|assistant|officer|lead|administrator|associate|engineer))|fellowship|\bfellows?\b(?!\s*engineer)|insight (day|week|program|series)|discovery (day|program|days)|\blaunch program\b|emerging leaders|summit|early id|rotational|residency/i;
  return program.test(title) ? "program" : "job";
}

// Boards that list titles only keep where the full posting is (`more`), as plain data: the shared board cache stores
// raws as JSON, so a `detail` function never survived it and every student after the first got postings with no text.
type More = { kind: "workday" | "smartrecruiters" | "oracle" | "eightfold" | "phenom" | "schoolspring" | "taleo"; url: string; seq?: string; teaser?: string };
type Raw = { title: string; location: string; url: string; text: string; posted?: string; company?: string; deadline?: string; student?: boolean; nearby?: boolean; more?: More; detail?: () => Promise<{ text: string; location?: string }> };
/** Reads the full posting a title-only board points to. */
async function readMore(m: More): Promise<{ text: string; location?: string }> {
  switch (m.kind) {
    case "workday": {
      const d = await (await fetch(m.url, { headers: { accept: "application/json", "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(5000) })).json();
      const info = d.jobPostingInfo || {};
      return { text: htmlToText(String(info.jobDescription || "")), location: [info.location, ...(info.additionalLocations || [])].filter(Boolean).join("; ") };
    }
    case "smartrecruiters": {
      const sec = (await getJson(m.url)).jobAd?.sections || {};
      return { text: htmlToText([sec.jobDescription?.text, sec.qualifications?.text, sec.additionalInformation?.text].filter(Boolean).join("\n")), location: "" };
    }
    case "oracle": {
      const it = (await getJson(m.url)).items?.[0] || {};
      return { text: htmlToText([it.ExternalDescriptionStr, it.ExternalQualificationsStr, it.ExternalResponsibilitiesStr].filter(Boolean).join("\n")), location: "" };
    }
    case "eightfold":
      return { text: htmlToText(String((await getJson(m.url)).job_description || "")), location: "" };
    case "phenom": {
      const r = await fetch(m.url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": BROWSER_UA }, body: JSON.stringify({ lang: "en_us", deviceType: "desktop", country: "us", global: true, pageName: "job", ddoKey: "jobDetail", jobSeqNo: m.seq }), signal: AbortSignal.timeout(6000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return { text: htmlToText(String((await r.json()).jobDetail?.data?.job?.description || m.teaser || "")), location: "" };
    }
    case "schoolspring": {
      const d = (await getJson(m.url)).value?.jobInfo || {};
      const pay = d.payMin && d.payMax ? `Pay: $${d.payMin}–$${d.payMax} ${d.salaryCode || ""}` : "";
      return { text: [htmlToText(String(d.jobDescription || "")), d.requirements && d.requirements !== "None" ? htmlToText(String(d.requirements)) : "", pay, d.shiftType ? `Schedule: ${d.shiftType}` : ""].filter(Boolean).join("\n") };
    }
    case "taleo":
      return { text: taleoDescription(await (await fetch(m.url, { headers: { "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(8000) })).text()) };
  }
}
/** Gives every title-only posting its reader back (fresh from the board or from the cache). */
export const withDetail = (raws: Raw[]): Raw[] => raws.map((r) => (r.more && !r.text ? { ...r, detail: () => readMore(r.more!) } : r));
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
    const r = await fetch(`${cxs}/jobs`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": BROWSER_UA }, body: JSON.stringify({ appliedFacets, limit: 20, offset, searchText }), signal: AbortSignal.timeout(12_000) }); // big Workday sites often take 5–9s
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
      more: { kind: "workday", url: `${cxs}${x.externalPath}` },
    });
    if (page.length < 20) break;
  }
  return out;
}
// Search words for boards that need one: hospitals post "Nurse Residency" and "Extern", not "Intern".
const queries = (field: string) => (field === "nursing" ? ["nurse residency", "extern", "graduate nurse"] : ["intern"]);
async function each(field: string, read: (q: string) => Promise<Raw[]>): Promise<Raw[]> {
  return eachQuery(queries(field), read);
}
// SmartRecruiters' public postings API. Board = company identifier (e.g. "Colliers").
async function smartrecruiters(b: Board, field: string): Promise<Raw[]> {
  return each(field, (q) => smartrecruitersQ(b, q));
}
async function smartrecruitersQ(b: Board, q: string): Promise<Raw[]> {
  const j = await getJson(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(b.slug)}/postings?limit=100&q=${encodeURIComponent(q)}`);
  return (j.content || []).map((x: any) => ({
    title: String(x.name || ""), location: [x.location?.city, x.location?.region, x.location?.remote ? "Remote" : ""].filter(Boolean).join(", "),
    url: `https://jobs.smartrecruiters.com/${encodeURIComponent(b.slug)}/${x.id}`, text: "", posted: x.releasedDate,
    more: { kind: "smartrecruiters", url: String(x.ref) },
  }));
}
// Oracle Cloud Recruiting's public candidate API (the requests its career site makes). Board = "host|siteNumber".
async function oracle(b: Board, field: string): Promise<Raw[]> {
  return each(field, (q) => oracleQ(b, q));
}
async function oracleQ(b: Board, q: string): Promise<Raw[]> {
  const [host, site] = b.slug.split("|");
  const api = `https://${host}/hcmRestApi/resources/latest`;
  const j = await getJson(`${api}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=${encodeURIComponent(site)},limit=50,keyword=${encodeURIComponent(q)},sortBy=POSTING_DATES_DESC`);
  return (j.items?.[0]?.requisitionList || []).map((x: any) => ({
    title: String(x.Title || ""), location: [x.PrimaryLocation, ...(x.secondaryLocations || []).map((l: any) => l.Name)].filter(Boolean).join("; "),
    url: `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${x.Id}`, text: "", posted: x.PostedDate,
    more: { kind: "oracle", url: `${api}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${x.Id}%22,siteNumber=${encodeURIComponent(site)}` },
  }));
}
// Eightfold career sites' public search API. Board = "<company>.eightfold.ai".
async function eightfold(b: Board, field: string): Promise<Raw[]> {
  return each(field, (q) => eightfoldQ(b, q));
}
async function eightfoldQ(b: Board, q: string): Promise<Raw[]> {
  const domain = `${b.slug.split(".")[0]}.com`;
  const j = await getJson(`https://${b.slug}/api/apply/v2/jobs?domain=${domain}&query=${encodeURIComponent(q)}&num=50`);
  return (j.positions || []).map((x: any) => ({
    title: String(x.name || ""), location: String(x.location || (x.locations || []).join("; ") || ""),
    url: String(x.canonicalPositionUrl || `https://${b.slug}/careers/job/${x.id}`), text: "", posted: x.t_create ? new Date(x.t_create * 1000).toISOString() : undefined,
    more: { kind: "eightfold", url: `https://${b.slug}/api/apply/v2/jobs/${x.id}?domain=${domain}` },
  }));
}
// Phenom career sites' search widget (the request their own search page makes). Board = the career site host.
async function phenom(b: Board, field: string): Promise<Raw[]> {
  const widgets = (body: object) => fetch(`https://${b.slug}/widgets`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": BROWSER_UA }, body: JSON.stringify({ lang: "en_us", deviceType: "desktop", country: "us", global: true, ...body }), signal: AbortSignal.timeout(6000) })
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
  return each(field, async (q) => {
    const j = await widgets({ pageName: "search-results", ddoKey: "refineSearch", from: 0, jobs: true, counts: false, size: 50, keywords: q, selected_fields: {} });
    return (j.refineSearch?.data?.jobs || []).map((x: any) => ({
      title: String(x.title || ""), location: String(x.location || x.cityStateCountry || ""), url: `https://${b.slug}/us/en/job/${encodeURIComponent(x.jobId)}`, text: "", posted: x.postedDate,
      more: { kind: "phenom", url: `https://${b.slug}/widgets`, seq: String(x.jobSeqNo || ""), teaser: String(x.descriptionTeaser || "") },
    }));
  });
}
// USAJOBS, the federal government's official job API (free key; USAJOBS_KEY + USAJOBS_EMAIL). Searches
// student and recent-graduate roles (Pathways) near the student's region, plus remote ones.
export const USAJOBS: Board = { ats: "usajobs", slug: "usajobs", company: "U.S. federal government", fields: [] };
async function usajobs(field: string, region: string): Promise<Raw[]> {
  const key = process.env.USAJOBS_KEY, email = process.env.USAJOBS_EMAIL;
  if (!key || !email) return [];
  const where = /dallas|fort worth|dfw/i.test(region) ? "Dallas, Texas" : region.split(/[;/]/)[0].trim();
  const search = async (extra: string) => {
    // No keyword: there are few federal student roles in any one area, and Remy's own title checks pick the student's field.
    const r = await fetch(`https://data.usajobs.gov/api/search?HiringPath=student;graduates&ResultsPerPage=250${extra}`, { headers: { Host: "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return ((await r.json()).SearchResult?.SearchResultItems || []).map((i: any) => i.MatchedObjectDescriptor);
  };
  const lists = await Promise.all([where ? search(`&LocationName=${encodeURIComponent(where)}&Radius=60`) : Promise.resolve([]), search("&RemoteIndicator=True")].map((p) => p.catch(() => [] as any[])));
  const seen = new Set<string>();
  return lists.flat().filter((x: any) => x?.PositionURI && !seen.has(x.PositionURI) && seen.add(x.PositionURI)).map((x: any) => ({
    // Every result is a student or recent-graduate role, found near the student or remote.
    student: true, nearby: true,
    title: String(x.PositionTitle || ""), company: String(x.OrganizationName || x.DepartmentName || "U.S. federal government"),
    location: String(x.PositionLocationDisplay || ""), url: String(x.PositionURI), posted: x.PublicationStartDate, deadline: String(x.ApplicationCloseDate || "").slice(0, 10),
    text: [x.UserArea?.Details?.JobSummary, x.QualificationSummary, x.UserArea?.Details?.Education, x.UserArea?.Details?.Requirements].filter(Boolean).join("\n"),
  }));
}
// Frontline AppliTrack, the job board many Texas school districts use. Board = "district|City, ST".
// The listing is one page of every opening; only the roles a college student can hold are kept.
const SCHOOL_STUDENT = /\b(tutors?|student (worker|observer)s?|interns?(hip)?|summer|lifeguards?|water safety|after[- ]?school|substitute teachers?|guest teachers?|camp)\b/i;
// Districts also post internships for their own high schoolers.
const HIGH_SCHOOLER = /\b(for )?high school students?\b|\bhs students?\b/i;
const collegeRole = (title: string) => SCHOOL_STUDENT.test(title) && !HIGH_SCHOOLER.test(title);
export function applitrackPostings(js: string, slug: string, city: string): Raw[] {
  const html = js.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return html.split("<ul class='postingsList' id='p").slice(1).flatMap((chunk) => {
    const id = chunk.match(/^(\d+)_/)?.[1];
    // Districts prefix titles with pool codes ("35770* ", "Generic - ").
    const title = htmlToText(chunk.match(/id='wrapword'[^>]*>([\s\S]*?)<\/td>/)?.[1] || "").trim().replace(/^(\d+\*?\s+|generic\s*-\s*)+/i, "");
    if (!id || !collegeRole(title)) return [];
    const field = (label: string) => htmlToText(chunk.match(new RegExp(`${label}\\s*:\\s*</span><br/>(?:&nbsp;)*<span class=["']normal["']>([^<]*)`))?.[1] || "").trim();
    const [m, d, y] = field("Closing Date").split("/");
    return [{
      student: true, title, location: [field("Location"), city].filter(Boolean).join(", "),
      url: `https://www.applitrack.com/${slug}/onlineapp/default.aspx?AppliTrackJobId=${id}&AppliTrackLayoutMode=detail&AppliTrackViewPosting=1`,
      text: htmlToText(chunk.replace(/^\d+_'>/, "")), posted: field("Date Posted"), deadline: y ? `${y.slice(0, 4)}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : "",
    }];
  });
}
async function applitrack(b: Board): Promise<Raw[]> {
  const [slug, city] = b.slug.split("|");
  const r = await fetch(`https://www.applitrack.com/${encodeURIComponent(slug)}/onlineapp/jobpostings/Output.asp?all=1`, { headers: { "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return applitrackPostings(new TextDecoder("windows-1252").decode(await r.arrayBuffer()), slug, city || "");
}
// School-district search words: student roles are rare, so search for them instead of paging every opening.
const SCHOOL_QUERIES = ["tutor", "intern", "student", "substitute", "summer", "lifeguard", "after school"];
/** Runs each search; one failed search is skipped, but if every one fails the site is down (not "no openings"). */
async function eachQuery(queries: string[], read: (q: string) => Promise<Raw[]>): Promise<Raw[]> {
  const seen = new Set<string>();
  const res = await Promise.allSettled(queries.map(read));
  if (res.every((r) => r.status === "rejected")) throw (res[0] as PromiseRejectedResult).reason;
  return res.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((r) => !seen.has(r.url) && seen.add(r.url));
}
// SchoolSpring (PowerSchool), used by districts such as Irving and Keller ISD: its public JSON API.
// Board = the district's SchoolSpring host ("irvingisd.schoolspring.com").
async function schoolspring(b: Board): Promise<Raw[]> {
  const raws = await eachQuery(SCHOOL_QUERIES, async (q) => {
    const qs = new URLSearchParams({ domainName: b.slug, keyword: q, location: "", category: "", gradelevel: "", jobtype: "", organization: "", swLat: "", swLon: "", neLat: "", neLon: "", page: "1", size: "50", sortDateAscending: "false" });
    const j = await getJson(`https://api.schoolspring.com/api/Jobs/GetPagedJobsWithSearch?${qs}`);
    return (j.value?.jobsList || []).map((x: any): Raw => ({
      student: true, title: decodeEntities(String(x.title || "")), location: [decodeEntities(String(x.employer || "")), String(x.location || "")].filter(Boolean).join(", "),
      url: `https://${b.slug}/?jobid=${x.jobId}`, text: "", posted: x.displayDate,
      more: { kind: "schoolspring", url: `https://api.schoolspring.com/api/Jobs/${encodeURIComponent(x.jobId)}` },
    }));
  });
  return raws.filter((r) => collegeRole(r.title));
}
// Oracle Taleo career sections (Dallas ISD): the anonymous search request the career page makes.
// Board = "host|section|City, ST". The portal id is read from the career page each time, since it can change.
export function taleoDescription(html: string): string {
  const v = html.match(/id="initialHistory" value="([^"]*)"/)?.[1] || "";
  // The page state is "!|!"-separated, URL-encoded; the long pieces are the description and requirements.
  const parts = v.split("!|!").map((s) => { try { return decodeURIComponent(s); } catch { return s; } }).map((s) => s.replace(/\\/g, "").replace(/^!\*!/, ""));
  return [...new Set(parts.filter((s) => s.length > 200))].map((s) => htmlToText(decodeEntities(s))).join("\n").slice(0, 12000);
}
async function taleo(b: Board): Promise<Raw[]> {
  const [host, section, city] = b.slug.split("|");
  const page = await (await fetch(`https://${host}/careersection/${section}/jobsearch.ftl`, { headers: { "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(8000) })).text();
  const portal = page.match(/[?&]portal=(\d+)/)?.[1];
  if (!portal) throw new Error("no public portal");
  const raws = await eachQuery(SCHOOL_QUERIES, async (q) => {
    const r = await fetch(`https://${host}/careersection/rest/jobboard/searchjobs?lang=en&portal=${portal}`, {
      method: "POST", headers: { "content-type": "application/json", tz: "GMT-06:00", "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ multilineEnabled: false, sortingSelection: { sortBySelectionParam: "3", ascendingSortingOrder: "false" }, fieldData: { fields: { KEYWORD: q, LOCATION: "" }, valid: true }, filterSelectionParam: { searchFilterSelections: [] }, advancedSearchFiltersSelectionParam: { searchFilterSelections: [] }, pageNo: 1 }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return ((await r.json()).requisitionList || []).map((x: any): Raw => {
      const [title, loc] = (x.column || []).map(String);
      let where = loc || "";
      try { where = (JSON.parse(loc) as string[]).join("; "); } catch {}
      const url = `https://${host}/careersection/${section}/jobdetail.ftl?job=${encodeURIComponent(x.contestNo || x.jobId)}&lang=en`;
      return {
        student: true, title: title || "", location: [where, city].filter(Boolean).join(", "), url, text: "",
        more: { kind: "taleo", url },
      };
    });
  });
  return raws.filter((r) => collegeRole(r.title));
}
// CareerOneStop (U.S. Department of Labor), whose job search draws on the National Labor Exchange: city,
// county, state and school jobs that aren't on the boards above. Free key: COS_USER_ID + COS_TOKEN.
export const CAREERONESTOP: Board = { ats: "careeronestop", slug: "careeronestop", company: "CareerOneStop (U.S. Dept. of Labor)", fields: [] };
async function careeronestop(field: string, region: string): Promise<Raw[]> {
  const user = process.env.COS_USER_ID, token = process.env.COS_TOKEN;
  if (!user || !token) return [];
  const where = /dallas|fort worth|dfw/i.test(region) ? "Dallas, TX" : region.split(/[;/]/)[0].trim() || "US";
  const search = async (keyword: string) => {
    // Path: keyword / location / radius / sort column / sort order / start row / page size / days back.
    const r = await fetch(`https://api.careeronestop.org/v1/jobsearch/${encodeURIComponent(user)}/${encodeURIComponent(keyword)}/${encodeURIComponent(where)}/50/0/0/0/100/30`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return ((await r.json()).Jobs || []).map((x: any): Raw => ({
      nearby: where !== "US", title: String(x.JobTitle || ""), company: String(x.Company || ""), location: String(x.Location || ""),
      url: String(x.URL || ""), text: String(x.DescriptionSnippet || ""), posted: x.AcquisitionDate,
    }));
  };
  return eachQuery([field ? `${field} intern` : "intern", "student", "trainee"], search);
}
export async function fetchBoard(b: Board, field: string, region = ""): Promise<Raw[]> {
  if (b.ats === "schoolspring") return schoolspring(b);
  if (b.ats === "taleo") return taleo(b);
  if (b.ats === "careeronestop") return careeronestop(field, region);
  if (b.ats === "usajobs") return usajobs(field, region);
  if (b.ats === "applitrack") return applitrack(b);
  if (b.ats === "phenom") return phenom(b, field);
  if (b.ats === "workday") return workday(b, field);
  if (b.ats === "smartrecruiters") return smartrecruiters(b, field);
  if (b.ats === "oracle") return oracle(b, field);
  if (b.ats === "eightfold") return eightfold(b, field);
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

// Shared catalog: one employer site's results serve every student for BOARD_FRESH. If the site fails, the last good
// copy (up to BOARD_STALE old) is used instead, because a failed read never means "no openings".
const BOARD_FRESH = 6 * 60 * 60_000;
// Only student-level postings' text is ever read (discoverJobs skips the rest by title first), so the cache keeps the
// text of those alone, capped above the 12,000 characters an opening keeps. Every posting's title, place and link stay,
// so counts (the openings scout) don't change. A whole board of senior roles used to be stored word for word.
const CACHE_TEXT_MAX = 20_000;
export const slimForCache = (raws: Raw[]): Raw[] =>
  raws.map((r) => ({ ...r, text: r.student || EARLY.test(r.title) ? (r.text || "").slice(0, CACHE_TEXT_MAX) : "" }));
const BOARD_STALE = 3 * 24 * 60 * 60_000;
// Each board's cached postings can be a few hundred KB to 3 MB, and Supabase bills every byte read as data transfer.
// The background search reads the same boards for every student, so the server keeps the last copy of each entry and
// downloads it again only when its fetched_at changed (a newer fetch, here or on another server).
const boardMemo = new Map<string, { at: string; fetched_at: Date; raws: any }>();
const BOARD_MEMO_MAX = 300;
/** A board_cache entry (raws and fetched_at), downloading raws only when this server's copy is out of date. */
export async function readBoardCache(key: string): Promise<{ raws: any; fetched_at: Date } | undefined> {
  const memo = boardMemo.get(key);
  const r = await q1("SELECT fetched_at, fetched_at::text AS at, CASE WHEN fetched_at::text = $2 THEN NULL ELSE raws END AS raws FROM board_cache WHERE key = $1", [key, memo?.at || ""]);
  if (!r) { boardMemo.delete(key); return undefined; }
  // A copy each time: callers may change what they get, and the kept copy must stay as stored.
  if (memo && r.at === memo.at) return { raws: structuredClone(memo.raws), fetched_at: memo.fetched_at };
  const raws = typeof r.raws === "string" ? JSON.parse(r.raws) : r.raws;
  const fetched_at = new Date(r.fetched_at);
  boardMemo.delete(key);
  boardMemo.set(key, { at: r.at, fetched_at, raws: structuredClone(raws) });
  if (boardMemo.size > BOARD_MEMO_MAX) boardMemo.delete(boardMemo.keys().next().value!);
  return { raws, fetched_at };
}
export async function cachedBoard(b: Board, field: string, region: string, fetch = fetchBoard): Promise<Raw[]> {
  // Sources that search by field or place get one entry per search; whole-board sources get one entry.
  // "v2" on title-only boards: entries saved before postings kept their reader (`more`) would stay textless for hours.
  const TITLE_ONLY = ["workday", "smartrecruiters", "oracle", "eightfold", "phenom", "schoolspring", "taleo"];
  const key = [...(TITLE_ONLY.includes(b.ats) ? ["v2"] : []), b.ats, b.slug, ["workday", "phenom", "smartrecruiters", "oracle", "eightfold", "usajobs", "careeronestop"].includes(b.ats) ? field : "", ["usajobs", "careeronestop"].includes(b.ats) ? region : ""].join("|").toLowerCase();
  const hit = await readBoardCache(key).catch(() => undefined);
  const age = hit ? Date.now() - new Date(hit.fetched_at).getTime() : Infinity;
  if (hit && age < BOARD_FRESH) return withDetail(hit.raws as Raw[]);
  try {
    const raws = await fetch(b, field, region);
    // Empty answers aren't saved (a site under maintenance often answers with nothing); huge boards aren't either.
    const slim = JSON.stringify(slimForCache(raws));
    if (raws.length && slim.length < 3_000_000)
      await q("INSERT INTO board_cache (key, raws) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET raws = EXCLUDED.raws, fetched_at = now()", [key, slim]).catch(() => {});
    if (raws.length || !hit || age > BOARD_STALE) return withDetail(raws);
  } catch (e) {
    if (!hit || age > BOARD_STALE) throw e;
  }
  return withDetail(hit.raws as Raw[]);
}
/** Openings scout: reads every employer's site (cached copies count) and reports what each returned. */
export async function scoutBoards(boards = EMPLOYERS, read = cachedBoard) {
  const out: { company: string; fields: string[]; ok: boolean; total: number; early: number; error?: string }[] = [];
  let i = 0;
  const worker = async () => {
    while (i < boards.length) {
      const b = boards[i++];
      const k = FIELD_TITLES.findIndex(([field]) => field.test((b.fields || []).join(" ")));
      try {
        const raws = await Promise.race([read(b, k >= 0 ? FIELD_SEARCH[k] : "", ""), new Promise<never>((_, no) => setTimeout(() => no(new Error("timed out")), 45_000))]);
        // A site that answers with nothing usually has no internships posted right now; that isn't a broken reader.
        out.push({ company: b.company, fields: b.fields || [], ok: true, total: raws.length, early: raws.filter((r) => r.student || EARLY.test(r.title)).length });
      } catch (e: any) {
        out.push({ company: b.company, fields: b.fields || [], ok: false, total: 0, early: 0, error: String(e?.message || e).slice(0, 120) });
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return out;
}
// Conference and competition lists are kept for a month (server/jobs/conferences.ts, competitions.ts), employer reads for 3 days.
export const pruneBoardCache = () => q("DELETE FROM board_cache WHERE fetched_at < now() - interval '3 days' AND ((key NOT LIKE 'conferences|%' AND key NOT LIKE 'competitions|%') OR fetched_at < now() - interval '40 days')");

/** The words that make a student's goal specific ("mechanical" in "mechanical engineering intern"), so a
 *  Mechanical Engineering Intern ranks above an Electrical one for them. */
const GENERIC = /^(intern|interns|internship|internships|student|students|engineer|engineering|analyst|associate|assistant|summer|entry|level|role|roles|jobs?|work|program|career|careers|position|and|the|for|with)$/i;
export const specificWords = (ws: Workspace) =>
  [...new Set(`${ws.profile.targetRoles} ${ws.profile.major}`.toLowerCase().split(/[^a-z&]+/).filter((w) => w.length > 3 && !GENERIC.test(w)))].slice(0, 8);

/** Workday's "IL-Rosemont" / "TX-Houston" → "Rosemont, IL"; anything else unchanged. */
export const tidyLocation = (l: string) => l.replace(/\b([A-Z]{2})-([A-Za-z .'-]+?)(?=$|;|,|\s·)/g, (_m, st, city) => `${city.replace(/-/g, " ").trim()}, ${st}`);

/** Which employers to read next: explicit company preferences, then weak interest and recency. No employer is blocked by hiding individual openings. */
export function orderEmployers<T extends { company: string }>(list: T[], liked: Set<string | undefined>, hides: Map<string, number>, lastRead: Record<string, string>, preferences = new Map<string, number>()): T[] {
  const score = (e: T) => {
    const key = e.company.trim().toLowerCase();
    // Explicit neutral also replaces the weaker save/hide inference.
    return preferences.has(key) ? preferences.get(key)! : (liked.has(key) ? 2 : 0) - Math.min(3, hides.get(key) || 0) * 0.5;
  };
  return list
    .filter((e, i) => list.findIndex((x) => x.company.trim().toLowerCase() === e.company.trim().toLowerCase()) === i)
    .sort((a, b) => score(b) - score(a) || (lastRead[a.company] || "").localeCompare(lastRead[b.company] || "") || a.company.localeCompare(b.company));
}

/** Turns a company name into board guesses on all three ATSs. */
export function boardsFor(company: string): Board[] {
  const base = company.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
  if (!base) return [];
  return (["greenhouse", "lever", "ashby"] as const).map((ats) => ({ ats, slug: base, company }));
}

/** An opening from an employer's job board that came in with no posting text, saved before the Nov 19, 2026 fix.
 *  Each one is re-read until a search returns it once: a refill stamps checkedAt, so a posting that truly has no
 *  text isn't read again on every search. */
const EMPTY_BEFORE = "2026-11-20";
export const isEmptyListing = (j: Job) => !j.postingText && / job board\)$/.test(j.sourceName || "") && (j.checkedAt || "") < EMPTY_BEFORE;
/** Copies freshly read posting text onto saved openings that had none, keeping their id (saved, applied, rated stay
 *  attached). Returns the found openings that weren't such a refill. */
export function refillEmpty(jobs: Job[], found: Job[]): Job[] {
  const empty = new Map(jobs.filter(isEmptyListing).map((j) => [j.applyUrl, j]));
  return found.filter((f) => {
    const old = empty.get(f.applyUrl);
    if (!old) return true;
    old.checkedAt = f.checkedAt; // read again: tried once, whatever came back
    if (!f.postingText) return false;
    Object.assign(old, { postingText: f.postingText, summary: f.summary, requirements: f.requirements, eligibility: f.eligibility, location: f.location !== "Not stated" ? f.location : old.location });
    return false;
  });
}
/** Scans boards in parallel and returns early-career postings that suit the student. */
export async function discoverJobs(ws: Workspace, boards: Board[], limit = 25, enabled = interestEnabled()): Promise<{ jobs: Job[]; scanned: number; reached: string[] }> {
  // Only fields the student chose narrow the search (see chosenFieldText): "working with people" isn't the HR field.
  const fields = chosenFieldText(ws.profile).toLowerCase().split(/[,;/]+/).map((x) => x.trim()).filter((x) => x.length > 2);
  const titleFits = FIELD_TITLES.filter(([field]) => field.test(fields.join(" "))).map(([, title]) => title);
  // Workday needs a search word; use the student's first field ("finance").
  const field = FIELD_SEARCH.find((_, k) => FIELD_TITLES[k][0].test(fields.join(" "))) || "";
  const undergrad = !/grad/i.test(ws.profile.classYear);
  // An opening saved with no posting text (title-only boards before Nov 19, 2026) counts as unknown, so it's read again
  // and the caller fills its text in place (refillEmpty) instead of keeping a card that can't say why it fits.
  const known = new Set([...ws.jobs.filter((j) => !isEmptyListing(j)).flatMap((j) => [j.applyUrl, j.sourceUrl]), ...(ws.droppedJobUrls || [])]);
  const reached: string[] = [];
  const found: { job: Job; rel: number; preference: number; inArea: boolean }[] = [];
  let i = 0;
  const worker = async () => {
    while (i < boards.length) {
      const b = boards[i++];
      let raws: Raw[] = [];
      try { raws = await cachedBoard(b, field, ws.profile.regions || ws.profile.location || ""); } catch { continue; }
      if (!raws.length) continue;
      reached.push(b.company);
      let details = 0, outsideReads = 0;
      // The student's own places first: out-of-area postings (kept only by their relocation answer) never use the
      // detail reads or the per-employer slots an in-area posting would have had (skeptic review).
      const outsideAt = (location: string) => regionMatch(ws, { location, format: /remote/i.test(location) ? "Remote" : "" } as Job) === false;
      const ordered = [...raws].sort((a, z) => Number(outsideAt(a.location)) - Number(outsideAt(z.location)));
      for (const r of ordered) {
        if (!r.url || known.has(r.url) || (!r.student && (!EARLY.test(r.title) || (SENIOR.test(r.title) && !/intern|co-?op|new grad|student/i.test(r.title))))) continue;
        if (undergrad && GRAD_LEVEL.test(r.title)) continue;
        // A country in the title ("Key Account Trainee – Iberia (España y Portugal)") means abroad, even when the location is vague.
        if (COUNTRY_IN_TEXT.test(r.title)) continue; // a country in the title ("Analyst - Germany"); regions and cities don't count
        // A title in another field is skipped; a generic one ("Summer Intern") is judged by its duties below.
        const generic = !FIELD_TITLES.some(([, t]) => t.test(r.title));
        if (titleFits.length && !titleFits.some((t) => t.test(r.title)) && !generic) continue;
        // Skip places the student didn't ask for before spending a detail read on them.
        const where = (location: string) => {
          if (r.nearby) return true;
          const m = regionMatch(ws, { location, format: /remote/i.test(location) ? "Remote" : "" } as Job);
          if (m !== false) return m ?? !abroad(location);
          // Outside the places they chose: their own "Open to relocating?" answer decides (council, Nov 19). "Yes" keeps
          // it; "For the right role" keeps it only with a reason they'd recognize (a title in their own field words, or a
          // dream employer), shown on the card; "No" or no answer keeps them to their places.
          return !abroad(location) && !!relocateReason(ws, r.title, r.company || b.company);
        };
        if (!/^\d+ locations?$/i.test(r.location) && !where(r.location)) continue;
        // Workday lists only titles; read the full posting for the few that pass the title checks.
        if (r.detail && !r.text) {
          if (outsideAt(r.location) && outsideReads++ >= 2) continue;
          if (details++ >= 6) continue;
          try { const d = await r.detail(); r.text = d.text; if (d.location) r.location = d.location; } catch { continue; }
        }
        if (!where(r.location)) continue;
        if (titleFits.length && !titleFits.some((t) => t.test(r.title)) && !titleFits.some((t) => t.test(duties(r.text)))) continue;
        const same = `${b.company}|${r.title}|${r.location}`.toLowerCase();
        if (known.has(same)) continue;
        known.add(same);
        const hay = `${r.title} ${r.text.slice(0, 3000)}`.toLowerCase();
        // Passing the field check counts: a "Brand Intern" is marketing even if the word "marketing" never appears.
        const rel = fields.filter((f) => hay.includes(f)).length + (titleFits.some((t) => t.test(r.title)) ? 2 : titleFits.some((t) => t.test(duties(r.text))) ? 1 : 0)
          + 3 * specificWords(ws).filter((w) => new RegExp(`\\b${w}`, "i").test(r.title)).length;
        const job: Job = {
          id: uid("j"), kind: kindOf(r.title), title: r.title, company: r.company || b.company, location: tidyLocation(r.location) || "Not stated",
          format: /remote/i.test(r.location) ? "Remote" : "", dates: "", deadline: r.deadline || "", deadlineText: r.deadline ? `Closes ${r.deadline}` : "Not stated on the board — check the posting",
          eligibility: eligibilityFrom(r.text), requirements: requirementsFrom(r.text), summary: postingLines(r.text).join("\n").slice(0, 420),
          applyUrl: r.url, sourceUrl: r.url, sourceName: `${b.company} careers (${b.ats[0].toUpperCase() + b.ats.slice(1)} job board)`,
          label: "Live", checkedAt: new Date().toISOString(), foundAt: new Date().toISOString(), checks: [], origin: "imported", postingText: r.text.slice(0, 12000),
        };
        known.add(r.url);
        found.push({ job, rel, preference: preferenceAdjustment(ws, job, enabled).adjustment, inArea: !outsideAt(r.location) });
      }
    }
  };
  await Promise.all(Array.from({ length: 12 }, worker));
  // Most relevant to the student's fields first; keep a few from each company.
  // The student's own likes count before the per-company and overall cuts; field checks and employer variety stay.
  found.sort((a, b) => Number(b.inArea) - Number(a.inArea) || (b.rel + b.preference) - (a.rel + a.preference) || b.rel - a.rel || a.job.company.localeCompare(b.job.company) || a.job.title.localeCompare(b.job.title) || a.job.applyUrl.localeCompare(b.job.applyUrl));
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
