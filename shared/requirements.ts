import { families } from "./words";
// Requirement "keywords" that are really eligibility labels or headings ("Minimum GPA", "Eligible majors", "Core skills"):
// eligibility is checked separately, so these are never shown as skills or counted as gaps.
const LABEL = /\b(gpa|grade point|majors?|academic standing|class (year|standing)|graduat\w*|enroll\w*|degree|work authori[sz]ation|citizenship|sponsorship|eligib\w*)\b|^(core|key|required|preferred|minimum|basic)?\s*(skills|qualifications|requirements)$/i;
export const isSkill = (keyword: string) => !LABEL.test(keyword.trim());

// Labels that name a kind of requirement, not a skill ("Software Skills", "Prior Experience", "Driver's License").
const CATEGORY = /^((technical|software|computer|core|key|soft|hard|relevant|required|preferred|prior|previous|work|industry|professional|programming|physical|general)\s+)?(skills?|software|tools|languages?|technolog(y|ies)|proficienc(y|ies)|certifications?|licen[sc]es?|qualifications?|experience|internships?|knowledge|abilities|competenc(y|ies)|requirements?)$/i;
// Requirements that are hiring steps or eligibility, not skills (shared with the ATS check).
const NOT_SKILL = /\b(?:freshm|first-year|sophom|junior|senior|class of|gpa|graduat|enrolled|authoriz|sponsor|citizen|applica|apply|assessment|hirevue|predictive index|transcript|resume|cv\b|cover letter|interview|deadline|diversity|interest|motivat|curious|passion|work ethic|eligib|academic record|degree in progress|background check|drug (test|screen)|driver'?s licen)/i;
export const isSkillKeyword = (k: string) => !NOT_SKILL.test(k);

// Skills and tools a posting can name, across fields, most specific first: when a posting names more than
// Remy keeps, tools win over broad words like "operations" or "research".
const SKILL_TERMS = [
  // tools
  "Excel", "PowerPoint", "Microsoft Word", "Microsoft Office", "Outlook", "Google Sheets", "SQL", "R", "Python", "Tableau", "Power BI", "SPSS", "Stata", "SAS",
  "QuickBooks", "SAP", "Bloomberg", "Java", "JavaScript", "TypeScript", "C++", "C#", "HTML", "CSS", "React", "Git", "GitHub", "AWS", "Linux",
  "MATLAB", "SolidWorks", "AutoCAD", "CAD", "Revit", "LabVIEW", "Arduino", "Fusion 360", "CATIA",
  "Salesforce", "HubSpot", "CRM", "Photoshop", "Illustrator", "InDesign", "Figma", "Canva", "Premiere Pro", "Adobe Creative Suite",
  "Epic", "EHR", "CPR", "BLS", "ACLS", "First Aid", "OSHA", "GAAP",
  // specific skills
  "financial modeling", "valuation", "auditing", "bookkeeping", "budgeting", "data analysis", "machine learning", "market research", "social media", "copywriting",
  "phlebotomy", "patient care", "forklift", "welding", "blueprint reading", "customer service", "project management", "public speaking", "written communication",
  "content creation", "Spanish", "bilingual",
  // broad words (last)
  "accounting", "statistics", "sales", "presentation", "communication", "teamwork", "leadership", "problem solving", "attention to detail", "time management",
  "finance", "economics", "analytics", "operations", "consulting", "computer science", "research",
];
// Field names: in "pursuing a degree in Finance or Economics" they're majors, not skills to show.
const FIELDS = new Set(["finance", "economics", "accounting", "statistics", "computer science", "analytics", "operations", "sales", "consulting", "research"]);
const DEGREE = /\b(degree|majors?|majoring|enrolled|bachelor'?s?|b\.?[sa]\.?|bba|graduat\w*|students? (in|of|studying))\b/i;
const rank = new Map(SKILL_TERMS.map((t, i) => [t, i]));
const isField = (t: string) => t.toLowerCase().split(" or ").every((x) => FIELDS.has(x));

// Brand names that are also everyday words ("excel", "react", "outlook", "epic") and one- or two-letter names
// ("R") match only as written; everything else ignores case ("python", "sql", "first aid"). No match inside
// "R&D", "C++"-style names or longer words.
const AMBIG = new Set(["Excel", "React", "Outlook", "Epic", "Bloomberg", "Spanish", "Canva"]);
const termRe = (t: string) => {
  const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = AMBIG.has(t) || t.length <= 2;
  return new RegExp(`(?<![\\w&])(?:${esc}${exact ? `|${esc.toUpperCase()}` : ""})(?![\\w&+#])`, exact ? "" : "i");
};
const TERMS = SKILL_TERMS.map((t) => ({ t, re: termRe(t) }));
// Everyday phrases that contain a tool's name.
export const plainEnglish = (text: string) => text
  .replace(/\b([A-Z][a-z]+) [A-Z]\. (?=[A-Z][a-z])/g, "$1 ")  // a middle initial ("Dilan R. Desman") isn't the R language
  .replace(/\b(excel)(s|led|ling)?\s+(in|at|as|under|when|with|on)\b/gi, "do well $3")
  .replace(/\b(react)(s|ed|ing)?\s+(to|quickly|calmly|well|appropriately)\b/gi, "respond $3")
  .replace(/\b(positive|optimistic|bright|career|economic|financial|global)\s+outlook\b/gi, "$1 view");

// Legal notices every posting carries aren't requirements ("EEOC Know Your Rights Poster in Spanish" isn't "Spanish").
// Postings only (a resume line "Processed E-Verify checks in Workday" keeps Workday). Dropped piece by piece between
// . ; and line breaks, so "Excel and SQL required; reasonable accommodations available" keeps Excel and SQL.
const NOTICE = /\b(?:EEOC?|equal (?:employment )?opportunity|know your rights|e-verify|pay transparency|reasonable accommodations?|affirmative action)\b/i;
export const withoutNotices = (text: string) => text.slice(0, 20000).split(/(?<=[.;\n])/).filter((piece) => !NOTICE.test(piece)).join("");

/** Known skills and tools a piece of text names, in the order it names them ("Python, Java or C++" stays one choice). */
export function skillsIn(text: string): string[] {
  const t = plainEnglish(text);
  const hits = TERMS.map((x) => { const m = x.re.exec(t); return m ? { t: x.t, at: m.index, end: m.index + m[0].length } : null; })
    .filter((x): x is { t: string; at: number; end: number } => !!x).sort((a, b) => a.at - b.at);
  const out: string[] = [];
  for (let i = 0; i < hits.length; i++) {
    let j = i;
    // Join a run of tools separated by commas/slashes that ends in "or": the posting asks for any one.
    // ("HTML/CSS" means both, so only the word "or" makes a choice.)
    while (j + 1 < hits.length && /^\s*(,|,?\s+or)\s*$/i.test(t.slice(hits[j].end, hits[j + 1].at))) j++;
    const run = hits.slice(i, j + 1);
    const ors = j > i && /\bor\b/i.test(t.slice(hits[i].end, hits[j].at));
    if (ors) { out.push(run.map((h) => h.t).join(" or ")); i = j; } else out.push(hits[i].t);
  }
  return out;
}

const fams = (s: string) => [...families(s)].filter((f) => !/^(skill|and|or|of|in|the|a|an|with|for|to|strong|good|excellent|advanced|proficien\w*|microsoft|ms|adobe|google)$/.test(f));

/** The skills a posting really asks for, in its own words: each requirement's label when the posting's
 *  sentence says it, plus every known skill or tool its sentence names. Category labels ("Software Skills"),
 *  eligibility ("Degree Program", "Driver's License") and majors in a degree sentence are left out. */
export function postingSkills(requirements: { keyword: string; quote: string }[]): string[] {
  const out: string[] = [];
  const covered = new Set<string>();
  const take = (k: string) => {
    const f = fams(k);
    if (!f.length || f.every((x) => covered.has(x))) return;
    out.push(k); f.forEach((x) => covered.add(x));
  };
  for (const r of requirements) {
    const label = r.keyword.trim(), quote = withoutNotices(r.quote || "");
    if (r.quote && !quote.trim()) continue; // the whole "requirement" was a legal notice
    const grounded = !quote || fams(label).every((f) => families(plainEnglish(quote)).has(f));
    const degree = DEGREE.test(quote);
    const terms = skillsIn(quote).filter((t) => !(degree && isField(t)));
    // "Python programming" in "Python, Java or C++": the choice of tools replaces the label.
    const inChoice = terms.some((t) => / or /.test(t) && fams(t).some((f) => fams(label).includes(f)));
    if (label && !inChoice && isSkill(label) && isSkillKeyword(label) && !CATEGORY.test(label) && grounded && !degree) take(label); // a label from a degree sentence is a major, not a skill
    for (const t of terms) take(t);
  }
  return out.slice(0, 15);
}

/** Posting text that isn't about the job: scam warnings, benefits and EEO lines, company history and team blurbs. Real
 *  postings (98, Nov 27) turned Palantir's "contacted by a scammer ... cease all communication" into a communication
 *  question and HPE's benefits link into an HTML one. */
const BOILERPLATE = /\b(?:scam\w*|fraud\w*|phishing|verify and apply|equal (?:employment )?opportunity|equitable access|reasonable accommodation|employee benefits|benefits (?:offered|package)|variable incentives|https?:\/\/|\d+-year history|network consists of|world['’]?s leading|world-changing)|\bthe [\w&,\- ]{2,40} team (?:delivers|provides|builds|maintains|works across|partners with)\b/i;
export const boilerplate = (s: string) => BOILERPLATE.test(s);

/** Up to `n` skills a posting's text names, most specific first, each with the sentence it came from. */
export function topSkills(sentences: string[], n: number): { keyword: string; quote: string }[] {
  const found: { keyword: string; quote: string; r: number }[] = [];
  for (const s of sentences) {
    if (boilerplate(s)) continue;
    if (DEGREE.test(s) && skillsIn(s).every(isField)) continue;
    for (const k of skillsIn(s)) if (!(DEGREE.test(s) && isField(k)) && !found.some((f) => f.keyword.toLowerCase() === k.toLowerCase())) found.push({ keyword: k, quote: s, r: Math.min(...k.split(" or ").map((x) => rank.get(x) ?? 999)) });
  }
  return found.sort((a, b) => a.r - b.r).slice(0, n).map(({ keyword, quote }) => ({ keyword, quote }));
}
