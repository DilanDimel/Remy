// The field chips students pick in setup, grouped so every kind of student sees their area
// (each label must match a field in server/jobs/fit.ts FIELDS; fit.test.ts checks this).
export const FIELD_GROUPS: [string, string[]][] = [
  ["Business", ["Finance", "Investment banking", "Accounting", "Consulting", "Marketing", "Sales", "Business & management", "Entrepreneurship", "Human resources", "Supply chain & operations", "Real estate"]],
  ["Tech & engineering", ["Software & computer science", "Data & analytics", "Information systems & IT", "Cybersecurity", "Engineering", "Architecture & construction", "Aviation"]],
  ["Health & science", ["Healthcare & medicine", "Nursing", "Science & research", "Environment & sustainability"]],
  ["People & public service", ["Education & teaching", "Psychology & social work", "Law & government", "Public safety", "Nonprofit & ministry"]],
  ["Creative & media", ["Art & design", "Film, theater & music", "Journalism & communications"]],
  ["Other", ["Hospitality & events", "Sports & recreation"]],
];

/** Majors and goals that point to each field choice, so setup can open the right groups first
 *  (whole words and stems, after server/jobs/fit.ts FIELDS; "science" alone points nowhere). */
export const FIELD_MAJORS: Record<string, RegExp> = {
  "Finance": /financ|bank|invest|fintech|econ|wealth/i,
  "Investment banking": /investment bank|\bm&a\b/i,
  "Accounting": /account|\bcpa\b|audit|\btax/i,
  "Consulting": /consult/i,
  "Marketing": /marketing|brand|advertis|public relations|\bpr\b|social media/i,
  "Sales": /\bsales\b|business development/i,
  "Business & management": /management|business admin|\bbba\b|general business/i,
  "Entrepreneurship": /entrepreneur|startup/i,
  "Human resources": /human resources|\bhr\b|talent|recruit/i,
  "Supply chain & operations": /supply chain|operations|logistics/i,
  "Real estate": /real estate|property/i,
  "Software & computer science": /software|computer science|computer engineering|\bcs\b|programming/i,
  "Data & analytics": /\bdata\b|analytic|statistic/i,
  "Information systems & IT": /information systems|\bbis\b|\bmis\b|information technology/i,
  "Cybersecurity": /cyber/i,
  "Engineering": /mechanical|civil|electrical|industrial|aerospace|chemical|biomedical|manufacturing|petroleum|\bengineering\b/i,
  "Architecture & construction": /architect|construction|interior design|urban planning/i,
  "Aviation": /aviation|pilot|flight/i,
  "Healthcare & medicine": /health|pre-?med|medicine|medical|pharma|dental|kinesiolog|nutrition|physical therapy/i,
  "Nursing": /nurs/i,
  "Science & research": /biology|chemistry|physics|neuroscience|geology|biochem/i,
  "Environment & sustainability": /environment|sustainab|agricultur|ranch|conservation|\benergy\b/i,
  "Education & teaching": /educat|teach/i,
  "Psychology & social work": /psycholog|social work|counsel|sociolog|child development/i,
  "Law & government": /\blaw\b|legal|pre-?law|political science|government|public policy|international relations/i,
  "Public safety": /criminal justice|criminology|fire science|police|military|homeland/i,
  "Nonprofit & ministry": /nonprofit|non-profit|ministry|religio|social impact/i,
  "Art & design": /\bart\b|\barts\b|graphic design|\bdesign\b|fashion|photograph|animation/i,
  "Film, theater & music": /\bfilm|theat(er|re)|acting|\bmusic|\bdance/i,
  "Journalism & communications": /journalis|\benglish\b|writing|communication|broadcast|\bmedia\b/i,
  "Hospitality & events": /hospitality|hotel|\bevent|tourism|culinary/i,
  "Sports & recreation": /\bsport|athletic|recreation|exercise science|coaching/i,
};

/** A saved comma list of field choices back into choices; "Film, theater & music" has a comma of its own. */
export function splitFieldList(s: string): string[] {
  let rest = s || "";
  const found: string[] = [];
  for (const o of FIELD_GROUPS.flatMap(([, opts]) => opts).filter((o) => o.includes(","))) if (rest.includes(o)) { found.push(o); rest = rest.split(o).join(""); }
  return [...found, ...rest.split(",").map((x) => x.trim()).filter(Boolean)];
}

/** The field a major or goal points to (first match in FIELD_MAJORS order), or "". */
export const fieldFor = (text: string) => Object.entries(FIELD_MAJORS).find(([, re]) => re.test(text || ""))?.[0] || "";

// Illustrative examples (labelled "Example" in the app) that follow the student's own field, so a nursing
// student never sees "your finance major": [role, what on a resume backs it, a next step, a pitch line].
const FIELD_EXAMPLES: Record<string, [string, string, string, string]> = {
  "Finance": ["Financial Analyst", "Excel work", "learn SQL basics, then ask one analyst for a coffee chat", "built a DCF model in a banking simulation"],
  "Investment banking": ["Investment Banking Analyst", "Excel modeling", "practice a DCF, then ask one analyst for a coffee chat", "built a DCF model in a banking simulation"],
  "Accounting": ["Audit Associate", "bookkeeping work", "start CPA exam prep, then ask one auditor for a coffee chat", "reconciled my club's budget every month"],
  "Marketing": ["Marketing Coordinator", "social media work", "learn Google Analytics, then ask one marketer for a coffee chat", "grew my club's Instagram with a weekly posting plan"],
  "Software & computer science": ["Software Engineer", "class projects", "ship one small app, then ask one engineer for a coffee chat", "built a web app for a class project"],
  "Data & analytics": ["Data Analyst", "statistics coursework", "learn SQL basics, then ask one analyst for a coffee chat", "analyzed survey data for a class project"],
  "Engineering": ["Design Engineer", "CAD project", "learn SolidWorks basics, then ask one engineer for a coffee chat", "built a working prototype in my design class"],
  "Healthcare & medicine": ["Medical Scribe", "patient care volunteering", "shadow one clinician, then ask them for a coffee chat", "volunteered at a community clinic"],
  "Nursing": ["Registered Nurse", "patient care volunteering", "keep your BLS card current, then ask one nurse for a coffee chat", "volunteered on a hospital unit helping nurses with patient rounds"],
  "Science & research": ["Research Assistant", "lab coursework", "ask one professor about joining their lab", "ran experiments in a research lab"],
  "Education & teaching": ["Teacher", "tutoring", "observe one classroom, then ask the teacher for a coffee chat", "tutored middle schoolers in math"],
  "Psychology & social work": ["Case Manager", "volunteering", "volunteer at a crisis line, then ask one social worker for a coffee chat", "volunteered at a youth center"],
  "Law & government": ["Legislative Aide", "research papers", "attend one city council meeting, then ask a staffer for a coffee chat", "wrote a policy brief for a class"],
  "Journalism & communications": ["Communications Coordinator", "writing samples", "publish one article, then ask one editor for a coffee chat", "wrote for the student newspaper"],
  "Art & design": ["Graphic Designer", "portfolio pieces", "post your portfolio, then ask one designer for a coffee chat", "designed posters for campus events"],
};
/** An example that matches the student's major, or a field-neutral one. */
export function fieldExample(major: string) {
  const field = fieldFor(major);
  const [role, proof, next, did] = FIELD_EXAMPLES[field] || ["Program Coordinator", "club leadership", "ask one person in a role you like for a coffee chat", "organized a campus event for 200 students"];
  const subject = FIELD_EXAMPLES[field] ? field.split(" &")[0].toLowerCase() : (major || "").trim().toLowerCase();
  return { role, proof, next, did, subject };
}
