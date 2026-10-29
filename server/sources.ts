import fs from "node:fs";
import path from "node:path";
import type { Job, Requirement, Workspace } from "@shared/types";
import { htmlToText } from "./parse";
import { uid } from "./ids";
import { abroad, FIELD_SEARCH, FIELD_TITLES, regionMatch } from "./fit";
import { q, q1 } from "./sql";

// Live openings from employers' own career sites (Greenhouse, Lever, Ashby, Workday, SmartRecruiters,
// Oracle Cloud, Eightfold, Phenom and AppliTrack school-district boards).
// These are the boards companies use to publish their own careers pages, so each
// posting links straight back to the employer. No login, no scraping of
// third-party aggregators.

type Board = { ats: "greenhouse" | "lever" | "ashby" | "workday" | "smartrecruiters" | "oracle" | "eightfold" | "phenom" | "usajobs" | "applitrack" | "schoolspring" | "taleo" | "careeronestop"; slug: string; company: string; fields?: string[] };

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

const EARLY = /\b(junior|trainee|(?:teaching|research|marketing|legal|administrative) assistant|intern(ship)?s?|co-?op|new grad(uate)?|early career|entry[- ]level|campus|university|student|summer analyst|analyst program|rotational|apprentice|fellow(ship)?|insight|cadets?|recruits?|extern(ship)?s?|nurse residen\w*|graduate nurse|nurse intern|new grad rn|freshm[ae]n|sophomores?|first[- ]year|discover\w*|explore|launch|ambassadors?|leadership program|diversity program|pathways|recent graduate|trainee)\b/i;
const SENIOR = /\b(senior|sr\.?|staff|principal|lead|manager|director|head of|vp|vice president|professor|ii|iii|iv)\b/i;
// What the job itself involves: a posting's sentences minus benefits, "about us", equal-opportunity and
// "any major" lines, which mention fields without being about the work (from Julio's relevance design).
const NOT_DUTIES = /benefit|insurance|wellness|discount|equal opportunity|protected by law|about us|our (company|platform|mission)|any major|qualifications:|we provide|perks/i;
export const duties = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).filter((x) => !NOT_DUTIES.test(x)).join(" ");
// Roles meant for graduate students, skipped for undergraduates.
const GRAD_LEVEL = /\b(graduate intern(ship)?|intern,?\s*graduate|mba|ph\.?\s?d|doctoral|postdoc|post-doc|master'?s|graduate student|j\.?d\.?|law student|law clerk|medical student|residency program|school psycholog\w*|diagnostician|licensed specialist)\b/i;
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
  return /intern|extern|co-?op|summer analyst/i.test(title) ? "internship" : /program|fellow|insight|rotational|residen/i.test(title) ? "program" : "job";
}

type Raw = { title: string; location: string; url: string; text: string; posted?: string; company?: string; deadline?: string; student?: boolean; nearby?: boolean; detail?: () => Promise<{ text: string; location?: string }> };
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
// Search words for boards that need one: hospitals post "Nurse Residency" and "Extern", not "Intern".
const queries = (field: string) => (field === "nursing" ? ["nurse residency", "extern", "graduate nurse"] : ["intern"]);
async function each(field: string, read: (q: string) => Promise<Raw[]>): Promise<Raw[]> {
  const seen = new Set<string>();
  return (await Promise.all(queries(field).map((q) => read(q).catch(() => [] as Raw[])))).flat().filter((r) => !seen.has(r.url) && seen.add(r.url));
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
    detail: async () => {
      const d = await getJson(String(x.ref));
      const sec = d.jobAd?.sections || {};
      return { text: htmlToText([sec.jobDescription?.text, sec.qualifications?.text, sec.additionalInformation?.text].filter(Boolean).join("\n")), location: "" };
    },
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
    detail: async () => {
      const d = await getJson(`${api}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${x.Id}%22,siteNumber=${encodeURIComponent(site)}`);
      const it = d.items?.[0] || {};
      return { text: htmlToText([it.ExternalDescriptionStr, it.ExternalQualificationsStr, it.ExternalResponsibilitiesStr].filter(Boolean).join("\n")), location: "" };
    },
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
    detail: async () => {
      const d = await getJson(`https://${b.slug}/api/apply/v2/jobs/${x.id}?domain=${domain}`);
      return { text: htmlToText(String(d.job_description || "")), location: "" };
    },
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
      detail: async () => {
        const d = await widgets({ pageName: "job", ddoKey: "jobDetail", jobSeqNo: x.jobSeqNo });
        return { text: htmlToText(String(d.jobDetail?.data?.job?.description || x.descriptionTeaser || "")), location: "" };
      },
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
async function eachQuery(queries: string[], read: (q: string) => Promise<Raw[]>): Promise<Raw[]> {
  const seen = new Set<string>();
  return (await Promise.all(queries.map((q) => read(q).catch(() => [] as Raw[])))).flat().filter((r) => !seen.has(r.url) && seen.add(r.url));
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
      detail: async () => {
        const d = (await getJson(`https://api.schoolspring.com/api/Jobs/${encodeURIComponent(x.jobId)}`)).value?.jobInfo || {};
        const pay = d.payMin && d.payMax ? `Pay: $${d.payMin}–$${d.payMax} ${d.salaryCode || ""}` : "";
        return { text: [htmlToText(String(d.jobDescription || "")), d.requirements && d.requirements !== "None" ? htmlToText(String(d.requirements)) : "", pay, d.shiftType ? `Schedule: ${d.shiftType}` : ""].filter(Boolean).join("\n") };
      },
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
        detail: async () => ({ text: taleoDescription(await (await fetch(url, { headers: { "user-agent": BROWSER_UA }, signal: AbortSignal.timeout(8000) })).text()) }),
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
const BOARD_STALE = 3 * 24 * 60 * 60_000;
export async function cachedBoard(b: Board, field: string, region: string, fetch = fetchBoard): Promise<Raw[]> {
  // Sources that search by field or place get one entry per search; whole-board sources get one entry.
  const key = [b.ats, b.slug, ["workday", "phenom", "smartrecruiters", "oracle", "eightfold", "usajobs", "careeronestop"].includes(b.ats) ? field : "", ["usajobs", "careeronestop"].includes(b.ats) ? region : ""].join("|").toLowerCase();
  const hit = await q1("SELECT raws, fetched_at FROM board_cache WHERE key = $1", [key]).catch(() => undefined);
  const age = hit ? Date.now() - new Date(hit.fetched_at).getTime() : Infinity;
  if (hit && age < BOARD_FRESH) return hit.raws as Raw[];
  try {
    const raws = await fetch(b, field, region);
    // Empty answers aren't saved (a site under maintenance often answers with nothing); huge boards aren't either.
    if (raws.length && JSON.stringify(raws).length < 3_000_000)
      await q("INSERT INTO board_cache (key, raws) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET raws = EXCLUDED.raws, fetched_at = now()", [key, JSON.stringify(raws)]).catch(() => {});
    if (raws.length || !hit || age > BOARD_STALE) return raws;
  } catch (e) {
    if (!hit || age > BOARD_STALE) throw e;
  }
  return hit.raws as Raw[];
}
export const pruneBoardCache = () => q("DELETE FROM board_cache WHERE fetched_at < now() - interval '3 days'");

/** The words that make a student's goal specific ("mechanical" in "mechanical engineering intern"), so a
 *  Mechanical Engineering Intern ranks above an Electrical one for them. */
const GENERIC = /^(intern|interns|internship|internships|student|students|engineer|engineering|analyst|associate|assistant|summer|entry|level|role|roles|jobs?|work|program|career|careers|position|and|the|for|with)$/i;
export const specificWords = (ws: Workspace) =>
  [...new Set(`${ws.profile.targetRoles} ${ws.profile.major}`.toLowerCase().split(/[^a-z&]+/).filter((w) => w.length > 3 && !GENERIC.test(w)))].slice(0, 8);

/** Which employers to read next: liked ones first, dismissed ones (2+ "Not interested") left out, then least recently read. */
export function orderEmployers<T extends { company: string }>(list: T[], liked: Set<string | undefined>, hides: Map<string, number>, lastRead: Record<string, string>): T[] {
  const like = (e: T) => (liked.has(e.company.toLowerCase()) ? 1 : 0);
  return list
    .filter((e, i) => list.findIndex((x) => x.company === e.company) === i && (hides.get(e.company.toLowerCase()) || 0) < 2)
    .sort((a, b) => like(b) - like(a) || (lastRead[a.company] || "").localeCompare(lastRead[b.company] || ""));
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
      try { raws = await cachedBoard(b, field, ws.profile.regions || ws.profile.location || ""); } catch { continue; }
      if (!raws.length) continue;
      reached.push(b.company);
      let details = 0;
      for (const r of raws) {
        if (!r.url || known.has(r.url) || (!r.student && (!EARLY.test(r.title) || (SENIOR.test(r.title) && !/intern|co-?op|new grad|student/i.test(r.title))))) continue;
        if (undergrad && GRAD_LEVEL.test(r.title)) continue;
        // A title in another field is skipped; a generic one ("Summer Intern") is judged by its duties below.
        const generic = !FIELD_TITLES.some(([, t]) => t.test(r.title));
        if (titleFits.length && !titleFits.some((t) => t.test(r.title)) && !generic) continue;
        // Skip places the student didn't ask for before spending a detail read on them.
        const where = (location: string) => { if (r.nearby) return true; const m = regionMatch(ws, { location, format: /remote/i.test(location) ? "Remote" : "" } as Job); return m ?? !abroad(location); };
        if (!/^\d+ locations?$/i.test(r.location) && !where(r.location)) continue;
        // Workday lists only titles; read the full posting for the few that pass the title checks.
        if (r.detail && !r.text) {
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
          id: uid("j"), kind: kindOf(r.title), title: r.title, company: r.company || b.company, location: r.location || "Not stated",
          format: /remote/i.test(r.location) ? "Remote" : "", dates: "", deadline: r.deadline || "", deadlineText: r.deadline ? `Closes ${r.deadline}` : "Not stated on the board — check the posting",
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
