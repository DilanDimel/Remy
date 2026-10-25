import type { Job, JobFit, Workspace } from "@shared/types";
import { hasKeyword } from "./ats";
import { norm } from "./parse";
import { graduationOf, primaryEducation } from "./resume";

// Deterministic fit: eligibility (graduation window, class year), where the
// student wants to work, what kinds of opportunities they asked for, and which
// posting requirements their materials already show. No AI needed.

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, spr: 5, sum: 8, fal: 12, win: 12 };
const YEARS = ["First-year", "Sophomore", "Junior", "Senior"] as const;
type Year = (typeof YEARS)[number];

export function gradDate(ws: Workspace): { y: number; m: number } | null {
  const src = ws.profile.graduation || graduationOf(primaryEducation(ws.resume?.doc)?.dates || "");
  // The last month and year: a range ("Aug 2025 – May 2029") ends at graduation.
  const m = [...src.matchAll(/([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/g)].pop();
  if (m) return { y: +m[2], m: MONTHS[m[1].toLowerCase()] || 5 };
  const y = src.match(/20\d\d/g)?.pop();
  return y ? { y: +y, m: 5 } : null;
}

/** When the student started college: four years before graduation, else from the class year. Used to tell college from high-school entries. */
export function collegeStartOf(ws: Workspace, today = new Date()): { y: number; m: number } | undefined {
  const g = gradDate(ws);
  if (g) return { y: g.y - 4, m: 8 };
  const k = ["First-year", "Sophomore", "Junior", "Senior"].indexOf(classYearOf(ws, today));
  if (k < 0) return undefined;
  const fallStart = today.getMonth() >= 7 ? today.getFullYear() : today.getFullYear() - 1;
  return { y: fallStart - k, m: 8 };
}

// Class standing stated as such ("Class: Junior", "Sophomore standing", "(Senior)"), not a
// title that happens to contain the word ("Senior Analyst", "Junior Achievement").
const STANDING = /\b(?:class(?:ification)?|standing|year in school)\s*[:–-]\s*(freshman|first[- ]year|sophomore|junior|senior)\b|\b(freshman|first[- ]year|sophomore|junior|senior)\s+(?:student|standing)\b|\((freshman|first[- ]year|sophomore|junior|senior)\)/i;

/** Class standing from what the student said, else from the resume text, else
 * from the expected graduation date (a May 2030 graduate is a first-year in fall 2026). */
export function classYearOf(ws: Workspace, today = new Date()): Year | "Graduate student" | "" {
  const said = ws.profile.classYear.toLowerCase();
  if (/grad/.test(said)) return "Graduate student";
  if (/fresh|first/.test(said)) return "First-year";
  if (/soph/.test(said)) return "Sophomore";
  if (/junior/.test(said)) return "Junior";
  if (/senior/.test(said)) return "Senior";
  const text = ws.resume?.rawText || "";
  const s = text.match(STANDING);
  const named = (s?.[1] || s?.[2] || s?.[3])?.toLowerCase();
  if (named) return named.startsWith("f") ? "First-year" : (named[0].toUpperCase() + named.slice(1)) as Year;
  const g = gradDate(ws);
  if (!g) return "";
  // Academic year ends in May: months until graduation → years remaining.
  const yearsLeft = Math.ceil(((g.y * 12 + g.m) - (today.getFullYear() * 12 + today.getMonth() + 1)) / 12);
  return yearsLeft >= 4 ? "First-year" : yearsLeft === 3 ? "Sophomore" : yearsLeft === 2 ? "Junior" : yearsLeft >= 0 ? "Senior" : "";
}

/** Class years a posting is restricted to, if it says so. "Rising sophomores"
 * are current first-years. Credit-based standing is left to the student to judge. */
function requiredYears(text: string): { years: Set<Year>; definite: boolean; byCredits: boolean } | null {
  const t = text.toLowerCase();
  const years = new Set<Year>();
  const re = /\b(rising\s+)?(freshm[ae]n|first[- ]years?|sophomores?|juniors?|seniors?)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const idx = m[2].startsWith("fresh") || m[2].startsWith("first") ? 0 : m[2].startsWith("soph") ? 1 : m[2].startsWith("jun") ? 2 : 3;
    const cur = m[1] ? idx - 1 : idx;
    if (cur >= 0) years.add(YEARS[cur]);
  }
  if (!years.size) return null;
  const definite = /\b(must|only|open to|restricted|currently (a|an|enrolled)|current|eligible (candidates|students|applicants)|is for|are for|designed for|exclusively)\b/.test(t);
  const byCredits = /credit hours?|by credits|credit standing|academic standing by credit/.test(t);
  return { years, definite, byCredits };
}

const METRO: Record<string, string[]> = {
  "fort worth": ["fort worth", "arlington", "dfw"],
  dallas: ["dallas", "irving", "plano", "frisco", "richardson", "addison", "dfw"],
  dfw: ["dallas", "fort worth", "arlington", "irving", "plano", "frisco", "richardson", "addison", "dfw", "las colinas"],
  houston: ["houston"],
  austin: ["austin"],
  texas: ["texas", ", tx", " tx", "dallas", "fort worth", "houston", "austin", "san antonio", "irving", "plano"],
  remote: ["remote", "virtual", "online", "anywhere"],
};
// Same order as STATE.
const STATE_NAMES = "alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|district of columbia|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming".split("|");
const STATE = "AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY";
const FOREIGN = new RegExp(
  `\\b(brazil|canada|india|mexico|united kingdom|england|scotland|ireland|germany|france|spain|ital(y|ia)|milan|madrid|poland|philippines|singapore|china|hong kong|japan|korea|taiwan|vietnam|australia|morocco|guatemala|ukraine|turkey|türkiye|portugal|saudi|emirates|netherlands|switzerland|sweden|hungary|costa rica|argentina|colombia|chile|israel|egypt|romania|czech|belgium|denmark|norway|luxembourg|london|paris|berlin|frankfurt|munich|zurich|dublin|amsterdam|warsaw|stockholm|lisbon|istanbul|dubai|riyadh|tokyo|seoul|shanghai|beijing|sydney|s[aã]o paulo|toronto|bengaluru|bangalore|hyderabad|mumbai|taguig|manila)\\b|,\\s*(br|uk|mx|sg|ph|cn|jp|au|hk|eng|ita)\\b`, "i");
/** True when a posting's location is outside the US ("Sao Paulo Brazil", "ES - MADRID"). Unknown places count as US.
 *  shortcut: a word list, not geocoding; misses unlisted countries, upgrade if students see foreign postings. */
export function abroad(location: string): boolean {
  const prefix = /^([A-Z]{2})\s?-\s/.exec(location.trim());
  return FOREIGN.test(location) || !!(prefix && prefix[1] !== "US" && !new RegExp(`^(${STATE})$`).test(prefix[1]));
}

/** true / false when the student named regions; null when they didn't (or "anywhere"). */
export function regionMatch(ws: Workspace, job: Job): boolean | null {
  const wants = (ws.profile.regions || "").toLowerCase().split(/[,;/]+/).map((x) => x.trim()).filter(Boolean);
  if (!wants.length || wants.some((w) => /anywhere|open to (any|all)|united states|^us$|usa/.test(w))) return null;
  const loc = ` ${job.location} ${job.format} `.toLowerCase();
  // Virtual and remote postings can be done from anywhere, so they match every region.
  // ...unless the posting names another country ("Virtual, BR", "Remote - Canada").
  if (/remote|virtual|online/.test(loc) && !abroad(job.location)) return true;
  return wants.some((w) => {
    const key = Object.keys(METRO).find((k) => w.includes(k));
    // A state name also matches its abbreviation ("California" → "Glendale, CA").
    const a = STATE.split("|")[STATE_NAMES.indexOf(w)]?.toLowerCase();
    return (key ? METRO[key] : a ? [w, `, ${a},`, `, ${a} `, `,${a} `] : [w]).some((needle) => loc.includes(needle));
  });
}

// The student's fields (target roles, major, interests) → job titles that belong to them.
// A title must match one of the student's fields; fields that map to nothing don't filter.
export const FIELD_TITLES: [RegExp, RegExp][] = [
  [/financ|bank|invest|m&a|capital|fintech|account|econ|wealth/i, /financ|bank|invest|m&a|merger|capital|equity|credit|analyst|account|treasury|fp&a|valuation|trading|risk|wealth|asset|corporate development|strategy|\bbusiness/i],
  [/market|brand|advertis|social media|communication/i, /market|brand|growth|content|social|communication|advertis|creative/i],
  [/data|analytic|statistic/i, /data|analytic|insight|intelligence|research|quant/i],
  [/software|computer science|computer engineering|\bcs\b|developer|\btech\b|programming|information technology/i, /engineer|developer|software|technical|machine learning|data/i],
  [/supply chain|operations|logistics/i, /operations|supply|logistics|procurement|planning/i],
  [/consult/i, /consult|strategy|analyst/i],
  [/sales|business development/i, /sales|business development|account (executive|manager)|partnerships/i],
  [/quant|math|physics/i, /quant|research|trading|analyst|data/i],
  [/real estate|property/i, /real estate|property|leasing|appraisal|acquisitions|capital markets|valuation/i],
  [/human resources|\bhr\b|people|talent|recruit/i, /human resources|\bhr\b|people|talent|recruit/i],
  [/health|pharma|biotech|medical|pre-?med|kinesiolog|nutrition|public health/i, /health|clinical|pharma|patient|medical|biotech|hospital/i],
  [/nurs|\brn\b|\bbsn\b/i, /nurs|\brn\b|patient care|care (tech|assistant)|extern|clinical|\bcna\b|hospital/i],
  // Engineering other than software: mechanical, civil, electrical… Software titles are left to the software row.
  [/mechanical|civil|electrical|industrial|aerospace|chemical|biomedical|manufacturing|petroleum|structural|\bengineering\b/i, /^(?!.*software).*(engineer|engineering|manufacturing|design|process|quality|field|technician|project)/i],
  [/educat|teach/i, /teach|education|tutor|instruct|classroom/i],
];
// The search word for each FIELD_TITLES row, in the same order.
export const FIELD_SEARCH = ["finance", "marketing", "data", "software", "operations", "consulting", "sales", "quantitative", "real estate", "human resources", "healthcare", "nursing", "engineering", "education"];

/** Postings the student pasted in themselves are never hidden by field or type: they chose them. */
const studentAdded = (job: Job) => job.origin === "imported" && !/job board/i.test(job.sourceName || "");
/** true / false when the student named fields Remy recognizes; null when not. */
export function fieldMatch(ws: Workspace, job: Job): boolean | null {
  const p = ws.profile;
  const wanted = FIELD_TITLES.filter(([field]) => field.test([p.targetRoles, p.major, p.interests].join(" "))).map(([, title]) => title);
  if (!wanted.length) return null;
  return wanted.some((t) => t.test(job.title));
}

const TYPE_OF: Record<Job["kind"], string> = { internship: "internship", job: "full-time", program: "program", campus: "campus", event: "event" };
export function typeMatch(ws: Workspace, job: Job): boolean | null {
  const t = (ws.profile.opportunityTypes || "").toLowerCase();
  if (!t.trim()) return null;
  const k = TYPE_OF[job.kind];
  if (k === "internship") return /intern/.test(t);
  if (k === "full-time") return /full|job/.test(t);
  if (k === "program") return /program|insight|intern/.test(t);
  if (k === "campus") return /part|campus/.test(t);
  // Summits and insight events are what "Programs & insight days" means in practice.
  return /event|competition|career fair|network|insight/.test(t) || /competition/i.test(job.title) && /competition/.test(t);
}

/** Why a posting is ruled out by something the student told Remy, or "" if nothing does:
 *  they need visa sponsorship and the posting won't sponsor; it's for MBA/graduate students and they're
 *  an undergraduate; it's in something they said to avoid; or it names a summer they didn't pick. */
export function dealbreaker(ws: Workspace, job: Job, today = new Date()): string {
  const p = ws.profile;
  const text = `${job.title} ${job.eligibility.join(" ")} ${job.summary} ${job.postingText || ""}`;
  if (/sponsor|visa|f-?1|opt\b|h-?1b/i.test(p.workAuth || "") && /\b(?:no|not|unable to|cannot|will not|won't|does not)\b[^.]{0,40}\bsponsor|without (?:the need for )?(?:current or future |now or in the future )?(?:visa |employment )?sponsorship|not eligible for (?:visa )?sponsorship/i.test(text))
    return "This posting says it won't sponsor a work visa, and you told Remy you'll need sponsorship.";
  if (classYearOf(ws, today) !== "Graduate student" && /\bMBA\b(?! or undergraduate)|(?:currently )?(?:enrolled in|pursuing) an? (?:master'?s|graduate|ph\.?d)/i.test(`${job.title} ${job.eligibility.join(" ")} ${job.summary} ${job.requirements.map((r) => `${r.keyword} ${r.quote}`).join(" ")}`))
    return "This one is for MBA or graduate students.";
  for (const a of (p.avoid || "").split(/[,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => x.length > 2))
    if (`${job.company} ${job.title}`.toLowerCase().includes(a)) return `You told Remy to avoid "${a}".`;
  const want = [...(p.timeline || "").matchAll(/summer\s*(20\d\d)/gi)].map((m) => m[1]);
  const named = job.title.match(/summer\s*(20\d\d)|(20\d\d)\s*summer/i);
  const y = named && (named[1] || named[2]);
  if (want.length && y && !want.includes(y)) return `This is for Summer ${y}; you're looking for ${want.map((w) => "Summer " + w).join(" or ")}.`;
  return "";
}

export function computeFit(ws: Workspace, job: Job, evidence: string): JobFit {
  const g = gradDate(ws);
  const year = classYearOf(ws);
  let eligibility: JobFit["eligibility"] = "unknown";
  let note = "Add your class year or expected graduation date so Remy can check eligibility.";
  let excluded = false;
  const elig = [job.eligibility.join(" "), job.title].join(" ");
  const range = elig.match(/between\s+([A-Za-z]+)\s+(\d{4})\s+and\s+([A-Za-z]+)\s+(\d{4})/i) || elig.match(/graduating\s+([A-Za-z]+)\s+(\d{4})\s*[–-]\s*([A-Za-z]+)\s+(\d{4})/i);
  const classOf = elig.match(/class of (\d{4})/i);
  const years = requiredYears(elig);
  // A class year in the title ("Sophomore Summer Analyst") is a restriction, not a hint.
  if (years && requiredYears(job.title)) years.definite = true;
  if (g && range) {
    const v = g.y * 12 + g.m;
    const a = +range[2] * 12 + (MONTHS[range[1].slice(0, 3).toLowerCase()] || 1);
    const b = +range[4] * 12 + (MONTHS[range[3].slice(0, 3).toLowerCase()] || 12);
    eligibility = v >= a && v <= b ? "likely" : "unlikely";
    excluded = eligibility === "unlikely";
    note = `This posting asks for graduation between ${range[1]} ${range[2]} and ${range[3]} ${range[4]}; you expect ${ws.profile.graduation || g.y}.`;
  } else if (g && classOf) {
    eligibility = +classOf[1] === g.y ? "likely" : "unlikely";
    excluded = eligibility === "unlikely";
    note = `This posting is for the Class of ${classOf[1]}; you expect to graduate in ${g.y}.`;
  } else if (years) {
    const list = [...years.years].join(" or ");
    if (!year) {
      eligibility = "check";
      note = `This posting is for ${list.toLowerCase()} students — tell Remy your class year to check.`;
    } else if (year !== "Graduate student" && years.years.has(year)) {
      eligibility = "likely";
      note = `This posting is for ${list.toLowerCase()} students, and you're a ${year.toLowerCase()}.`;
    } else {
      eligibility = years.byCredits ? "check" : "unlikely";
      excluded = years.definite && !years.byCredits;
      note = years.byCredits
        ? `This posting counts standing by credits (${list.toLowerCase()}). Check your credit hours before applying.`
        : `This posting is for ${list.toLowerCase()} students, and you're a ${year.toLowerCase()}.`;
    }
  } else if (g || year) {
    eligibility = "check";
    note = "No class-year or graduation rule stated — skim the posting's eligibility section.";
  }

  const matched: string[] = [];
  const gaps: string[] = [];
  for (const r of job.requirements) {
    if (hasKeyword(evidence, r.keyword)) matched.push(r.keyword);
    else gaps.push(r.keyword);
  }
  const why = matched.length
    ? `You already show ${matched.slice(0, 3).join(", ")}${matched.length > 3 ? ` and ${matched.length - 3} more` : ""} — that's what this posting asks for.`
    : ws.resume ? "This one would be a stretch for you right now: your resume doesn't show its main asks yet, but it's worth exploring." : "Upload your resume and Remy will show how your experience lines up.";

  const region = regionMatch(ws, job);
  const type = typeMatch(ws, job);
  const field = fieldMatch(ws, job);
  // Leave out what the student said they don't want (wrong field or kind of opportunity).
  if (!studentAdded(job) && (field === false || type === false)) {
    excluded = true;
    note = field === false ? "This isn't in the fields you chose." : "This isn't the kind of opportunity you chose.";
  }
  const ruledOut = studentAdded(job) ? "" : dealbreaker(ws, job);
  if (ruledOut) { excluded = true; note = ruledOut; }
  const req = job.requirements.length || 1;
  const score = Math.round(
    ({ likely: 40, check: 22, unknown: 18, unlikely: 0 } as const)[eligibility] +
      30 * (matched.length / req) +
      (region === true ? 15 : region === false ? -15 : 0) +
      (type === true ? 10 : type === false ? -10 : 0) +
      (job.label === "Live" ? 5 : 0),
  );
  return { at: new Date().toISOString(), by: "rules", eligibility, eligibilityNote: note, matched, gaps, why, excluded, score, regionMatch: region, typeMatch: type };
}
