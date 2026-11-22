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
