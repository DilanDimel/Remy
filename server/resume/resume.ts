import type { Bullet, Entry, ResumeDoc, ResumeQuality, Section, SkillLine } from "@shared/types";
import { dropDates, skillGroupName, skillParts, splitList } from "@shared/words";
import { aiJson } from "../ai/ai";
import { uid } from "../platform/ids";
import { fold, norm } from "./parse";

// Resume text → ResumeDoc. Two readers share the same clean-up and checks: the
// AI reader (checked word-for-word against the file) and a rules-based reader,
// used without AI, when AI fails, or when the AI reading leaves part of the
// file out. Neither may add anything that isn't in the file.

// ---------- clean-up shared by both readers ----------
const LIGATURES: Record<string, string> = { "\ufb00": "ff", "\ufb01": "fi", "\ufb02": "fl", "\ufb03": "ffi", "\ufb04": "ffl", "\ufb05": "st", "\ufb06": "st" };
// Word and PDF exports use many bullet glyphs, including private-use Symbol/Wingdings code points.
const GLYPH_BULLET = /^[ \t]*(?:[•●○◦▪▫■□◆◇►▸▹▶➢➣➤➔→✓✔❖❑❒⦿⁃‣∙·\uf000-\uf0ff]|o(?=[ \t]))[ \t]*/gmu;
const PAGE_MARK = /^(?:page\s*\d+(?:\s*(?:of|\/)\s*\d+)?|[-–]?\s*\d{1,2}\s*[-–]?|\d{1,2}\s*\/\s*\d{1,2})$/i;
const RULE_LINE = /^[\s_=~*.·•–—-]{3,}$/; // "________" drawn as a divider

export function normalizeResumeText(raw: string): string {
  return raw
    .replace(/[\ufb00-\ufb06]/g, (c) => LIGATURES[c])
    .replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // full-width forms
    .normalize("NFC") // "e" + combining accent → "é"
    .replace(/\r\n?|[\u2028\u2029\f\v]/g, "\n")
    .replace(/[\u0000-\u0008\u000e-\u001f\u007f\ufffd]/g, " ") // control characters some PDF fonts emit for symbols like ✦
    .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, "")
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/(?<=\p{L})[´`](?=\p{L})/gu, "’") // "team´s" typed with the accent key
    .replace(GLYPH_BULLET, "• ")
    .split("\n")
    .map((l) => l.replace(/(?<=\S) {3,}(?=\S)/g, "\t").replace(/ {2,}/g, " ").replace(/ *\t[ \t]*/g, "\t").trim())
    .filter((l) => l && !PAGE_MARK.test(l) && !RULE_LINE.test(l))
    .join("\n");
}

// ---------- headings ----------
// A heading is a short phrase made only of these words, with at least one core word.
const CORE = new Set(
  ("education educacion formacion academics experience experiences experiencia employment projects proyectos activities actividades " +
    "extracurricular extracurriculars extracurriculares leadership liderazgo involvement volunteering voluntariado skills habilidades " +
    "competencies competencias proficiencies aptitudes certifications certificaciones certificates licenses licencias honors honours awards " +
    "premios reconocimientos distinciones achievements accomplishments logros athletics deportes coursework cursos scholarships becas " +
    "publications publicaciones presentations languages idiomas interests intereses hobbies references referencias summary resumen profile " +
    "perfil objective objetivo introduction qualifications affiliations memberships competitions concursos internships externships practicas expertise rotations").split(" "),
);
// Words that are headings in capitals ("RESEARCH") but too often names or roles in Title Case ("Research Assistant").
const WEAK = new Set(
  ("research volunteer service training sports arts history highlights courses organizations scores award honor project publication language " +
    "skill certification interest about internship externship information info links background portfolio development").split(" "),
);
const MODIFIER = new Set(
  ("additional other others relevant related selected professional technical computer academic campus community personal key core work " +
    "laboral profesional academica academico adicional adicionales otros otras test extra career industry international athletic artistic " +
    "artisticas musical creative military teaching summer class college customer graduate undergraduate student clinical healthcare nursing medical research lab laboratory engineering design areas management administrative executive freelance corporate legal retail hospitality government nonprofit sales marketing graphic security cyber practicum field culinary aviation construction me and of y e de del la las los en para").split(" "),
);
const headingWords = (s: string) => fold(s).split(/[\s&/+,]+/).map((w) => w.replace(/[^a-z]/g, "")).filter(Boolean);
function isHeadingPhrase(s: string, caps: boolean) {
  const words = headingWords(s);
  if (!words.length || words.length > 6 || /\d/.test(s)) return false;
  if (!words.every((w) => CORE.has(w) || WEAK.has(w) || MODIFIER.has(w))) return false;
  return words.some((w) => CORE.has(w)) || (words.some((w) => WEAK.has(w)) && (caps || words.length > 1));
}
const isCaps = (s: string) => /\p{L}/u.test(s) && s === s.toLocaleUpperCase();
const CONTINUED = /\s*(?:\((?:continued|cont'?d\.?|cont\.)\)|[-–—]\s*continued)\s*$/i;

/** "EXPERIENCE", "Work Experience", "ADDITIONAL SKILLS:", "SCHOLARSHIPS: Full ride…" and
 * "ADDITIONAL COURSEWORK “Game Theory”…" → the heading and any text that follows it. */
export function headingOf(line: string): { heading: string; rest: string; continued: boolean } | null {
  // A heading in its own left-hand column, with the section's first line beside it: "EDUCATION ⇥ Nazareth College".
  const margin = marginHeading(line);
  if (margin && isHeadingPhrase(margin.head, true)) return { heading: titleCase(margin.head), rest: margin.rest, continued: false };
  let t = line.replace(/\t+/g, " ").trim();
  if (!t || t.length > 140 || BULLET_RE.test(t)) return null;
  const continued = CONTINUED.test(t);
  t = t.replace(CONTINUED, "").trim();
  const out = (h: string, rest: string) => { const head = h.replace(/^[\s—–=*~•|:-]+|[\s—–=*~•|:-]+$/g, ""); return { heading: isCaps(head) ? titleCase(head) : head, rest: rest.trim(), continued }; };
  const colon = t.indexOf(":");
  if (colon > 0) {
    const head = t.slice(0, colon).trim();
    const rest = t.slice(colon + 1).trim();
    // "Relevant Coursework: Accounting…" is a detail line; "SCHOLARSHIPS: Full ride" is a heading.
    if (isHeadingPhrase(head, isCaps(head)) && (isCaps(head) || !rest)) return out(head, rest);
  }
  if (isHeadingPhrase(t, isCaps(t))) return out(t, "");
  // A capitals heading with the section's first line after it, e.g. ADDITIONAL COURSEWORK “Welcome…”.
  const words = t.split(" ");
  let n = 0;
  while (n < words.length && /^[\p{Lu}&/+'’.-]+$/u.test(words[n])) n++;
  for (let k = Math.min(n, 6); k > 0; k--) {
    const head = words.slice(0, k).join(" ");
    const rest = words.slice(k).join(" ");
    // The text after it must clearly start something else: a quote, a bracket, a number or a lower-case word.
    if (head.replace(/[^\p{L}]/gu, "").length >= 4 && isHeadingPhrase(head, true) && /^[“"'‘(\[\d]|^\p{Ll}/u.test(rest)) return out(head, rest);
  }
  return null;
}

/** The capitals in a line's first column, when the rest of the line sits in another column. */
function marginHeading(line: string) {
  const tab = line.indexOf("\t");
  if (tab <= 0) return null;
  const head = line.slice(0, tab).trim().replace(/:$/, "");
  return isCaps(head) && /^[\p{Lu}&/' -]+$/u.test(head) && head.split(/\s+/).length <= 4 ? { head, rest: line.slice(tab + 1).trim() } : null;
}
// Headings split over two or three lines of the left column: "INTERNSHIP ⇥ …" then "EXPERIENCE ⇥ …".
const MARGIN_FIRST = /^(internship|customer|service|college|campus|leadership|volunteer|research|work|professional|related|relevant|additional|other|teaching|community|honors|military|international|summer|technical|computer|academic|athletic|student)$/i;
const MARGIN_SECOND = /^(experience|employment|service|activities|history|awards|involvement|projects|skills|leadership|honors)$/i;
/** One word of a split margin heading. Later lines may lack the tab ("EMPLOYMENT Main Desk…") or be the bare word. */
function marginWord(line: string, later: boolean) {
  const m = marginHeading(line);
  if (m) return m.head.includes(" ") ? null : m;
  const bare = later ? line.match(/^(\p{Lu}{3,})(?:\s+(.*))?$/u) : null;
  return bare && MARGIN_SECOND.test(bare[1]) && !(bare[2] && isCaps(bare[2])) ? { head: bare[1], rest: (bare[2] || "").trim() } : null;
}

type Kind = "summary" | "skills" | "education" | "entries";
function kindOf(heading: string): Kind {
  const w = fold(heading);
  if (/\b(skills?|habilidades|competenc\w*|proficienc\w*|aptitudes|languages?|idiomas)\b/.test(w)) return "skills";
  if (/\b(summary|resumen|profile|perfil|objective|objetivo|introduction|about)\b/.test(w)) return "summary";
  if (/\b(education|educacion|formacion|academics|schooling)\b|academic (background|history)|^school\b/.test(w)) return "education";
  return "entries";
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[^\p{L}'’])(\p{L})/gu, (_m, pre, c) => pre + c.toUpperCase()).replace(/\bAnd\b/g, "and");
}

// ---------- dates and locations ----------
const MON =
  "\\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|" +
  "ene(?:ro)?|febrero|marzo|abril|mayo|junio|julio|ago(?:sto)?|sept?iembre|octubre|noviembre|dic(?:iembre)?)\\b\\.?";
const SEASON = "\\b(?:summer|fall|spring|winter|autumn|verano|oto[ñn]o|primavera|invierno)";
const YEAR = "\\b(?:19|20)\\d{2}\\b";
// "May '27", "Fall ’26": a two-digit year after an apostrophe (11,041-resume test, Nov 26: 11% of student resumes lost
// their major and graduation date to it).
const YEAR2 = "['’‘]\\d{2}\\b";
const POINT = `(?:${MON}\\s*(?:\\d{1,2},?\\s+)?${YEAR}|${MON}\\s*${YEAR2}|${SEASON}\\s+(?:${YEAR}|${YEAR2})|\\b\\d{1,2}\\/(?:19|20)\\d{2}\\b|${YEAR})`;
const NOW = "\\b(?:present|current|now|today|actualidad|actual|presente)\\b";
const SHORT = "\\b\\d{1,2}\\/\\d{2}\\b"; // "7/09", only inside a range
const RANGE =
  `(?:(?:${POINT}|${MON}|${SHORT})\\s*(?:[–—-]+|\\bto\\b|\\buntil\\b|\\ba\\b|\\bhasta\\b)\\s*(?:${NOW}|${POINT}|${SHORT})` +
  `|${MON}\\s*${YEAR}\\s+(?:${MON}\\s*${YEAR}|${NOW})` + // some PDFs lose the dash: "Sep. 2023 Mar. 2024"
  `|${SEASON}\\s+${YEAR}\\s*(?:and|&|,)\\s*${YEAR})`; // "Summer 2012 and 2013"
const EXPECTED = `(?:\\b(?:expected|anticipated|graduat(?:ion|ing|ed)|class of|egreso)\\b|\\bgrad\\.)[^\\d\\n]{0,24}?${POINT}`;
const DATE = `(?:${EXPECTED}|${RANGE}|${MON}\\s*(?:${YEAR}|${YEAR2})|${SEASON}\\s+(?:${YEAR}|${YEAR2})|\\b\\d{1,2}\\/(?:19|20)\\d{2}\\b)`;
const DATE_ONLY = new RegExp(`^\\(?\\s*(?:${DATE}|${YEAR})\\s*\\)?$`, "i");
const PAREN_DATE = new RegExp(`\\(\\s*((?:${DATE}|${YEAR}))\\s*\\)`, "i");
const EXPECTED_ANY = new RegExp(EXPECTED, "i");
const END_DATE = new RegExp(`(?:^|\\s|[,|(])(${DATE})\\s*$`, "i");
const END_YEAR = new RegExp(`(?:^|[,|(–—-]\\s*)(${YEAR})\\s*\\)?$`);
const START_YEAR = new RegExp(`^(${YEAR})\\s+(?=\\S)`);
const SEPARATORS = /^[\s|,;:–—-]+|[\s|,;:–—-]+$/g;
const tidy = (s: string) => s.replace(/\(\s*\)/g, " ").replace(/\s*,(\s*,)+/g, ",").replace(/\s{2,}/g, " ").replace(SEPARATORS, "").trim();

/** The entry's dates, wherever the line keeps them, and the rest of the line. */
export function splitDate(text: string): { date: string; rest: string } {
  for (const re of [PAREN_DATE, EXPECTED_ANY, END_DATE, END_YEAR]) {
    const m = text.match(re);
    if (!m || m.index === undefined) continue;
    const date = (m[1] || m[0]).trim();
    return { date: date.replace(SEPARATORS, ""), rest: tidy(text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)) };
  }
  return { date: "", rest: text };
}
const hasDate = (text: string) => !!splitDate(text.replace(/\t+/g, " ")).date;

// "Fort Worth, TX" / "Nuevo Laredo, Mexico" at the end of a line. The part after the comma must be a state
// code or a known state, province or country, so "John Doe, Sarah Williams, David Park" is not a place.
const REGIONS = (
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|" +
  "Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|" +
  "New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|" +
  "Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia|D.C.|Puerto Rico|" +
  "Aguascalientes|Baja California|Baja California Sur|Campeche|Chiapas|Chihuahua|Ciudad de México|CDMX|Coahuila|Colima|Durango|Guanajuato|" +
  "Guerrero|Hidalgo|Jalisco|Estado de México|Michoacán|Morelos|Nayarit|Nuevo León|Oaxaca|Puebla|Querétaro|Quintana Roo|San Luis Potosí|" +
  "Sinaloa|Sonora|Tabasco|Tamaulipas|Tlaxcala|Veracruz|Yucatán|Zacatecas|" +
  "Ontario|Quebec|Québec|British Columbia|Alberta|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|" +
  "Mexico|México|Canada|United States|U.S.A.|U.S.A|USA|U.S.|United Kingdom|England|Scotland|Wales|Ireland|France|Germany|Spain|España|Italy|" +
  "Portugal|Netherlands|Belgium|Switzerland|Austria|Sweden|Norway|Denmark|Finland|Poland|Greece|Turkey|Türkiye|Ukraine|Israel|Egypt|Nigeria|" +
  "Kenya|Ghana|South Africa|Morocco|India|Pakistan|Bangladesh|Sri Lanka|Nepal|China|Japan|Korea|South Korea|S. Korea|S.Korea|Republic of Korea|" +
  "Taiwan|Hong Kong|Singapore|Malaysia|Indonesia|Philippines|Thailand|Vietnam|Australia|New Zealand|Brazil|Brasil|Argentina|Chile|Colombia|" +
  "Peru|Perú|Venezuela|Ecuador|Bolivia|Uruguay|Paraguay|Guatemala|Honduras|El Salvador|Nicaragua|Costa Rica|Panama|Panamá|Cuba|" +
  "Dominican Republic|Jamaica|Saudi Arabia|United Arab Emirates|UAE|Qatar|Lebanon|Jordan"
).split("|");
const REGION = [...REGIONS, ...REGIONS.map((r) => r.toLocaleUpperCase())]
  .sort((a, b) => b.length - a.length)
  .map((r) => r.replace(/[.]/g, "\\."))
  .join("|");
const STATE = `(?:\\p{Lu}{2}\\b|(?:${REGION})(?![\\p{L}]))`;
const place = (cityWords: string) => `(?:\\p{Lu}[\\p{L}.'’-]+\\s?){${cityWords}},\\s*${STATE}`;
// Three city words first ("Salt Lake City"), then two ("Fort Worth"), then one ("Summer Analyst Dallas, TX" → "Dallas, TX").
const LOC_END = ["3", "2", "1"].map((n) => new RegExp(`^(.*?)[\\s,–—-]+(${place(n)}|Remote|Virtual|Hybrid)\\s*$`, "u"));
const LOC_ONLY = new RegExp(`^(?:${place("1,3")}|Remote|Virtual|Hybrid)$`, "u");
// Job titles. Used to keep them out of places, and to tell a title line from an organization line.
const ROLE_WORDS =
  "intern|internship|assistant|analyst|associate|manager|director|coordinator|representative|specialist|consultant|engineer|developer|designer|" +
  "leader|lead|supervisor|cashier|server|tutor|instructor|counselor|volunteer|president|vice president|treasurer|secretary|chair\\w*|member|officer|" +
  "captain|founder|co-founder|researcher|fellow|clerk|teller|barista|host|hostess|advis[oe]r|mentor|ambassador|trainee|apprentice|aide|technician|" +
  "editor|writer|organizer|owner|partner|agent|accountant|auditor|scholar|participant|hire|staff|employee|worker|lifeguard|coach|driver|" +
  "operator|receptionist|administrator|programmer|scientist|teacher|professor|player|athlete|cto|ceo|cfo|coo|practicante|becari[oa]|pasante|" +
  "gerente|asistente|analista|coordinador\\w*|voluntari[oa]|presidente|tesorer[oa]|secretari[oa]";
const ROLE = new RegExp(`\\b(?:${ROLE_WORDS})\\b`, "i");
const NOT_A_PLACE = new RegExp(
  "\\b(?:universit\\w*|college|institut\\w*|school|academy|society|association|club|council|bank|group|partners|capital|inc|llc|ltd|corp\\w*|" +
    "company|program\\w*|projects?|foundation|centers?|department|office|studies|lab|labs|team|committee|chapter|board|services?|solutions|systems|" +
    `technologies|consulting|ventures|holdings|museum|library|hospital|church|${ROLE_WORDS})\\b|\\bco\\.`,
  "i",
);
// Without a column gap, "Example Startup Denver, CO" could end in a one- or two-word city. A longer city
// needs a word that cities share: "Fort Worth", "San Antonio", "Johnson City", "Colorado Springs".
const CITY_FIRST =
  /^(?:san|santa|santo|são|sao|los|las|la|le|el|new|fort|ft\.|st\.|saint|salt|grand|palo|corpus|little|kansas|oklahoma|baton|ann|cedar|colorado|des|long|mountain|north|south|east|west|port|sioux|virginia|college|glen|green|high|jersey|lake|mount|mt\.|myrtle|oak|ocean|overland|rancho|rio|rock|round|silver|sugar|sun|thousand|upper|walnut|white|winston|nuevo|nueva|ciudad|puerto|villa|monte|buenos|hong|tel|kuala|abu|cape|central|bowling|chapel|coral|falls|iowa|newport)$/i;
const CITY_LAST = /^(?:city|springs|beach|park|heights|hills|falls|rapids|creek|valley|grove|lake|bay|harbor|point|island|station|junction|village|town|ridge|field|woods|square)$/i;
export function splitLocation(text: string): { text: string; location: string } {
  for (const re of LOC_END) {
    const m = text.match(re);
    if (!m || !m[1].trim() || /\b(of|at|de|del|la|in|and|&|for|the)\s*$/i.test(m[1]) || NOT_A_PLACE.test(m[2])) continue;
    const city = m[2].split(",")[0].trim().split(/\s+/);
    if (city.length > 1 && !CITY_FIRST.test(city[0]) && !CITY_LAST.test(city[city.length - 1])) continue;
    return { text: tidy(m[1]), location: m[2].trim() };
  }
  return { text, location: "" };
}

/** A line's columns (Word tables, right-aligned PDF text) sorted into title, extra text, dates and location.
 * inlineDates: also look for dates inside the text ("Intern, Summer 2017"), not only in a column of their own. */
function readColumns(line: string, splitPlace: boolean, inlineDates = true) {
  let date = "";
  let location = "";
  // A column, or a "|"-separated piece of one, that is only a date or only a place: "Dec 2014 | Ithaca, NY".
  const take = (piece: string) => {
    if (!date && DATE_ONLY.test(piece)) date = piece.replace(/^\(|\)$/g, "").trim();
    else if (!location && LOC_ONLY.test(piece) && !NOT_A_PLACE.test(piece)) location = piece;
    else return false;
    return true;
  };
  const parts = line
    .split("\t")
    .map((col) => col.split(/\s*\|\s*/).map((p) => p.trim()).filter((p) => p && !take(p)).join(" | "))
    .filter(Boolean);
  // More than two columns left is a row of values ("TOEFL 97/120 | SAT 1440"), not a title and a role.
  let title = parts.length > 2 ? parts.join(" | ") : parts[0] || "";
  let extra = parts.length === 2 ? parts[1] : "";
  if (!date && inlineDates) ({ date, rest: title } = splitDate(title));
  if (!date && inlineDates && extra) ({ date, rest: extra } = splitDate(extra));
  if (!location && splitPlace) ({ text: title, location } = splitLocation(title));
  return { title: tidy(title), extra: tidy(extra), date, location };
}
/** A line that holds nothing but dates and/or a place, like RenderCV's "Princeton, NJ" under an entry's bullets. */
function datePlaceOnly(line: string) {
  if (!line || BULLET_RE.test(line)) return null;
  const col = readColumns(line, true, false);
  return !col.title && !col.extra && (col.date || col.location) ? col : null;
}
const DURATION = /^(?:\d+\+?\s*(?:years?|yrs?|months?|mos?)\.?\s*)+$/i; // "2 years 10 months"

// ---------- rules-based reader ----------
export const BULLET_RE = /^\s*[●•▪◦\-–*·]\s*/;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE = /(?:\(?\+\d{1,3}\)?[\s.-]*)?(?:\(\d{2,4}\)|\b\d{2,4})[\s.-]*\d{3,4}[\s.-]*\d{4}\b/;
const LINK =
  /^(?:linkedin|github|gitlab|twitter|behance|dribbble|portfolio|website|web)\b|linkedin\.com|github\.com|https?:\/\/|www\.|^[\w-]+(?:\.[\w-]+)*\.(?:com|io|dev|me|net|org|co|ai|app|edu|xyz|page|site|tech|us|mx)(?:\/\S*)?$/i;
const PLACE_ONLY = new RegExp(`^\\p{Lu}[\\p{L}.'’ -]*,\\s*${STATE}(?:\\s+\\d{5}(?:-\\d{4})?)?$`, "u"); // "Binghamton, NY 13902"
// "Champaign IL": a US state code with no comma.
const PLACE_NO_COMMA = /^\p{Lu}[\p{L}.'’ -]*\s(?:AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/u;
const STREET =
  /^(?:\d{1,6}[a-z]?\s+(?:[\p{L}\d.'’-]+\s+){0,5}(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|boulevard|blvd|court|ct|way|place|pl|circle|cir|parkway|pkwy|trail|terrace|highway|hwy|square|loop|hall)\.?(?:,?\s*(?:#|apt\.?|apartment|suite|ste\.?|unit|room)\s*[\w-]+)?|p\.?\s?o\.?\s+box\s+\d+|(?:calle|avenida|av\.|privada|cerrada)\s.+)$/iu;
const ADDRESS_LABEL = /^(?:(?:home|permanent|school|campus|local|current|mailing)\s+)?address\s*:?\s*/i;
const CONNECTOR_END = /[,;:&/+–—-]$|\b(?:and|or|of|the|to|for|with|in|on|at|by|from|into|a|an|y|o|de|del|la|el|los|las|en|con|para|por)$/i;
const ENDED = /[.!?)"”’]$/;

/** Name, email, phone, links and location from the lines above the first heading; anything else is returned as prose. */
function readContact(doc: ResumeDoc, head: string[]): string[] {
  const c = doc.contact;
  const prose: string[] = [];
  const address: string[] = [];
  let first = true;
  for (const line of head) {
    if (/^(resume|résumé|curriculum vitae|cv)$|^last updated\b/i.test(line)) continue;
    // Pieces split by separators; contact details run together with spaces ("Plano, TX  ana@example.com  817-555-0101") are pulled apart too.
    const parts = line.split(/\s*[|•·\t]\s*|\s+[—–]\s+|\s{2,}/).flatMap((p) => {
      const out: string[] = [];
      let rest = p;
      for (const re of [EMAIL, PHONE]) {
        const m = rest.match(re);
        if (m && rest.trim() !== m[0]) { out.push(m[0]); rest = rest.replace(m[0], " "); }
      }
      return [...out, rest].map((x) => x.trim()).filter((x) => x && !/^\W+$/.test(x));
    });
    const left: string[] = [];
    let contact = false;
    for (const part of parts) {
      const p = part.replace(ADDRESS_LABEL, "").trim();
      const email = p.match(EMAIL)?.[0];
      const phone = p.match(PHONE)?.[0];
      if (!p) contact = true; // "School Address:"
      else if (email) { c.email ||= email; contact = true; }
      // The rest of the piece may only be a label or an icon: "Mobile: +1 555…", "📱 (+82) 10-…".
      else if (phone && /^\W*(?:phone|tel|cell|mobile|m|p)?\W*$/i.test(p.replace(phone, ""))) { c.phone ||= phone.trim(); contact = true; }
      else if (p.length <= 100 && LINK.test(p)) { c.links = c.links ? `${c.links} | ${p}` : p; contact = true; }
      else if ((STREET.test(p) || PLACE_ONLY.test(p) || (PLACE_NO_COMMA.test(p) && !!c.name)) && p.length <= 60 && !NOT_A_PLACE.test(p)) { address.push(p); contact = true; }
      else if (/^\((?:phone|email|address)[^)]*\)$/i.test(p)) contact = true; // "(phone removed for demo)"
      else left.push(p);
    }
    // The first line is the name even when contact details share it ("Ana Ruiz | ana@example.com").
    if (!c.name && (first || !contact) && left.length && left[0].split(/\s+/).length <= 8 && !/\d{3}/.test(left[0])) c.name = left.shift()!;
    if (left.length) prose.push(left.join(" | "));
    first = false;
  }
  c.location ||= address.join(", ");
  return prose;
}

/** A line made only of an email, a phone number and/or profile links. */
function contactOnly(line: string): { email: string; phone: string; links: string } | null {
  const out = { email: "", phone: "", links: "" };
  for (const part of line.split(/\s*[|•·\t]\s*/).map((p) => p.trim()).filter(Boolean)) {
    const email = part.match(EMAIL)?.[0];
    const phone = part.match(PHONE)?.[0];
    if (email && part.replace(email, "").replace(/^\W*(?:e-?mail)?\W*$/i, "") === "") out.email ||= email;
    else if (phone && /^\W*(?:phone|tel|cell|mobile|m|p)?\W*$/i.test(part.replace(phone, ""))) out.phone ||= phone.trim();
    else if (part.length <= 100 && /linkedin\.com|github\.com|^https?:\/\/|^www\./i.test(part)) out.links = out.links ? `${out.links} | ${part}` : part;
    else return null;
  }
  return out.email || out.phone || out.links ? out : null;
}

// Education lines: a school starts an entry; a degree or a detail line belongs to the school above it.
const SCHOOL = /universit|college|institut|school|academy|polytechnic|conservatory|seminary|universidad|instituto|colegio|preparatoria|\bprepa\b|bachillerato|lyc[eé]e|gymnasium/i;
const SUB_UNIT = /^(?:(?:honors\s+)?college|school|faculty|department|division|facultad|escuela)\s+of\b|^honors college\b/i;
const DEGREE =
  /^(?:bachelor|master|associate|doctor|ph\.?\s?d|b\.\s?[sa]\.|b\.?b\.?a\b|m\.?b\.?a\b|m\.\s?[sa]\.|m\.?eng\b|bsc\b|msc\b|bs\b|ba\b|ms\b|minors?\b|majors?\b|double major|dual degree|concentrations?\b|specializations?\b|emphasis\b|certificates?\b|diploma\b|advanced regents|international baccalaureate|licenciatura|ingenier|maestr|t[eé]cnico)/i;
const EDU_DETAIL =
  /^(?:(?:cumulative|overall|major|cum\.?)\s+)?gpa\b|^(?:dean'?s|president'?s) list|^honou?rs\b|^magna|^summa|^cum laude|^relevant coursework|^coursework|^related courses|^study abroad|^thesis|^advisor|^dissertation|^scholarships?\b|^awards?\b|^sat\b|^act\b|^toefl|^ielts|^duolingo|^promedio/i;
const BULLET_SPLIT = /\t+(?=[●•▪◦\-–*·]\s)/; // "• Accounting ⇥ • Marketing": two bullets side by side

export function rulesParse(text: string): ResumeDoc {
  const lines = normalizeResumeText(text).split("\n");
  const doc: ResumeDoc = { contact: { name: "", email: "", phone: "", location: "", links: "" }, sections: [], skills: [] };
  let i = 0;
  const head: string[] = [];
  while (i < lines.length && !headingOf(lines[i])) head.push(lines[i++]);
  const prose = readContact(doc, head);

  // Text copied from a PDF keeps its visual lines (bullets wrap onto the next line); Word text has one line
  // per paragraph, and a paragraph almost never starts in lower case.
  const wrapped = lines.some((l) => /^\p{Ll}/u.test(l));
  const widths = lines.map((l) => l.length).filter((n) => n > 20).sort((a, b) => a - b);
  const fullWidth = widths.length ? widths[Math.floor(widths.length * 0.9)] : 100;

  let section: Section | null = null;
  let kind: Kind = "entries";
  let entry: Entry | null = null;
  let bullet: Bullet | null = null;
  let pending: { org: string; location: string; role?: string } | null = null; // org line waiting for its "role  dates" line
  let roleSlot: Entry | null = null; // entry whose role may be on the next line
  let held: { date: string; location: string } | null = null; // dates or a place printed before their entry
  let group: (SkillLine & { loose?: boolean }) | null = null;

  const openSection = (heading: string) => {
    section = { id: uid("s"), heading, entries: [] };
    kind = kindOf(heading);
    if (kind !== "skills") doc.sections.push(section);
    entry = bullet = roleSlot = group = pending = held = null;
  };
  const newEntry = (e: Partial<Entry>) => {
    entry = { id: uid("e"), org: "", role: "", location: "", dates: "", bullets: [], ...e };
    if (held) {
      entry.dates ||= held.date;
      entry.location ||= held.location;
      held = null;
    }
    section!.entries.push(entry);
    bullet = null;
    return entry;
  };
  const addBullet = (text: string) => {
    const t = text.replace(/\t+/g, " ").trim();
    if (!t) return;
    const target = entry || newEntry({});
    bullet = { id: uid("b"), text: t, verified: true };
    target.bullets.push(bullet);
  };
  const flushPending = () => {
    if (pending) newEntry({ org: pending.org, location: pending.location, role: pending.role || "" });
    pending = null;
  };
  /** Whether a line is the rest of the bullet above it rather than something new. */
  const continues = (line: string, prevLine: string) => {
    if (!bullet) return false;
    if (/^\p{Ll}/u.test(line)) return true;
    if (isCaps(line) || hasDate(line)) return false;
    if (kind === "education" && SCHOOL.test(line)) return false;
    if (line.includes("\t")) {
      const col = readColumns(line, true, false);
      if (col.date || col.location) return false; // a column with a date or place starts an entry
    }
    if (CONNECTOR_END.test(bullet.text)) return true;
    const full = wrapped && prevLine.length >= fullWidth * 0.8; // the line above ran to the margin
    // A second sentence of the same bullet: "…300+ pods." then "Managed all manifests with ArgoCD."
    if (full && /[.!?]$/.test(line) && line.split(/\s+/).length >= 4) return true;
    if (ENDED.test(bullet.text)) return false;
    return full;
  };

  if (prose.length) {
    openSection("Summary");
    addBullet(prose.join(" "));
  }

  const handle = (raw: string, prevLine: string, next: string) => {
    let line = raw;
    if (kind === "skills") {
      const t = line.replace(BULLET_RE, "").replace(/\t+/g, " ").trim();
      const m = t.match(/^([^:]{2,40}):\s*(.*)$/);
      if (m && !/https?$/i.test(m[1])) {
        group = { id: uid("k"), label: m[1].trim(), items: m[2].trim() };
        doc.skills.push(group);
      } else if (group && (!group.items || CONNECTOR_END.test(group.items) || /^\p{Ll}/u.test(t) || (wrapped && prevLine.length >= fullWidth * 0.8))) {
        group.items = `${group.items} ${t}`.trim();
      } else if (group?.loose) {
        group.items += ", " + t;
      } else {
        group = { id: uid("k"), label: section!.heading, items: t, loose: true };
        doc.skills.push(group);
      }
      return;
    }
    // "• Google ⇥ Mountain View, CA" followed by "Software Engineer ⇥ 2016 – Present" is an entry's heading, not an achievement.
    if (BULLET_RE.test(line) && line.includes("\t") && next && !BULLET_RE.test(next) && datePlaceOnly(line.slice(line.lastIndexOf("\t") + 1))) {
      line = line.replace(BULLET_RE, "");
    }
    if (BULLET_RE.test(line)) {
      flushPending();
      for (const part of line.split(BULLET_SPLIT)) addBullet(part.replace(BULLET_RE, ""));
      roleSlot = null;
      return;
    }
    if (kind === "summary") {
      if (bullet && (continues(line, prevLine) || entry!.bullets.length === 1)) bullet.text += " " + line.replace(/\t+/g, " ");
      else addBullet(line);
      return;
    }
    const strongWrap = !!bullet && (/^\p{Ll}/u.test(line) || CONNECTOR_END.test(bullet.text));
    if (pending) {
      const col = readColumns(line, true);
      if (col.date) {
        newEntry({ org: pending.org, location: pending.location || col.location, role: [col.title, col.extra].filter(Boolean).join(" | ") || pending.role || "", dates: col.date });
        pending = null;
        return;
      }
      flushPending();
    }
    // Dates or a place on a line of their own: RenderCV prints them under an entry's bullets, others above the entry.
    const only = datePlaceOnly(line);
    if (only) {
      if (entry && (!only.date || !entry.dates) && (!only.location || !entry.location)) {
        entry.dates ||= only.date;
        entry.location ||= only.location;
      } else held = { date: only.date, location: only.location };
      return;
    }
    if (entry && DURATION.test(line)) {
      entry.dates = entry.dates ? `${entry.dates} · ${line}` : line;
      return;
    }
    // "Store Manager" above "Dollar General — Reno, NV": a job title starting the next entry, not the end of the last bullet.
    const titleAbovePlace = ROLE.test(line) && line.split(/\s+/).length <= 6 && /^(?:[\p{Lu}&(]\S*\s*)+$/u.test(line) && !hasDate(line) && !!next && !!readColumns(next, true).location;
    if (strongWrap && !titleAbovePlace && continues(line, prevLine)) {
      bullet!.text += " " + line.replace(/\t+/g, " ");
      return;
    }
    if (kind === "education") {
      const plain = line.replace(/\t+/g, " ");
      const detail = EDU_DETAIL.test(plain);
      const school =
        !detail &&
        ((SCHOOL.test(plain) && !(entry && SUB_UNIT.test(plain))) ||
          (!DEGREE.test(plain) && !SCHOOL.test(plain) && ((!!entry?.role && isCaps(plain)) || !!datePlaceOnly(next))));
      if (school) {
        const col = readColumns(line, true);
        roleSlot = newEntry({ org: col.title, role: col.extra, location: col.location, dates: col.date });
        return;
      }
      if (entry && !continues(line, prevLine)) {
        // The first line under a school is its degree; GPA, honors and a second major are details.
        // A semester list ("Dean's List Fall 2024, Spring 2025") is not the entry's dates.
        const safe = !/dean|list|semester|honou?r/i.test(plain);
        const col = readColumns(line, true, !entry.dates && safe);
        if (col.date && !entry.dates) entry.dates = col.date;
        if (col.location && !entry.location) entry.location = col.location;
        const rest = [col.title, col.extra, col.date !== entry.dates ? col.date : "", col.location !== entry.location ? col.location : ""];
        const kept = rest.filter(Boolean).join(" | ");
        if (!kept) return;
        if (!entry.role && entry.bullets.length === 0 && !detail) entry.role = kept;
        else addBullet(kept);
        roleSlot = null;
        return;
      }
    }
    // "Org   City, ST" followed by "Role   Dates" (the classic layout)
    if (!hasDate(line) && next && !BULLET_RE.test(next) && !headingOf(next) && hasDate(next)) {
      const col = readColumns(line, true);
      const text = [col.title, col.extra].filter(Boolean).join(" | ");
      // "Security Analyst Intern", "Bluebonnet Health — City, ST", "Jun 2026 – Aug 2026": a lone title line, then its org, then dates.
      if (roleSlot && roleSlot === entry && !roleSlot.role && !roleSlot.dates && !roleSlot.location && roleSlot.bullets.length === 0 && (!ROLE.test(text) || (!!col.location && !roleSlot.location))) { // the line with the place is the org ("Dollar General — Reno, NV")
        [roleSlot.role, roleSlot.org, roleSlot.location] = [roleSlot.org, text, col.location];
        return;
      }
      // "Server, Olive Garden — City, ST" then dates: the role and the org on one line.
      const comma = text.split(", ");
      pending = comma.length === 2 && ROLE.test(comma[0]) !== ROLE.test(comma[1]) ? { org: ROLE.test(comma[0]) ? comma[1] : comma[0], role: ROLE.test(comma[0]) ? comma[0] : comma[1], location: col.location } : { org: text, location: col.location };
      return;
    }
    if (!titleAbovePlace && continues(line, prevLine)) {
      bullet!.text += " " + line.replace(/\t+/g, " ");
      return;
    }
    // "Org   Dates" followed by "Role   City, ST", or an undated "Org" followed by its role
    if (roleSlot && !roleSlot.role && roleSlot.bullets.length === 0 && !hasDate(line) && BULLET_RE.test(next)) {
      const col = readColumns(line, true);
      const text = [col.title, col.extra].filter(Boolean).join(" | ");
      // "Intern, Summer 2017" then "Wells Fargo, St. Louis, MO": the dated line was the job title.
      if (col.location && ROLE.test(roleSlot.org) && !ROLE.test(text)) [roleSlot.org, roleSlot.role] = [text, roleSlot.org];
      else roleSlot.role = text;
      roleSlot.location ||= col.location;
      roleSlot = null;
      return;
    }
    // A bullet whose "•" was lost in the PDF ("Designed a 12-layer PCB for a CubeSat team" under a dated job): a sentence,
    // mostly lower-case words, not a Title Case job title. It used to become an empty entry of its own.
    const ws = line.replace(/\t+/g, " ").trim().split(/\s+/);
    if (entry && entry.dates && (entry.role || entry.org) && !hasDate(line) && ws.length >= 4 && /^\p{Lu}/u.test(ws[0]) && ws.slice(1).filter((x) => /^\p{Ll}/u.test(x)).length >= Math.max(1, ws.slice(1).filter((x) => /^\p{Lu}/u.test(x)).length)) {
      addBullet(line.replace(/\t+/g, " ").trim());
      return;
    }
    // A description written as a paragraph instead of bullets.
    if (entry && !isCaps(line) && !hasDate(line) && line.length >= fullWidth * 0.6 && !BULLET_RE.test(next) && (/^\p{Ll}/u.test(next) || /[.!?]$/.test(line))) {
      addBullet(line);
      return;
    }
    const col = readColumns(line, true);
    // "President ⇥ May 2025 – Present", then "Secretary ⇥ Aug 2024 – May 2025": another role at the same organization.
    const prev: Entry | null = entry;
    const roleOnly = ROLE.test(col.title) && !col.title.includes(",") && col.title.split(/\s+/).length <= 4;
    if (prev && col.date && !col.location && !col.extra && prev.org && prev.role && prev.bullets.length === 0 && roleOnly) {
      roleSlot = newEntry({ org: prev.org, location: prev.location, role: col.title, dates: col.date });
      return;
    }
    let { title, extra, date } = col;
    // "2014 ⇥ 1st Place, Coding Competition": a list of awards with the year first.
    const year = date ? null : title.match(START_YEAR);
    if (year) [date, title] = [year[1], title.slice(year[0].length).trim()];
    // "FACEBOOK | SOFTWARE ENGINEER": the organization and the role on one line.
    const pipe = extra ? [] : title.split(" | ");
    if (pipe.length === 2 && ROLE.test(pipe[1]) && !ROLE.test(pipe[0])) [title, extra] = pipe;
    // "Nexus AI, Co-Founder & CTO" or "Member, Marketing Club": an organization and a role, either way round.
    const comma = extra ? [] : title.split(", ");
    if (comma.length === 2 && ROLE.test(comma[0]) !== ROLE.test(comma[1])) [title, extra] = ROLE.test(comma[1]) ? comma : [comma[1], comma[0]];
    roleSlot = newEntry({ org: title, role: extra, location: col.location, dates: date });
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (doc.contact.name && fold(line) === fold(doc.contact.name)) continue; // name repeated at the top of page 2
    // A heading split over lines of the left column: "CUSTOMER ⇥ …", "SERVICE ⇥ …", "EXPERIENCE ⇥ …".
    const words: { head: string; rest: string }[] = [];
    for (let w = marginWord(line, false); w && words.length < 3; ) {
      words.push(w);
      w = MARGIN_FIRST.test(w.head) ? marginWord(lines[i + words.length] || "", true) : null;
    }
    let n = words.length;
    while (n >= 2 && !MARGIN_SECOND.test(words[n - 1].head)) n--;
    if (n >= 2) {
      openSection(titleCase(words.slice(0, n).map((w) => w.head).join(" ")));
      const rests = words.slice(0, n).map((w) => w.rest).filter(Boolean);
      rests.forEach((r, k) => handle(r, rests[k - 1] || "", rests[k + 1] || lines[i + n] || ""));
      i += n - 1;
      continue;
    }
    // Email, phone or profile links printed lower down (a sidebar read after the main column).
    const found = contactOnly(line);
    if (found && ((found.email && !doc.contact.email) || (found.phone && !doc.contact.phone) || (found.links && !doc.contact.links))) {
      doc.contact.email ||= found.email;
      doc.contact.phone ||= found.phone;
      if (found.links && !doc.contact.links) doc.contact.links = found.links;
      continue;
    }
    const h = headingOf(line);
    if (h) {
      const again = h.continued && doc.sections.find((s) => fold(s.heading) === fold(h.heading));
      if (again) {
        section = again;
        kind = kindOf(again.heading);
        entry = again.entries[again.entries.length - 1] || null;
        bullet = roleSlot = group = pending = held = null;
      } else openSection(h.heading);
      if (h.rest) handle(h.rest, "", lines[i + 1] || "");
      continue;
    }
    if (!section) continue;
    handle(line, lines[i - 1] || "", lines[i + 1] || "");
  }
  flushPending();
  for (const g of doc.skills) delete (g as { loose?: boolean }).loose;
  return doc;
}

// ---------- AI reader with verification ----------
const MONTH_KEY: Record<string, string> = {};
for (const [k, names] of Object.entries({
  jan: "january ene enero", feb: "february febrero", mar: "march marzo", apr: "april abr abril", may: "mayo", jun: "june junio",
  jul: "july julio", aug: "august ago agosto", sep: "sept september septiembre setiembre", oct: "october octubre",
  nov: "november noviembre", dec: "december dic diciembre", present: "current now today presente actual actualidad",
})) for (const n of names.split(" ")) MONTH_KEY[n] = k;
/** Words and numbers, with month names and "present" spelled one way. */
const tokens = (s: string) => (fold(s).match(/[a-z]+|\d+/g) || []).map((t) => MONTH_KEY[t] || t).filter((t) => t.length > 1 || /\d/.test(t));
const supported = (field: string, have: Set<string>) => tokens(field).every((t) => have.has(t));

/** Builds the ResumeDoc from the AI's JSON, keeping only what the file supports. */
// "Team Member @ Chick-fil-A" put whole into org, with no role.
const atSplit = (org: string, role: string) => { const m = !role && org.match(/^(.+?)\s+@\s+(.+)$/); return m ? { role: m[1], org: m[2] } : { org, role }; };
export function verifyAiDoc(raw: string, out: any): { doc: ResumeDoc; notes: string[] } {
  const n = norm(raw);
  const have = new Set(tokens(raw));
  const digits = raw.replace(/\D/g, "");
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v)).replace(/\s+/g, " ").trim();
  let removed = 0;
  const keep = (v: unknown) => {
    const s = str(v);
    if (s && !supported(s, have)) { removed++; return ""; }
    return s;
  };
  const email = str(out?.contact?.email);
  const phone = str(out?.contact?.phone);
  const doc: ResumeDoc = {
    contact: {
      name: keep(out?.contact?.name),
      email: email && EMAIL.test(email) && n.includes(norm(email)) ? email : "",
      phone: phone && phone.replace(/\D/g, "").length >= 7 && digits.includes(phone.replace(/\D/g, "")) ? phone : "",
      location: keep(out?.contact?.location),
      links: keep(out?.contact?.links),
    },
    sections: [],
    skills: [],
  };
  for (const s of Array.isArray(out?.sections) ? out.sections : []) {
    const section: Section = { id: uid("s"), heading: str(s?.heading) || "Section", entries: [] };
    for (const e of Array.isArray(s?.entries) ? s.entries : []) {
      const split = atSplit(str(e?.org), str(e?.role)), dates = keep(e?.dates);
      const entry: Entry = {
        id: uid("e"), org: split.org, role: dropDates(split.role, dates), location: keep(e?.location), dates,
        bullets: (Array.isArray(e?.bullets) ? e.bullets : typeof e?.bullets === "string" ? [e.bullets] : [])
          .map((b: unknown) => str(typeof b === "object" && b ? (b as { text?: unknown }).text : b))
          .filter(Boolean)
          .map((t: string) => ({ id: uid("b"), text: t, verified: n.includes(norm(t)) })),
      };
      const unverified = (["org", "role"] as const).filter((f) => entry[f] && !supported(entry[f], have));
      if (unverified.length) entry.unverified = unverified;
      if (entry.org || entry.role || entry.dates || entry.bullets.length) section.entries.push(entry);
    }
    if (section.entries.length) doc.sections.push(section);
  }
  let droppedSkills = 0;
  for (const k of Array.isArray(out?.skills) ? out.skills : []) {
    const items = splitList(str(k?.items));
    // A group the file doesn't fully support ("Excel (pivot tables, VLOOKUP)" when only pivot tables is there) keeps the parts it does.
    const kept = items.flatMap((x) => (supported(x, have) ? [x] : skillParts(x).filter((y) => y !== x && supported(y, have))));
    droppedSkills += items.length - kept.length;
    if (kept.length) doc.skills.push({ id: uid("k"), label: str(k?.label) || "Skills", items: kept.join(", ") });
  }
  const notes: string[] = [];
  if (removed)
    notes.push(removed === 1
      ? "The AI reading added a date, place or contact detail that isn't in your file, so Remy left it out."
      : `The AI reading added ${removed} dates, places or contact details that aren't in your file, so Remy left them out.`);
  if (droppedSkills)
    notes.push(droppedSkills === 1
      ? "The AI reading listed a skill that isn't in your file, so Remy left it out."
      : `The AI reading listed ${droppedSkills} skills that aren't in your file, so Remy left them out.`);
  return { doc, notes };
}

export async function aiParseResume(raw: string): Promise<{ doc: ResumeDoc; notes: string[] }> {
  const out = await aiJson<any>(
    `You convert resume text into structured JSON. Copy wording VERBATIM from the resume: never add, infer, translate, summarize, reword or improve anything. Join text that wraps across lines. If a field is missing, use an empty string. Tab characters separate columns, such as an organization and its location or a role and its dates.`,
    `Return JSON with this shape:
{"contact":{"name":"","email":"","phone":"","location":"","links":""},
 "sections":[{"heading":"Education","entries":[{"org":"","role":"","location":"","dates":"","bullets":["..."]}]}],
 "skills":[{"label":"Technical","items":"comma separated, verbatim"}]}
Rules:
- Keep every section in the original order with its heading as written (Education, Experience, Projects, Activities, Honors & Awards, Certifications, Coursework and so on). Skills, languages and similar lists go in "skills", with their labels as written.
- A summary, profile, objective or introduction paragraph is its own section: one entry with the whole paragraph as a single bullet.
- Education: org = school, role = degree or major line (keep GPA, honors or test scores in it if they are on that line), dates = graduation text exactly as written. Keep the schools in the order they appear.
- When one line holds the title, organization, dates and details such as hours per week (for example "Team Captain, Debate Club (Aug 2024 - Present) HPW:4"), put the dates in "dates" and the rest of that line, word for word, in "org" and "role".
- Honors, awards or certification lists: one entry per section with each item as a bullet.
- Every line of the resume must appear somewhere in the JSON. Don't drop details, merge entries, or move a line to another entry.

RESUME TEXT:
"""${raw.slice(0, 14000)}"""`,
    6000,
  );
  const result = verifyAiDoc(raw, out);
  if (!result.doc.sections.length) throw new Error("AI could not find resume sections");
  return result;
}

/** The AI reading, unless it left out a good part of the file that the rules reading kept. */
export function chooseReading(raw: string, rules: ResumeDoc, ai: { doc: ResumeDoc; notes: string[] }) {
  const kept = parseQuality(raw, ai.doc).coverage;
  if (kept >= 0.85 || kept + 0.1 > parseQuality(raw, rules).coverage) return { doc: ai.doc, parsedBy: "ai" as const, notes: ai.notes };
  return {
    doc: rules,
    parsedBy: "rules" as const,
    notes: [`The AI reading left out part of your file (it kept ${Math.round(kept * 100)}% of the words), so Remy's built-in reader structured it instead.`],
  };
}

// ---------- how much of the file made it in ----------
/** Coverage of the file by the structured resume, and the lines that didn't land anywhere. */
export function parseQuality(raw: string, doc: ResumeDoc, warnings: string[] = []): ResumeQuality {
  const have = new Map<string, number>();
  for (const t of tokens(resumeToText(doc))) have.set(t, (have.get(t) || 0) + 1);
  let total = 0;
  let kept = 0;
  const left = new Map(have);
  for (const t of tokens(raw)) {
    total++;
    const c = left.get(t) || 0;
    if (c) { kept++; left.set(t, c - 1); }
  }
  return { coverage: total ? Math.round((kept / total) * 100) / 100 : 1, missingLines: stillMissing(raw.split("\n"), doc), warnings };
}

/** Lines (of three or more words) that the structured resume doesn't contain. */
export function stillMissing(lines: string[], doc: ResumeDoc): string[] {
  const have = new Set(tokens(resumeToText(doc)));
  return lines
    .map((l) => l.trim())
    .filter((l) => {
      const t = tokens(l);
      return t.length >= 3 && !headingOf(l) && t.filter((x) => have.has(x)).length / t.length < 0.6;
    })
    .slice(0, 20);
}

// ---------- the resume as text ----------
/** Plain text of the resume. verifiedOnly leaves out AI-read text that isn't in the file, so it can't count as evidence. */
export function resumeToText(doc: ResumeDoc, opts: { verifiedOnly?: boolean } = {}): string {
  const field = (e: Entry, f: "org" | "role") => (opts.verifiedOnly && e.unverified?.includes(f) ? "" : f === "role" ? dropDates(e.role, e.dates) : e[f]);
  const out: string[] = [doc.contact.name, [doc.contact.location, doc.contact.email, doc.contact.phone, doc.contact.links].filter(Boolean).join(" | ")];
  for (const s of doc.sections) {
    out.push("", s.heading.toUpperCase());
    for (const e of s.entries) {
      out.push([field(e, "org"), e.location].filter(Boolean).join(" — "));
      if (field(e, "role") || e.dates) out.push([field(e, "role"), e.dates].filter(Boolean).join(" | "));
      for (const b of e.bullets) if (!opts.verifiedOnly || b.verified !== false) out.push("• " + b.text);
    }
  }
  if (doc.skills.length) {
    out.push("", "SKILLS");
    for (const k of doc.skills) out.push(skillGroupName(k.label) ? `${skillGroupName(k.label)}: ${k.items}` : k.items);
  }
  return out.filter((l) => l !== undefined).join("\n");
}

// ---------- profile facts from the resume ----------
const UNIVERSITY = /universit|college|institute of technology|polytechnic|school of (business|law|engineering|medicine)|universidad|instituto tecnol[oó]gico|polit[eé]cnic/i;
const COLLEGE_NAME = /institut|academ|hochschule|augstskola|\btech\b|\bschool\b|universi|politec/i;
const HIGH_SCHOOL = /high school|secondary school|preparatoria|\bprepa\b|bachillerato|secundaria|lyc[eé]e/i;

/** The student's current university entry: not simply the first education line, which is often a high school. */
export function primaryEducation(doc?: ResumeDoc): Entry | undefined {
  const entries = (doc?.sections || []).filter((s) => kindOf(s.heading) === "education").flatMap((s) => s.entries);
  const text = (e: Entry) => `${e.org} ${e.role}`;
  // Schools named without "University" or "College" (Virginia Tech, Riga Institute of…, Hochschule…) count when the entry names a degree.
  const college = (e: Entry) => !HIGH_SCHOOL.test(text(e)) && (UNIVERSITY.test(text(e)) || (COLLEGE_NAME.test(e.org) && (DEGREE_WORD.test(e.role) || DEGREE_HEAD.test(e.role))) || (!!e.org && DEGREE_HEAD.test(e.role) && !/certificate|diploma/i.test(e.role)));
  // A heading Remy didn't recognize ("school stuff:"): a college entry with a degree word anywhere still counts.
  return entries.find(college) || (doc?.sections || []).flatMap((s) => s.entries).find((e) => college(e) && DEGREE_WORD.test(e.role));
}
const DEGREE_WORD = /\b(b\.?[sa]\.?|bachelor|bba|bfa|bsn|bsw|b\.?m\.?|associate|master|m\.?[sa]\.?|mba|major|undeclared|degree)\b/i;

/** "TEXAS CHRISTIAN UNIVERSITY (TCU) - FULL RIDE SCHOLARSHIP" → "Texas Christian University (TCU)". */
export function schoolName(org: string): string {
  // "University of California, Los Angeles": the campus after the comma is part of the name.
  const campus = org.match(/^((?:University|UNIVERSITY) (?:of|OF) [\p{L} ]+?),\s+((?:\p{Lu}[\p{L}.]*\s?){1,3})(?=$|\s*[,|–—-])/u);
  const whole = campus && !DEGREE_HEAD.test(campus[2]) && !/\b(?:gpa|class|honou?rs|scholar)/i.test(campus[2]) ? org.replace(", ", "\u2063") : org;
  const parts = whole.split(/\s+[-–—|]\s+|,\s+/).map((p) => p.replace(/\u2063/g, ", ").replace(/^(?:ph\.?\s?d\.?|bsc?|msc?|ba|ma|mba|meng|b\.[sa]\.|m\.[sa]\.)\s+(?=\p{Lu})/iu, "").trim()).filter(Boolean);
  const name = parts.find((p) => /universit|universidad|college/i.test(p)) || parts.find((p) => UNIVERSITY.test(p)) || parts[0] || "";
  if (!isCaps(name)) return name;
  return name
    .split(" ")
    .map((w, k) => (/^\(.*\)$/.test(w) ? w : k > 0 && /^(OF|AT|THE|AND|DE|DEL|LA|LOS|Y|IN|FOR)$/.test(w) ? w.toLowerCase() : titleCase(w)))
    .join(" ");
}

const NOT_A_MAJOR = /scholarship|honou?rs?|award|dean|student|high school|toefl|\bsat\b|\bact\b|\bgpa\b|\b(19|20)\d{2}\b|expected/i;
// The degree words at the start of a degree line: "Bachelor of Science", "MS", "B.S.", "BSEd", "Associate of Applied Science",
// "Diploma", "Double major". What follows "in", a comma or a colon is the major.
const DEGREE_HEAD = /^(?:(?:professional|honou?rs|joint|dual|double)\s+)?(?:(?:bachelor|master|doctor|associate)(?:'?s)?(?:\s+(?:degree|of\s+[\p{L} ]+?))?|diplom[ae]?|certificate(?:\s+of\s+[\p{L} ]+?)?|majors?|ph\.?\s?d\.?|a\.?b\.?|a\.?a\.?s?\.?|a\.?s\.?|b\.?\s?(?:a|s|sc|se|sed|sn|sw|ba|fa|m|eng|as)\.?|m\.?\s?(?:a|s|sc|sn|sw|ba|acc|eng|fa|ph|pa|ed)\.?)(?![\p{L}])/iu;
// A degree that names its own field when no major is written: "BSN" is nursing, "MBA" is business administration.
const DEGREE_FIELD: Record<string, string> = { bsn: "Nursing", msn: "Nursing", bsw: "Social Work", msw: "Social Work", mba: "Business Administration", bba: "Business Administration", macc: "Accounting", bsed: "Education", med: "Education", bfa: "Fine Arts", mfa: "Fine Arts", mph: "Public Health", mpa: "Public Administration", bm: "Music" };
/** The field in one piece of a degree line, and whether it only came from the degree's own name ("Bachelor of Social Work"). */
function degreeField(p: string): { field: string; named: boolean } {
  const m = p.match(DEGREE_HEAD);
  if (!m) return { field: p, named: false };
  const sep = p.match(/\s+in\s+|\s*[,:]\s+|\s+[-–—]\s+/);
  if (sep && sep.index! + sep[0].length < p.length) return { field: p.slice(sep.index! + sep[0].length).trim(), named: false };
  const rest = p.slice(m[0].length).trim();
  const of = m[0].match(/\bof\s+(.+)$/i)?.[1];
  if (of) {
    const name = `${of} ${rest}`.trim();
    return { field: /^(?:applied\s+)?(?:science|arts|philosophy|laws?)$/i.test(name) ? "" : name, named: true };
  }
  if (rest) return { field: rest, named: false }; // "B.S. Mechanical Engineering"
  return { field: DEGREE_FIELD[m[0].replace(/[^a-z]/gi, "").toLowerCase()] || "", named: true };
}
/** The student's major(s) from the university entry: "Majors: A | B", "B.S., Mathematics; B.S., Physics" or the degree line. */
export function majorsOf(e?: Entry): string {
  if (!e) return "";
  // A graduation date written into the degree line ("BBA Finance, Expected May 2029.") isn't part of the major.
  const role = e.role.replace(/[,(]?\s*\b(?:(?:expected|anticipated|graduat\w*|class of)\s+)?(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+)?(?:19|20)\d{2}\b\)?\.?/gi, (m) => (/expected|anticipated|graduat|class of|[a-z]{3}/i.test(m) ? "" : m));
  const all = [role, ...e.bullets.map((b) => b.text)].join("\n");
  const listed = all.match(/\bmajors?\s*:\s*([^\n]+)/i)?.[1];
  const pieces = (listed ? listed.replace(/\bGPA\b.*$/i, "").split(/\s*[|;\/]\s*|,\s+(?=\p{Lu})/u) : role.split(/\s*[|;·•]\s*|,\s+(?=\p{Lu})/u))
    .map((p) => p.replace(/\bGPA\b.*$/i, "").replace(/,?\s*\bminors?\b.*$/i, "").replace(/\bwith\b.*$/i, (m) => (/certific|concentration|minor/i.test(m) ? m : "")).replace(/[\s,.]+$/, "").replace(/^[\s,.;:|–-]+/, "").trim())
    .filter((p) => p && !NOT_A_MAJOR.test(p) && !/^minors?\b/i.test(p))
    .map(degreeField)
    .filter((x) => x.field && !NOT_A_MAJOR.test(x.field));
  // A written major wins over a field read from the degree's name ("BFA, Interior Design" is Interior Design).
  const parts = (pieces.some((x) => !x.named) ? pieces.filter((x) => !x.named) : pieces).map((x) => x.field.replace(/[\s,.]+$/, ""));
  if (!parts.length) return "";
  // "ENTREPRENEURSHIP AND INNOVATION NEELEY SCHOOL OF BUSINESS" → "Entrepreneurship and Innovation".
  const clean = parts.map((p) => p.replace(/\s*[-–,]?\s*\b(?:[\p{L}.]+\s+)?(?:school|college) of [\p{L} ]+$/iu, "").trim()).filter(Boolean)
    .map((p) => (isCaps(p) ? p.split(" ").map((w, k) => (k > 0 && /^(AND|OF|IN|THE|WITH|&)$/.test(w) ? w.toLowerCase() : titleCase(w))).join(" ") : p));
  return [...new Set(clean)].join(", ");
}
/** Minor(s) written on the university entry ("Minor: Economics", "Minors in Business and Spanish"). */
export function minorsOf(e?: Entry): string {
  if (!e) return "";
  const m = [e.role, ...e.bullets.map((b) => b.text)].join("\n").match(/\bminors?\s*(?::|in)\s*([^\n|;]+)/i);
  return m ? m[1].replace(/\bGPA\b.*$/i, "").replace(/[\s,.]+$/, "").trim() : "";
}
/** GPA on the university entry, only on a 4-point scale ("GPA: 3.8", "3.7/4.0"); a 9.6/10 high-school GPA is ignored. */
export function gpaOf(e?: Entry): string {
  if (!e) return "";
  const m = [e.org, e.role, e.dates, ...e.bullets.map((b) => b.text)].join(" ").match(/\bGPA\b[^0-9]{0,12}([0-4]\.\d{1,2})(?!\d)(?:\s*\/\s*(\d+(?:\.\d+)?))?/i);
  return m && (!m[2] || Number(m[2]) <= 4.3) ? m[1] : "";
}

/** Entries from before college: high-school education, test-score lines, anything naming the high school,
 *  and entries that ended before college started. Kept on the resume, but never used for the profile,
 *  tailoring or letters. `collegeStart` is when the student started college, if known. */
export function preCollegeIds(doc: ResumeDoc | undefined, collegeStart?: { y: number; m: number }): Set<string> {
  const out = new Set<string>();
  if (!doc) return out;
  const hsNames: string[] = [];
  for (const s of doc.sections) for (const e of s.entries) {
    const t = `${e.org} ${e.role}`;
    if (kindOf(s.heading) === "education" && (HIGH_SCHOOL.test(t) || (!UNIVERSITY.test(t) && /\b(?:sat|act|toefl|ielts|duolingo|psat|ib diploma|a-level)\b/i.test(t)) || (!UNIVERSITY.test(t) && /\bGPA\b[^0-9]{0,12}\d+(?:\.\d+)?\s*\/\s*(?:10|100|20)\b/i.test(t)))) {
      out.add(e.id);
      const name = e.org.split(/\s+[-–—|(]|,/)[0].trim();
      const short = e.org.match(/\(([A-Z]{2,})\)/)?.[1];
      if (name.length > 3) hsNames.push(name.toLowerCase());
      if (short) hsNames.push(short.toLowerCase());
    }
  }
  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  for (const s of doc.sections) for (const e of s.entries) {
    if (out.has(e.id)) continue;
    const text = `${e.org} ${e.role}`.toLowerCase();
    if (hsNames.some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text))) { out.add(e.id); continue; }
    if (!collegeStart || new RegExp(NOW, "i").test(e.dates)) continue;
    const ends = [...e.dates.toLowerCase().matchAll(/(?:\b([a-z]{3})[a-z]*\.?\s+)?((?:19|20)\d{2})\b/g)].pop();
    if (!ends) continue;
    const y = Number(ends[2]), m = ends[1] && MONTHS.includes(ends[1]) ? MONTHS.indexOf(ends[1]) + 1 : 0;
    if (y < collegeStart.y || (y === collegeStart.y && m > 0 && m < collegeStart.m)) out.add(e.id);
  }
  return out;
}

/** Graduation from an education entry's dates: the end of a range, never a start date or "Present". */
export function graduationOf(dates: string): string {
  const classOf = dates.match(/\bclass of\s+((?:19|20)\d{2})\b/i);
  if (classOf) return `May ${classOf[1]}`;
  const d = dates.replace(/\(\s*(?:expected|anticipated)?\s*\)/gi, "").replace(/\b(expected|anticipated)\b(\s+graduation)?(\s+date)?:?\s*/i, "").replace(/^graduation(\s+date)?:?\s*/i, "").trim();
  const parts = d.split(/\s*(?:[–—]|\s-\s|\bto\b|\bhasta\b)\s*/i).filter(Boolean);
  // "May. '27" → "May 2027", so every reader of the graduation date (class year, eligibility) sees a full year.
  const last = (parts[parts.length - 1] || "").replace(/([A-Za-z])\.?\s*['’‘](\d{2})\b/, (_m, c, y) => `${c} ${+y > (new Date().getFullYear() % 100) + 10 ? 19 : 20}${y}`);
  return new RegExp(NOW, "i").test(last) ? "" : last;
}

// Skills and tools a resume shows: everything on a "Skills"-type line, plus
// well-known tools mentioned anywhere. Used for matching, not shown as claims.
const KNOWN_TOOLS = ["excel", "powerpoint", "python", "sql", "tableau", "power bi", "bloomberg", "factset", "capital iq", "salesforce", "hubspot", "mailchimp", "canva", "figma", "photoshop", "illustrator", "google analytics", "ga4", "hootsuite", "meta business suite", "quickbooks", "sap", "java", "javascript", "c++", "matlab", "spss", "stata", "vba", "financial modeling", "dcf", "valuation", "accounting", "market research", "seo", "copywriting", "public speaking", "spanish", "french", "mandarin"];
export function extractSkills(doc: ResumeDoc, raw: string): string[] {
  const found = new Map<string, string>();
  const add = (x: string) => {
    const t = x.replace(/^[\s•·\-–:]+|[\s.;:]+$/g, "").trim();
    if (t.length > 1 && t.length < 40 && !/^(and|with|including|skills?|tools?|languages?|technical|interests?|certifications?)$/i.test(t)) found.set(t.toLowerCase(), t);
  };
  for (const sec of doc.sections) {
    if (!/skill|tool|technical|language|certif|software|proficien/i.test(sec.heading)) continue;
    for (const e of sec.entries) for (const line of [e.role, e.org, ...e.bullets.map((b) => b.text)]) {
      splitList((line || "").replace(/^[A-Za-z ]{2,30}:\s*/, ""), { and: true }).flatMap(skillParts).forEach(add);
    }
  }
  for (const g of doc.skills || []) splitList(g.items || "", { and: true }).flatMap(skillParts).forEach(add);
  const lower = ` ${raw.toLowerCase()} `;
  for (const tool of KNOWN_TOOLS) if (new RegExp(`[^a-z]${tool.replace(/[+]/g, "\\+")}[^a-z]`).test(lower) && ![...found.keys()].includes(tool)) add(tool.replace(/\b\w/g, (c) => c.toUpperCase()));
  return [...found.values()].slice(0, 40);
}

/** How many sections came before the Skills block in the original file, so downloads keep it in place. */
export function skillsPosition(raw: string, doc: ResumeDoc): number | undefined {
  const lines = raw.split("\n").map((l) => l.trim().toLowerCase());
  const skillsAt = lines.findIndex((l) => /^(technical |core |key |relevant )?skills\b.{0,30}$/.test(l) && !l.includes(":"));
  if (skillsAt < 0 || !doc.skills.length) return undefined;
  return doc.sections.filter((s) => { const i = lines.indexOf(s.heading.trim().toLowerCase()); return i >= 0 && i < skillsAt; }).length;
}

/** "DEMETRE DONDOLADZE" → "Demetre Dondoladze"; names already in mixed case are left alone. */
export const nameCase = (name: string) => (/[a-z]/.test(name) && /[A-Z]/.test(name) ? name : name.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase()));
