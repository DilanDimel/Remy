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

const DFW_CITIES = ["dallas", "fort worth", "arlington", "irving", "plano", "frisco", "richardson", "addison", "dfw", "las colinas", "grand prairie", "mckinney", "allen", "denton", "carrollton", "lewisville", "southlake", "westlake", "coppell", "garland", "mesquite", "grapevine", "flower mound", "euless", "bedford", "keller", "mansfield", "the colony", "prosper", "rockwall", "farmers branch", "north richland hills", "hurst", "haltom city", "cedar hill", "duncanville", "desoto", "lancaster", "wylie", "little elm"];
const METRO: Record<string, string[]> = {
  // Students who say Dallas or Fort Worth mean the whole metro.
  "fort worth": DFW_CITIES,
  dallas: DFW_CITIES,
  dfw: DFW_CITIES,
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
  let wants = (ws.profile.regions || "").toLowerCase().split(/[,;/]+/).map((x) => x.trim()).filter(Boolean);
  if (!wants.length || wants.some((w) => /anywhere|open to (any|all)|united states|^us$|usa/.test(w))) return null;
  // "Dallas-Fort Worth, Texas": the state labels the metro; it doesn't mean anywhere in Texas.
  if (wants.some((w) => Object.keys(METRO).some((k) => !STATE_NAMES.includes(k) && k !== "remote" && w.includes(k)))) wants = wants.filter((w) => !STATE_NAMES.includes(w));
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
// Fields follow the National Career Clusters (Advance CTE, 2024), split where college students commonly go.
// Each row: [what the student says (major, roles, interests), job titles that belong to it, Workday search word].
const FIELDS: [RegExp, RegExp, string][] = [
  [/financ|bank|invest|m&a|capital|fintech|account|econ|wealth|cpa/i, /financ|bank|invest|m&a|merger|capital|equity|credit|analyst|account|audit|(?<!non-)tax|assurance|advisory|treasury|fp&a|valuation|trading|risk|wealth|asset|corporate development|strategy|\bbusiness/i, "finance"],
  [/quant|math|statistic|actuar|physics/i, /quant|research|trading|analyst|data|actuar|statistic|model/i, "quantitative"],
  // "marketing", not bare "market": "middle-market" and "capital markets" are finance words.
  [/marketing|market research|brand|advertis|social media|public relations|\bpr\b/i, /marketing|market research|brand|growth|content|social|communication|advertis|creative|public relations|\bpr\b|digital|campaign/i, "marketing"],
  [/sales|business development/i, /sales|business development|account (executive|manager)|partnerships|customer success/i, "sales"],
  [/management|entrepreneur|business admin|\bbba\b|general business|startup/i, /business|operations|management|associate|analyst|strategy|project|program|leadership|rotational/i, "business"],
  [/consult/i, /consult|strategy|analyst|advisory/i, "consulting"],
  [/human resources|\bhr\b|people|talent|recruit/i, /human resources|\bhr\b|people|talent|recruit/i, "human resources"],
  [/data|analytic|statistic/i, /data|analytic|insight|intelligence|research|quant/i, "data"],
  // Business information systems sits between business and tech: analyst, IT and fintech roles, not engineering.
  [/information systems|\bbis\b|\bmis\b|business analytics|fintech/i, /business analyst|systems analyst|information systems|\bit\b|information technology|technology|data analy\w*|data science|database|analytics|business intelligence|fintech|product|erp|\bsap\b|cyber|security analyst|digital|software/i, "information systems"],
  // "Engineer" only with software context, so petroleum, safety or field engineering isn't read as software.
  [/software|computer science|computer engineering|\bcs\b|developer|\btech\b|programming|information technology|cyber/i, /software|developer|programmer|(data|ml|machine learning|cloud|platform|back[- ]?end|front[- ]?end|full[- ]?stack|devops|security|network|systems|site reliability|qa|test|web|mobile|ai) engineer|machine learning|data|cyber|security|network|systems (analyst|administrator)|\bit\b|technology|cloud|technical/i, "software"],
  [/mechanical|civil|electrical|industrial|aerospace|chemical|biomedical|manufacturing|petroleum|structural|\bengineering\b/i, /^(?!.*software).*(engineer|engineering|manufacturing|design|process|quality|field|technician|project|mechanical|\bcad\b|prototyp)/i, "engineering"],
  [/architect|construction|interior design|urban planning|landscape/i, /architect|construction|project|design|planning|estimat|field|site/i, "construction"],
  [/supply chain|operations|logistics|transportation/i, /operations|supply|logistics|procurement|planning|transportation|warehouse|distribution/i, "operations"],
  [/aviation|pilot|flight|aerospace|air traffic/i, /aviation|pilot|flight|airport|aircraft|aerospace|air operations|maintenance/i, "aviation"],
  [/real estate|property/i, /real estate|property|leasing|appraisal|acquisitions|capital markets|valuation/i, "real estate"],
  [/health|pharma|biotech|medical|pre-?med|medicine|doctor|physician|dental|dentist|pharmacy|physical therapy|occupational therapy|\bpa\b|physician assistant|kinesiolog|nutrition|public health|pre-?health/i, /health|clinical|pharma|patient|medical|biotech|hospital|scribe|research assistant|lab|therapy|dental|pharmacy|care/i, "healthcare"],
  [/nurs|\brn\b|\bbsn\b/i, /nurs|\brn\b|patient care|care (tech|assistant)|extern|clinical|\bcna\b|hospital/i, "nursing"],
  [/psycholog|social work|counsel|human services|sociolog|child development|family studies/i, /social work|case manag|counsel|mental health|behavior|psych|advocate|family|youth|human services|community/i, "social work"],
  [/biology|chemistry|physics|neuroscience|environmental science|geology|research|lab science|biochem/i, /research|lab|scientist|chemist|biolog|science|technician|field/i, "research"],
  [/environment|sustainab|agricultur|ranch|conservation|energy|natural resources|wildlife|forestry/i, /environment|sustainab|energy|conservation|agricultur|ranch|wildlife|park|field|natural resources/i, "sustainability"],
  [/educat|teach/i, /teach|education|tutor|instruct|classroom|school|camp|youth/i, "education"],
  [/\blaw\b|legal|pre-?law|paralegal|political science|government|public policy|international relations/i, /legal|\blaw\b|paralegal|clerk|policy|government|legislative|public affairs|compliance|court|advocacy/i, "legal"],
  [/police|criminal justice|criminology|firefight|fire science|\bemt\b|paramedic|public safety|military|homeland security|corrections/i, /police|officer|fire|firefighter|emt|paramedic|dispatch|cadet|corrections|public safety|emergency|security|investigat/i, "public safety"],
  [/\bart\b|\barts\b|studio art|graphic design|design|fashion|photograph|animation|illustrat|museum|art history/i, /design|designer|creative|\bart\b|artist|studio|fashion|photograph|animation|illustrat|museum|gallery|visual/i, "design"],
  [/film|theat(er|re)|acting|actor|actress|perform|music|dance|entertainment|cinema/i, /film|production|theat|acting|music|dance|entertainment|performance|stage|studio|talent|video|audio/i, "entertainment"],
  [/journalis|english|creative writing|writing|communication|broadcast|media/i, /journalis|reporter|editor|writer|writing|content|media|broadcast|news|communications|copy/i, "communications"],
  [/hospitality|hotel|event|tourism|culinary|restaurant/i, /hospitality|hotel|event|guest|tourism|culinary|restaurant|food|venue|front desk/i, "hospitality"],
  [/sport|athletic|recreation|exercise science|coaching/i, /sport|athletic|recreation|fitness|coach|team operations|ticket|stadium/i, "sports"],
  [/nonprofit|non-profit|ministry|religio|social impact|philanthrop/i, /nonprofit|program|volunteer|community|outreach|development|ministry|advocacy/i, "nonprofit"],
];
export const FIELD_TITLES: [RegExp, RegExp][] = FIELDS.map(([who, title]) => [who, title]);
// The search word for each FIELD_TITLES row, in the same order.
export const FIELD_SEARCH = FIELDS.map(([, , word]) => word);

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

// Bump when the fit rules change, so verdicts saved under older rules are worked out again.
export const FIT_RULES_VERSION = 3; // 3: engineering titles include mechanical/CAD/prototype work
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
      eligibility = "unknown";
      note = `This posting is for ${list.toLowerCase()} students. Add your class year and Remy will check it for you.`;
    } else if (year !== "Graduate student" && years.years.has(year)) {
      eligibility = "likely";
      note = `This posting is for ${list.toLowerCase()} students, and you're a ${year.toLowerCase()}.`;
    } else {
      // Standing by credit hours can differ from class year, so that case stays open rather than hidden.
      eligibility = years.byCredits ? "likely" : "unlikely";
      excluded = years.definite && !years.byCredits;
      note = years.byCredits
        ? `This posting counts ${list.toLowerCase()} standing by credit hours; you may qualify if your credits put you there.`
        : `This posting is for ${list.toLowerCase()} students, and you're a ${year.toLowerCase()}.`;
    }
  } else if (g || year) {
    // No class-year or graduation rule in the posting: nothing rules the student out.
    eligibility = "likely";
    note = "This posting doesn't limit class year or graduation date.";
  }
  // A stated GPA minimum, checked against the student's GPA when Remy knows it.
  const gpaText = `${job.eligibility.join(" ")} ${job.postingText || ""}`;
  const minGpa = gpaText.match(/(?:minimum|min\.?|at least|cumulative|overall)?\s*(?:gpa|grade point average)\s*(?:of|:)?\s*(?:at least\s*)?([2-3]\.\d{1,2})/i) || gpaText.match(/\b([2-3]\.\d{1,2})\s*(?:\/\s*4\.0\s*)?(?:or (?:higher|above|better)\s*)?(?:cumulative\s*)?gpa\b/i);
  const myGpa = parseFloat(ws.profile.gpa || "");
  if (minGpa && eligibility !== "unlikely") {
    if (myGpa && myGpa < +minGpa[1]) { eligibility = "unlikely"; note = `This posting asks for a ${minGpa[1]} GPA; yours is ${ws.profile.gpa}.`; }
    else if (myGpa) note += ` It asks for a ${minGpa[1]} GPA, and yours is ${ws.profile.gpa}.`;
    else note += ` It asks for a ${minGpa[1]} GPA; add yours in your profile and Remy will check it.`;
  }
  // Remy doesn't show what the student clearly can't apply for (they can still choose "Show anyway").
  if (eligibility === "unlikely") excluded = true;

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
  return { at: new Date().toISOString(), by: "rules", v: FIT_RULES_VERSION, eligibility, eligibilityNote: note, matched, gaps, why, excluded, score, regionMatch: region, typeMatch: type };
}
