import { sameEmployer } from "@shared/org";
import { postingSkills } from "@shared/requirements";
import type { Job, JobFit, Workspace } from "@shared/types";
import { hasKeyword } from "./ats";
import { families, family } from "@shared/words";
import { norm } from "./parse";
import { graduationOf, primaryEducation } from "./resume";

// Deterministic fit: eligibility (graduation window, class year), where the
// student wants to work, what kinds of opportunities they asked for, and which
// posting requirements their materials already show. No AI needed.

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, spr: 5, sum: 8, fal: 12, win: 12 };
const YEARS = ["First-year", "Sophomore", "Junior", "Senior"] as const;
type Year = (typeof YEARS)[number];

/** The words in the posting that matched, so the student sees why ("Current undergraduate enrollment"). */
function quoteOf(text: string, re: RegExp): string {
  const m = text.match(re);
  if (!m || m.index === undefined) return "";
  const start = text.lastIndexOf(".", m.index) + 1, end = text.indexOf(".", m.index + m[0].length);
  return text.slice(start, end < 0 ? undefined : end).trim().slice(0, 140);
}

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
// Foreign countries and regions: always abroad. Cities that are also US town names (Dublin, Paris, Lima…) are in
// AMBIGUOUS and lose to a US state ("Dublin, OH"). Codes that are only foreign come last ("Leeds, UK").
const COUNTRIES = "brazil|canada|india|united kingdom|england|scotland|wales|ireland|germany|france|spain|ital(?:y|ia)|poland|philippines|singapore|china|hong kong|japan|korea|taiwan|vietnam|australia|new zealand|morocco|guatemala|ukraine|russia|russian federation|belarus|turkey|türkiye|portugal|saudi arabia|saudi|emirates|uae|qatar|kuwait|bahrain|oman|netherlands|switzerland|sweden|finland|iceland|hungary|austria|greece|cyprus|malta|estonia|latvia|lithuania|slovakia|slovenia|croatia|serbia|bulgaria|costa rica|honduras|el salvador|nicaragua|dominican republic|jamaica|trinidad|argentina|colombia|chile|ecuador|venezuela|uruguay|paraguay|bolivia|israel|egypt|tunisia|algeria|nigeria|kenya|ghana|ethiopia|uganda|tanzania|rwanda|senegal|cameroon|south africa|zimbabwe|zambia|botswana|namibia|mauritius|romania|czech republic|czechia|belgium|denmark|norway|luxembourg|pakistan|bangladesh|sri lanka|nepal|indonesia|malaysia|thailand|cambodia|myanmar|kazakhstan|uzbekistan|armenia|azerbaijan";
const REGIONS = "emea|apac|latam|europe|asia|africa|middle east";
const CITIES = "frankfurt|munich|hamburg|zurich|geneva|amsterdam|rotterdam|brussels|prague|budapest|bucharest|sofia|warsaw|krakow|stockholm|oslo|copenhagen|helsinki|lisbon|porto|barcelona|madrid|milan|milano|edinburgh|istanbul|moscow|kyiv|tel aviv|cairo|tunis|casablanca|lagos|nairobi|johannesburg|cape town|dubai|abu dhabi|riyadh|doha|karachi|lahore|dhaka|tokyo|osaka|seoul|shanghai|beijing|shenzhen|taipei|sydney|melbourne|brisbane|auckland|jakarta|kuala lumpur|bangkok|hanoi|ho chi minh|s[aã]o paulo|rio de janeiro|buenos aires|bogot[aá]|santiago|toronto|vancouver|montreal|ottawa|calgary|bengaluru|bangalore|hyderabad|mumbai|pune|chennai|delhi|new delhi|noida|gurgaon|gurugram|kolkata|taguig|manila|cebu";
const AMBIGUOUS = "mexico|peru|lebanon|jordan|london|paris|berlin|dublin|lima|athens|rome|toledo|valencia|vienna|st\\.? petersburg|manchester|cambridge|birmingham|panama city|panama";
const FOREIGN = new RegExp(`(?<![a-z])(${COUNTRIES}|${REGIONS}|${CITIES})(?![a-z])`, "i");
const AMBIGUOUS_CITY = new RegExp(`\\b(${AMBIGUOUS})\\b`, "i");
// Two-letter codes that are only foreign, after a comma and at the end of the place or before another comma.
const FOREIGN_CODE = /,\s*(UK|GB|MX|BR|SG|PH|CN|JP|AU|HK|NL|IE|FR|ES|IT|ITA|ENG|Eng|ON|BC|QC|AB)(?=\s*(,|$))/;
/** Exported for job titles: only country names, so "Africa Programs Intern" or "Intern, Lima Office" aren't dropped. */
export const COUNTRY_IN_TEXT = new RegExp(`\\b(${COUNTRIES})\\b`, "i");
const US_STATE_CODE = new RegExp(`(?:^|,\\s*|\\()(${STATE})(?=[\\s,;)]|$)`, "i");
const US_STATE_NAME = new RegExp(`\\b(${STATE_NAMES.join("|")}|united states|usa|u\\.s\\.a?\\.?)(?![a-z])`, "i");
/** True when a posting's location is outside the US ("Sao Paulo Brazil", "ES - MADRID", "Remote, Russian Federation",
 *  "Berlin, DE"). A list ("Dallas, TX; London, UK") is abroad only when every place in it is.
 *  shortcut: a word list, not geocoding; an unlisted foreign place counts as US. */
export function abroad(location: string): boolean {
  const parts = location.split(/\s*[;|]\s*|\s+\/\s+/).map((x) => x.trim()).filter(Boolean);
  return parts.length > 0 && parts.every(abroadOne);
}
function abroadOne(place: string): boolean {
  const prefix = /^([A-Z]{2})\s?-\s/.exec(place);
  const rest = prefix ? place.slice(prefix[0].length) : place;
  const loc = rest.replace(/\bnew mexico\b/gi, "NM-state");
  // A named foreign country, region or (non-US-sounding) city decides it: "Bengaluru, IN", "Toronto, ON, CA", "Berlin, Germany".
  if (FOREIGN.test(loc) || FOREIGN_CODE.test(loc)) return true;
  const usMark = US_STATE_CODE.test(loc) || US_STATE_NAME.test(loc) || /NM-state/.test(loc);
  // A city that's also a US town is foreign only without a US state ("Dublin" alone vs "Dublin, OH").
  if (AMBIGUOUS_CITY.test(loc) && !usMark) return true;
  // ...or with its own country's code, which is also a state code ("Berlin, DE" is Germany, not Delaware).
  if (/\bberlin,\s*DE\b|\bparis,\s*FR\b|\blima,\s*PE\b|\bathens,\s*GR\b|\bvienna,\s*AT\b|\brome,\s*IT\b/i.test(loc)) return true;
  // Workday style "DE - FRANKFURT": a leading code that isn't a US state is a country.
  return !!(prefix && prefix[1] !== "US" && !new RegExp(`^(${STATE})$`).test(prefix[1]));
}

/** true / false when the student named regions; null when they didn't (or "anywhere"). */
export function regionMatch(ws: Workspace, job: Job): boolean | null {
  let wants = (ws.profile.regions || "").toLowerCase().split(/[,;/]+/).map((x) => x.trim()).filter(Boolean);
  // "Anywhere in Texas" (a setup choice) means all of Texas, not anywhere at all: it used to switch location off,
  // so every opening scored as "place unknown" (live test Nov 19: 0 of 60 openings counted as in the student's area).
  // Only an exact state name or code counts ("Anywhere in TX" too); "Anywhere in USA", "…Texas or Oklahoma" and the
  // like keep meaning no limit, as before (skeptic review).
  const stateOf = (x: string) => { const t = x.trim(); const k = STATE.split("|").findIndex((c) => c.toLowerCase() === t); return k >= 0 ? STATE_NAMES[k] : STATE_NAMES.includes(t) ? t : ""; };
  const wholeStates = wants.map((w) => stateOf(w.match(/^anywhere in (.+)$/)?.[1] || "")).filter(Boolean);
  wants = wants.filter((w) => !stateOf(w.match(/^anywhere in (.+)$/)?.[1] || ""));
  if ((!wants.length && !wholeStates.length) || wants.some((w) => /^anywhere\b|open to (any|all)|united states|^us$|usa/.test(w))) return null;
  // "Dallas-Fort Worth, Texas": the state labels the metro; it doesn't mean anywhere in Texas.
  if (wants.some((w) => Object.keys(METRO).some((k) => !STATE_NAMES.includes(k) && k !== "remote" && w.includes(k)))) wants = wants.filter((w) => !STATE_NAMES.includes(w));
  // "Austin, TX": a state right after a city labels that city; it doesn't mean the whole state.
  const isState = (w: string) => STATE_NAMES.includes(w) || new RegExp(`^(${STATE})$`, "i").test(w);
  wants = wants.filter((w, i) => !(i > 0 && isState(w) && !isState(wants[i - 1])));
  // A state the student chose as a whole ("Anywhere in Texas") stays, even next to a metro or after a city.
  wants = [...wants, ...wholeStates];
  const loc = ` ${job.location} ${job.format} `.toLowerCase();
  // Virtual and remote postings can be done from anywhere, so they match every region.
  // ...unless the posting names another country ("Virtual, BR", "Remote - Canada").
  if (/remote|virtual|online/.test(loc) && !abroad(job.location)) return true;
  // Texas metros: a posting that names only other states ("Arlington, VA", "Plano, IL") isn't in Texas.
  const states = [...` ${job.location} `.matchAll(new RegExp(`[,\\s](${STATE})(?=[\\s,;)]|$)`, "g"))].map((m) => m[1].toLowerCase());
  const elsewhere = states.length > 0 && !states.includes("tx") && !/texas/i.test(job.location);
  return wants.some((w) => {
    const key = Object.keys(METRO).find((k) => w.includes(k));
    if (key && key !== "remote" && elsewhere) return false;
    // A state name also matches its abbreviation ("California" → "Glendale, CA").
    const a = STATE.split("|")[STATE_NAMES.indexOf(w)]?.toLowerCase() || (isState(w) ? w : undefined);
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
const studentAdded = (job: Job) => job.origin === "imported" && !/job board|researcher/i.test(job.sourceName || "");
/** The fields a student CHOSE, as text: their target roles and their major. "Undecided" isn't a field, and what
 *  they said they enjoy (profile.interests, e.g. "working with people") isn't a choice of field either. */
export const chosenFieldText = (p: Pick<Workspace["profile"], "targetRoles" | "major">) =>
  [p.targetRoles, /undecided|undeclared|exploring|not sure/i.test(p.major || "") ? "" : p.major].join(" ");

/** true / false when the student named fields Remy recognizes; null when not.
 *  Only fields the student CHOSE (target roles, major) can rule a posting out. What they said they enjoy
 *  ("working with people") can make a posting match, but never hides one: an undecided student chose no field. */
export function fieldMatch(ws: Workspace, job: Job): boolean | null {
  const p = ws.profile;
  const titlesFor = (s: string) => FIELD_TITLES.filter(([field]) => field.test(s)).map(([, title]) => title);
  const chosen = titlesFor(chosenFieldText(p));
  const liked = titlesFor(p.interests || "");
  // Conferences were found for the student's field already; their names ("NABA Convention") aren't job titles.
  if ((!chosen.length && !liked.length) || job.kind === "event") return null;
  if ([...chosen, ...liked].some((t) => t.test(job.title))) return true;
  return chosen.length ? false : null;
}

const TYPE_OF: Record<Job["kind"], string> = { internship: "internship", job: "full-time", program: "program", campus: "campus", event: "event" };
export function typeMatch(ws: Workspace, job: Job): boolean | null {
  const t = (ws.profile.opportunityTypes || "").toLowerCase();
  if (!t.trim()) return null;
  const k = TYPE_OF[job.kind];
  if (k === "internship") return /intern/.test(t);
  // "Part-time / campus jobs" has the word "jobs" in it but isn't a wish for full-time work.
  if (k === "full-time") return /full|job/.test(t.replace(/part[- ]?time(\s*\/\s*campus)?(\s+jobs?)?|campus jobs?/g, ""));
  if (k === "program") return /program|insight|intern/.test(t);
  if (k === "campus") return /part|campus/.test(t);
  // Summits and insight events are what "Programs & insight days" means in practice.
  return /event|competition|career fair|network|insight/.test(t) || /competition/i.test(job.title) && /competition/.test(t);
}

/** Why a posting is ruled out by something the student told Remy, or "" if nothing does:
 *  they need visa sponsorship and the posting won't sponsor; it's for MBA/graduate students and they're
 *  an undergraduate; it's in something they said to avoid; or it names a summer they didn't pick. */
export function dealbreaker(ws: Workspace, job: Job, today = new Date()): string {
  return notEligible(ws, job, today) || notWanted(ws, job);
}

/** A rule in the posting the student doesn't meet (shown as "Not eligible"), or "". */
export function notEligible(ws: Workspace, job: Job, today = new Date()): string {
  const p = ws.profile;
  const text = `${job.title} ${job.eligibility.join(" ")} ${job.summary} ${job.postingText || ""}`;
  if (/sponsor|visa|f-?1|opt\b|h-?1b/i.test(p.workAuth || "") && /\b(?:no|not|unable to|cannot|will not|won't|does not)\b[^.]{0,40}\bsponsor|without (?:the need for )?(?:current or future |now or in the future )?(?:visa |employment )?sponsorship|not eligible for (?:visa )?sponsorship/i.test(text))
    return "This posting says it won't sponsor a work visa, and you told Remy you'll need sponsorship.";
  const citizensOnly = citizensOnlySentence(text);
  if (/sponsor|visa|f-?1|opt\b|h-?1b/i.test(p.workAuth || "") && citizensOnly)
    return `This posting is only for U.S. citizens: “${citizensOnly.trim().slice(0, 160)}”, and you told Remy you'll need sponsorship.`;
  if (classYearOf(ws, today) !== "Graduate student" && /\bMBA\b(?! or undergraduate)|(?:currently )?(?:enrolled in|pursuing) an? (?:master'?s|graduate|ph\.?d)/i.test(`${job.title} ${job.eligibility.join(" ")} ${job.summary} ${job.requirements.map((r) => `${r.keyword} ${r.quote}`).join(" ")}`))
    return "This one is for MBA or graduate students.";
  if (/\bhigh[- ]school\b/i.test(job.title) && p.path !== "high-school" && classYearOf(ws, today) !== "") return "This one is for high school students.";
  // Openings for college students, when the student isn't in college (trade school, apprenticeship, high school, working, military).
  // Community college counts as college, except where the posting asks for a bachelor's or four-year program.
  const elig = [job.title, ...job.eligibility].join(". ");
  const forCollege = /\bundergrad(uate)?s?\b|\b(enrolled|enrollment|pursuing|working toward|currently attending)\b[^.]{0,60}\b(college|university|bachelor'?s|undergraduate|degree)\b/i;
  const forFourYear = /\b(enrolled|enrollment|pursuing|working toward)\b[^.]{0,60}\b(bachelor'?s|four-year|4-year)\b/i;
  const notCollege = ["trade", "apprenticeship", "high-school", "working", "military"].includes(p.path || "");
  // Postings that also take high school, trade or certificate students don't rule this student out.
  if (notCollege && !/\bhigh[- ]school\b|\btrade\b|\btechnical\b|\bvocational\b|\bcertificate\b|\bapprentice/i.test(elig) && forCollege.test(elig)) return `This one is for college students: “${quoteOf(elig, forCollege)}”.`;
  if (p.path === "community-college" && !/\bassociate'?s?\b/i.test(elig) && forFourYear.test(elig)) return `This one asks for a bachelor's program: “${quoteOf(elig, forFourYear)}”.`;
  // A full-time job that needs a finished bachelor's, for a student more than a year from graduating.
  const g = gradDate(ws), months = g ? g.y * 12 + g.m - (today.getFullYear() * 12 + today.getMonth() + 1) : 0;
  // Only a sentence that says the degree is required; "preferred", "or equivalent experience" and "in progress" don't count.
  const degreeNeeded = text.split(/(?<=[.;!?])\s+|\n+/).some((x) =>
    /\bbachelor'?s\b[^.]{0,60}\b(required|must)\b|\b(requires?|must have|minimum(?: of)?|completed?)\b[^.]{0,30}\bbachelor'?s\b/i.test(x) &&
    !/\b(preferred|equivalent|a plus|in progress|pursuing|expected|candidate|currently enrolled|working toward)\b/i.test(x));
  const studentRole = /\b(intern|internship|co-?op|apprentice|summer|student|extern|fellow|campus)\b/i.test(job.title);
  const takesStudents = /\b(pursuing|currently enrolled|working toward)\b[^.]{0,40}\bbachelor/i.test(text);
  if (job.kind === "job" && !studentRole && months > 12 && degreeNeeded && !takesStudents)
    return `This job asks for a finished bachelor's degree, and you expect to finish in ${ws.profile.graduation || g!.y}.`;
  return "";
}

/** Something the student said they don't want (hidden, but not a question of qualifying), or "". */
function notWanted(ws: Workspace, job: Job): string {
  const p = ws.profile;
  // Things to leave out: whole words (avoiding "sales" doesn't hide "Salesforce"), with trailing words like "roles" or
  // "companies" dropped ("defense sales roles" → "defense sales"), in the company, the title or the skills it requires.
  const required = job.requirements.map((r) => r.keyword).join(" ; ");
  for (const raw of (p.avoid || "").split(/[,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => x.length > 2)) {
    const a = raw.replace(/\s+(roles?|jobs?|positions?|work|companies|company|industry|industries|firms?)$/i, "").trim();
    if (a.length < 3) continue;
    const re = new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?(?![a-z0-9])`, "i");
    if (re.test(`${job.company} ${job.title}`)) return `You told Remy to avoid "${raw}".`;
    if (re.test(required)) return `This posting asks for "${a}", which you told Remy to avoid.`;
  }
  const want = [...(p.timeline || "").matchAll(/summer\s*(20\d\d)/gi)].map((m) => m[1]);
  const named = job.title.match(/summer\s*(20\d\d)|(20\d\d)\s*summer/i);
  const y = named && (named[1] || named[2]);
  if (want.length && y && !want.includes(y)) return `This is for Summer ${y}; you're looking for ${want.map((w) => "Summer " + w).join(" or ")}.`;
  return "";
}

// Words in a major or target role that say nothing about the field ("Bachelor of Science in…", "engineering intern").
const GENERIC_TITLE_WORDS = new Set(["with", "and", "for", "certification", "certificate", "minor", "engineer", "engineering", "business", "intern", "internship", "analyst", "associate", "science", "sciences", "studies", "student", "program", "summer", "major", "minor", "degree", "bachelor", "master", "technology", "general", "role", "roles", "position", "entry", "level", "career", "work", "certificate", "and"].map(family));

// Bump when the fit rules change, so verdicts saved under older rules are worked out again.
/** Why an opening outside the student's places is still worth showing, from their own "Open to relocating?" answer
 *  (council, Nov 19): "Yes" keeps every one; "For the right role" keeps one with a reason they'd recognize (a dream
 *  employer, or a title in their own field words); "No" or no answer keeps them to their places (""). */
export function relocateReason(ws: Workspace, title: string, company: string): string {
  const r = (ws.profile.relocation || "").trim().toLowerCase();
  if (r === "yes") return "you're open to relocating";
  if (r !== "for the right role") return "";
  // Same employer however it's written ("J.P. Morgan" = "JPMorgan Chase & Co."), never a short name inside another
  // ("EY" isn't Disney): shared/org.ts.
  const dream = (ws.profile.dreamEmployers || "").split(/[,;]+/).map((d) => d.trim()).filter((d) => d.length > 1);
  if (company.trim() && dream.some((d) => sameEmployer(d, company))) return `${company} is a dream employer`;
  const own = [...families(`${ws.profile.major} ${ws.profile.targetRoles}`)].filter((f) => f.length >= 4 && !GENERIC_TITLE_WORDS.has(f));
  const hit = own.filter((f) => families(title).has(f));
  return hit.length ? "the title is in your field" : "";
}

export const FIT_RULES_VERSION = 17; // 17: out-of-area openings say why they're shown (relocation answer). 16: "Anywhere in Texas" means Texas, not anywhere (it switched location off). 15: "Microsoft Excel" is the resume's "Excel"; "Microsoft Office" is shown by its apps. 14: what a student enjoys never hides an opening, only fields they chose. 13: U.S.-citizens-only rule, license/major cautions, legal notices aren't skills. 12: avoid list matches whole words and required skills. 11: titles naming the student's own field words rank first. 10: jobs abroad aren't local, US towns with foreign names are. 9: "You qualify" only for a rule Remy checked; college-only and finished-degree rules; hidden-by-preference is its own line. 8: skills are the posting's own words ("Excel", not "Software Skills"). 7: skills match by word family, not their first 5 letters ("pivot tables" isn't Tableau). 6: "Arlington, VA" isn't DFW
export function computeFit(ws: Workspace, job: Job, evidence: string): JobFit {
  const g = gradDate(ws);
  const year = classYearOf(ws);
  let eligibility: JobFit["eligibility"] = "unknown";
  // True only when the posting states a rule Remy checked and the student meets it; that's when "You qualify" shows.
  let checked = false;
  let note = "Add your class year or expected graduation date so Remy can check eligibility.";
  let excluded = false;
  const elig = [job.eligibility.join(" "), job.title].join(" ");
  const range = elig.match(/between\s+([A-Za-z]+)\s+(\d{4})\s+and\s+([A-Za-z]+)\s+(\d{4})/i) || elig.match(/graduating\s+([A-Za-z]+)\s+(\d{4})\s*[–-]\s*([A-Za-z]+)\s+(\d{4})/i);
  const classOf = elig.match(/class of (\d{4})/i);
  const years = requiredYears(elig);
  // A class year in the title ("Sophomore Summer Analyst") is a restriction, not a hint.
  if (years && requiredYears(job.title)) years.definite = true;
  if (ws.profile.path === "high-school" && (range || classOf)) {
    // Graduation years in a posting are college graduation years.
    eligibility = "unlikely";
    excluded = true;
    note = "This posting's graduation rule is for college students.";
  } else if (g && range) {
    const v = g.y * 12 + g.m;
    const a = +range[2] * 12 + (MONTHS[range[1].slice(0, 3).toLowerCase()] || 1);
    const b = +range[4] * 12 + (MONTHS[range[3].slice(0, 3).toLowerCase()] || 12);
    eligibility = v >= a && v <= b ? "likely" : "unlikely";
    checked = eligibility === "likely";
    excluded = eligibility === "unlikely";
    note = `This posting asks for graduation between ${range[1]} ${range[2]} and ${range[3]} ${range[4]}; you expect ${ws.profile.graduation || g.y}.`;
  } else if (g && classOf) {
    eligibility = +classOf[1] === g.y ? "likely" : "unlikely";
    checked = eligibility === "likely";
    excluded = eligibility === "unlikely";
    note = `This posting is for the Class of ${classOf[1]}; you expect to graduate in ${g.y}.`;
  } else if (years) {
    const list = [...years.years].join(" or ");
    if (ws.profile.path === "high-school") {
      // "Seniors" in a posting means college seniors.
      eligibility = "unlikely";
      excluded = true;
      note = `This posting is for college ${list.toLowerCase()} students.`;
    } else if (!year) {
      eligibility = "unknown";
      note = `This posting is for ${list.toLowerCase()} students. Add your class year and Remy will check it for you.`;
    } else if (year !== "Graduate student" && years.years.has(year)) {
      eligibility = "likely";
      checked = true;
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
    if (myGpa && myGpa < +minGpa[1]) { eligibility = "unlikely"; checked = false; note = `This posting asks for a ${minGpa[1]} GPA; yours is ${ws.profile.gpa}.`; }
    else if (myGpa) { note += ` It asks for a ${minGpa[1]} GPA, and yours is ${ws.profile.gpa}.`; if (eligibility === "likely") checked = true; }
    else note += ` It asks for a ${minGpa[1]} GPA; add yours in your profile and Remy will check it.`;
  }
  // Rules Remy can't fully check from the profile (a license, a list of majors): said plainly, not hidden.
  const caution = cautionFor(ws, job, evidence);
  if (caution && eligibility !== "unlikely") note = `${note} ${caution}`.trim();
  // Remy doesn't show what the student clearly can't apply for (they can still choose "Show anyway").
  if (eligibility === "unlikely") excluded = true;

  const matched: string[] = [];
  const gaps: string[] = [];
  const skills = postingSkills(job.requirements);
  for (const k of skills) {
    if (hasKeyword(evidence, k)) matched.push(k);
    else gaps.push(k);
  }
  const why = matched.length
    ? `You already show ${matched.slice(0, 3).join(", ")}${matched.length > 3 ? ` and ${matched.length - 3} more` : ""} — that's what this posting asks for.`
    : !skills.length ? (ws.resume ? "Remy couldn't read the skills this posting asks for. Open it to check, or tap Explain fit." : "Upload your resume and Remy will show how your experience lines up.")
    : ws.resume ? "This one would be a stretch for you right now: your resume doesn't show its main asks yet, but it's worth exploring." : "Upload your resume and Remy will show how your experience lines up.";

  const region = regionMatch(ws, job);
  const type = typeMatch(ws, job);
  const field = fieldMatch(ws, job);
  // A rule the student doesn't meet (MBA only, college only, needs a finished degree, no sponsorship): not eligible.
  const ruledOut = studentAdded(job) ? "" : notEligible(ws, job);
  if (ruledOut) { eligibility = "unlikely"; checked = false; excluded = true; note = ruledOut; }
  // Hidden because of what the student said they want (field, kind of opportunity, things to avoid, which summer).
  // That says nothing about qualifying, so it goes in its own line instead of the eligibility note.
  let hidden = "";
  if (!studentAdded(job)) hidden = field === false ? "This isn't in the fields you chose." : type === false ? "This isn't the kind of opportunity you chose." : notWanted(ws, job);
  if (hidden) excluded = true;
  const req = skills.length || 1;
  // Field first: a title with the student's own words (major, target roles: "Mechanical", "Investment Banking",
  // "Economic Research") ranks well above one that only fits their broad field ("Hardware Engineer").
  const own = [...families(`${ws.profile.major} ${ws.profile.targetRoles}`)].filter((f) => f.length >= 4 && !GENERIC_TITLE_WORDS.has(f));
  const titleWords = families(job.title);
  const specific = own.some((f) => titleWords.has(f));
  const score = Math.round(
    (specific ? 20 : field === true ? 6 : 0) +
    ({ likely: 40, check: 22, unknown: 18, unlikely: 0 } as const)[eligibility] +
      30 * (matched.length / req) +
      (region === true ? 15 : region === false ? -15 : 0) +
      (type === true ? 10 : type === false ? -10 : 0) +
      (job.label === "Live" ? 5 : 0) +
      // Discovery days and insight programs are built for first-years and sophomores (NABA: EY, PwC).
      (job.kind === "program" && (year === "First-year" || year === "Sophomore") ? 12 : 0),
  );
  return { at: new Date().toISOString(), by: "rules", v: FIT_RULES_VERSION, eligibility, eligibilityNote: note, checked, ...(hidden ? { hidden } : {}), matched, gaps, why, excluded, score, regionMatch: region, ...(region === false && relocateReason(ws, job.title, job.company) ? { relocate: relocateReason(ws, job.title, job.company) } : {}), typeMatch: type };
}

// "Summer 2026" offered in October 2026: a term that has already started or ended (the AI doesn't always know the date).
const TERM_MONTH: Record<string, number> = { spring: 1, summer: 5, fall: 8, autumn: 8, winter: 12 };
export function pastTerm(text: string, today: string) {
  const m = text.toLowerCase().match(/\b(spring|summer|fall|autumn|winter)\s+(20\d\d)\b/);
  if (!m) return false;
  const [y, mo] = today.split("-").map(Number);
  return Number(m[2]) * 12 + TERM_MONTH[m[1]] <= y * 12 + mo;
}

const LICENSES = "RN|LVN|LPN|CNA|EMT|paramedic|CPA|teaching|teacher|real estate|insurance|pharmacy technician|CDL|nursing";
/** Things a posting requires that Remy can't verify, so the student checks before spending time on it: a license
 *  their resume doesn't show, or a list of majors that doesn't include theirs. Never hides the opening. "" if none. */
export function cautionFor(ws: Workspace, job: Job, evidence: string): string {
  const text = `${job.eligibility.join(" ")} ${job.postingText || ""}`;
  const out: string[] = [];
  const lic = text.match(new RegExp(`\\b(?:must (?:hold|have|possess)|requires?|required:?)\\s+(?:an?\\s+)?(?:active |current |valid |unrestricted )?(?:texas |state )?(${LICENSES})\\s+(?:license|licensure|certification|certificate)\\b|\\b(?:active |current |valid |unrestricted )?(${LICENSES})\\s+(?:license|licensure|certification|certificate)\\s+(?:is\\s+)?(?:required|needed)\\b`, "i"));
  const name = lic && (lic[1] || lic[2]);
  // "upon hire", "within 2 years", "or willingness to obtain": something they get on the job, not a bar to applying.
  // Only the rest of the same sentence counts ("…required. Must be eligible to work in the US" is a different rule).
  const near = lic && lic.index !== undefined ? text.slice(lic.index, lic.index + lic[0].length + 100).split(/(?<=[a-z0-9]{2}[.!?])\s/)[0] : "";
  const later = /\b(?:upon hire|after hire|within \d+ (?:days?|months?|years?)|willing(?:ness)? to obtain|ability to obtain|or be \w+ eligible|eligible to (?:sit|obtain|apply for)|obtain(?:ed)? (?:within|after|by)|interns? (?:are|is) not)\b/i.test(near);
  if (name && !later && !new RegExp(`\\b${name}\\b`, "i").test(evidence))
    out.push(`It requires ${/^[aeiouAEIOU]|^(?:RN|LVN|LPN|EMT|MIS)$/.test(name) ? "an" : "a"} ${name} license or certification, which Remy doesn't see on your resume; check before applying.`);
  // "Majors in Accounting or Finance": only a firm list (no "related field", "any major", "such as", "preferred").
  const sentence = job.eligibility.join(". ").split(/(?<=[.!?])\s+|\n+/).find((x) => /\b(?:majoring in|majors? in|major(?:s)?:|degree in)\b/i.test(x));
  const major = (ws.profile.major || "").trim();
  if (sentence && major && !/related|similar|equivalent|any major|all majors|any discipline|such as|e\.g\.|preferred|a plus|including but|also (?:considered|welcome|eligible)|other majors/i.test(sentence)) {
    const list = sentence.replace(/^.*?\b(?:majoring in|majors? in|majors?:|degree in)\s*/i, "").replace(/[.;]+$/, "").trim();
    // Short names postings use: CS, MIS, IS, Econ, Math, Stats, EE, ME, CE.
    const spelled = list.replace(/\bCS\b/g, "Computer Science").replace(/\bM?IS\b/g, "Information Systems").replace(/\bEcon\b/gi, "Economics")
      .replace(/\bMath\b/gi, "Mathematics").replace(/\bStats?\b/gi, "Statistics").replace(/\bEE\b/g, "Electrical Engineering").replace(/\bME\b/g, "Mechanical Engineering").replace(/\bCE\b/g, "Civil Engineering");
    const mine = [...families(major)].filter((f) => f.length >= 4 && !/^(bachelor|science|studi|degree|major|minor|master|art)/.test(f));
    if (list && mine.length && !mine.some((f) => families(spelled).has(f)))
      out.push(`It asks for a degree in ${list.slice(0, 120)}, and your major is ${major}; check before applying.`);
  }
  return out.join(" ");
}

/** The sentence that limits a posting to U.S. citizens, or "". A sentence that also lets others in ("citizens or
 *  permanent residents", "…and international students with OPT", "authorized to work") or says "not only" doesn't count. */
export function citizensOnlySentence(text: string): string {
  const CITIZEN = /\b(?:u\.?\s?s\.?|united states)\s+citizen(?:s|ship)?\b/i;
  const LIMITS = /\b(?:must be|must hold|required|requires|only|exclusively|limited to|restricted to)\b/i;
  // Groups a sentence also lets in ("…or permanent residents", "…and international students with OPT").
  const OTHERS = /\b(?:permanent residents?|green card|authori[sz]ed|eligible to work|work authori[sz]ation|international|foreign nationals?|non-?citizens?|opt|cpt|visa holders?|lawful|refugees?|asylees?|daca)\b/i;
  // Not a limit: "non-U.S. citizens", "is not required", "citizenship status", "may be required for certain projects".
  const SOFT = /\bnon[- ]?(?:u\.?\s?s\.?|united states)|\b(?:not|no|never|some|certain|except|unless|preferred|encouraged|welcome)\b|\b(?:may|might)(?: be)? requir|citizenship status/i;
  // Sentence ends need two lowercase letters before the stop, so "U.S. citizen" isn't cut at "U.S.".
  for (const sentence of text.split(/(?<=[a-z0-9]{2}[.!?]|;)\s+|\n+/)) {
    const m = sentence.match(CITIZEN);
    if (!m || m.index === undefined || !LIMITS.test(sentence) || SOFT.test(sentence)) continue;
    // What follows "citizen(s)" in the same sentence: "or permanent residents", ", and international students…".
    if (OTHERS.test(sentence.slice(m.index + m[0].length))) continue;
    return sentence;
  }
  return "";
}

/** The openings the plan may mention, one per line with where each is. Nearby ones only, when there are any. */
export const planJobs = (open: Job[], near: (j: Job) => boolean): string => {
  const nearby = open.filter(near);
  return (nearby.length ? nearby : open).map((j) => `${j.id}: ${j.company} — ${j.title}, ${j.location || "location not stated"} (deadline ${j.deadline || "n/a"})`).join("\n");
};
