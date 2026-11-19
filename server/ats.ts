import type { AtsScore, Job, ResumeDoc } from "@shared/types";
import { family, families } from "@shared/words";
import { isSkillKeyword, plainEnglish, skillsIn } from "@shared/requirements";
import { QUANT, WEAK, isAction, isListSection } from "@shared/bullets";

// Resume suggestions (no score is shown to students; the points only order the suggestions), computed from the resume itself (no AI), so
// it's instant and gives the same number every time. Each lost point comes with
// the specific fix that would earn it back.



const lc = (s: string) => s.toLowerCase();
function textOf(doc: ResumeDoc) {
  return [doc.contact.name, ...doc.sections.flatMap((s) => [s.heading, ...s.entries.flatMap((e) => [e.org, e.role, e.dates, ...e.bullets.map((b) => b.text)])]), ...doc.skills.map((k) => k.label + " " + k.items)].join("\n");
}

/** `keywords: null` scores the resume on its own (the base resume): no keyword category, scaled to 100,
 *  so it doesn't change when the student's openings change. Keywords are checked per posting. */
export function atsScore(doc: ResumeDoc, keywords: string[] | null, against: string): AtsScore {
  const text = textOf(doc);
  const low = lc(text);
  // Coursework, honors and skills lines aren't achievement bullets; judge the rest.
  const bullets = doc.sections.filter((s) => !isListSection(s.heading)).flatMap((s) => s.entries.flatMap((e) => e.bullets)).map((b) => b.text.trim().replace(/^[•\-–*]\s*/, "")).filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean).length;
  const headings = doc.sections.map((s) => lc(s.heading));
  type Item = AtsScore["categories"][number]["items"][number] & { examples?: string[] };
  const cat = (name: string, max: number, items: Item[]) => {
    const earned = items.reduce((n, i) => n + i.earned, 0);
    return { name, max, score: Math.round(Math.min(max, earned)), items };
  };
  const item = (ok: boolean, pts: number, good: string, fix: string, partial = ok ? 1 : 0, examples?: string[]): Item => ({ ok, earned: Math.round(pts * partial * 10) / 10, max: pts, text: ok ? good : fix, examples: ok ? undefined : examples?.slice(0, 3) });
  const short = (b: string) => (b.length > 90 ? b.slice(0, 88) + "…" : b);

  const contact = cat("Contact info", 10, [
    item(!!doc.contact.name.trim(), 2, "Name at the top.", "Put your full name on the first line."),
    item(/@/.test(doc.contact.email), 3, "Email address found.", "Add a professional email address to the header."),
    item(/\d{3}.*\d{4}/.test(doc.contact.phone), 2, "Phone number found.", "Add a phone number — most ATS profiles require one."),
    item(/linkedin|github|http/i.test(doc.contact.links), 2, "LinkedIn or portfolio link found.", "Add your LinkedIn URL to the header."),
    item(!!doc.contact.location.trim(), 1, "Location found.", "Add your city and state (e.g. Fort Worth, TX) so location filters match you."),
  ]);

  const has = (re: RegExp) => headings.some((h) => re.test(h));
  const entries = doc.sections.filter((s) => !/skill|interest|language/i.test(s.heading)).flatMap((s) => s.entries.map((e) => ({ ...e, section: s.heading })));
  const undated = entries.filter((e) => !/\d{4}|present/i.test(e.dates));
  const dated = entries.length - undated.length;
  const structure = cat("Sections & structure", 20, [
    item(has(/experience|employment|work/), 6, "Standard \"Experience\" section.", "Add a section titled exactly \"Experience\" — ATS parsers look for that word."),
    item(has(/education/), 5, "Standard \"Education\" section.", "Add an \"Education\" section with school, degree and expected graduation."),
    item(doc.skills.length > 0 || has(/skill/), 4, "Skills section found.", "Add a plain \"Skills\" line (comma-separated tools and skills); parsers read it first."),
    item(entries.length > 0 && dated === entries.length, 5, "Every entry has dates.", `${undated.length} entr${undated.length === 1 ? "y is" : "ies are"} missing dates — add month and year to each.`, entries.length ? dated / entries.length : 0, undated.map((e) => `${e.section}: ${[e.role, e.org].filter(Boolean).join(", ") || e.bullets[0]?.text.slice(0, 60) || "untitled entry"}`)),
  ]);

  const noVerb = bullets.filter((b) => !isAction(b) || WEAK.test(b));
  const strong = bullets.length - noVerb.length;
  const weak = bullets.filter((b) => WEAK.test(b));
  const noNumber = bullets.filter((b) => !QUANT.test(b));
  const quant = bullets.length - noNumber.length;
  const badLen = bullets.filter((b) => { const n = b.split(/\s+/).length; return n < 8 || n > 32; });
  const goodLen = bullets.length - badLen.length;
  const n = bullets.length || 1;
  const bulletsCat = cat("Bullet quality", 30, [
    item(bullets.length >= 6, 6, `${bullets.length} achievement bullets.`, bullets.length ? `Only ${bullets.length} bullets — aim for 3-5 under each role.` : "No bullets found — describe each role in 3-5 bullets.", Math.min(1, bullets.length / 6)),
    item(strong / n >= 0.7, 9, "Most bullets open with a strong action verb.", `${noVerb.length} of ${bullets.length} experience bullets don't open with an action verb. Start each with what you did: Led, Built, Analyzed, Organized…${weak.length ? ` Replace "${weak[0].split(/\s+/).slice(0, 2).join(" ")}…" openers first.` : ""}`, Math.min(1, strong / n / 0.7), noVerb.map(short)),
    item(quant / n >= 0.5, 9, "At least half your bullets include a number.", `${quant} of ${bullets.length} experience bullets have a number. Add real counts, %, or $ where you have them (people, events, dollars, followers) — never estimate.`, Math.min(1, quant / n / 0.5), noNumber.map(short)),
    item(goodLen / n >= 0.8, 6, "Bullets are a skimmable length.", `${badLen.length} bullet${badLen.length === 1 ? " is" : "s are"} too short or too long — aim for 8-32 words each.`, Math.min(1, goodLen / n / 0.8), badLen.map(short)),
  ]);

  const format = cat("Length & format", 15, [
    item(words >= 250 && words <= 800, 8, `${words} words — a healthy one-page length.`, words < 250 ? `Only ${words} words — add detail to your strongest roles.` : `${words} words — trim to one page (about 450-700 words).`, words < 250 ? words / 250 : words > 800 ? Math.max(0, 1 - (words - 800) / 600) : 1),
    item(!/[│┃■◆★►]|\t{2,}/.test(text), 4, "No symbols that confuse parsers.", "Remove decorative symbols and tab-aligned columns; ATS reads them as noise."),
    item(new Set(entries.filter((e) => e.dates.trim()).map((e) => (/[a-z]{3}\s+\d{4}/i.test(e.dates) ? "word" : /\d{1,2}\/\d{4}/.test(e.dates) ? "num" : "other"))).size <= 1, 3, "Dates use one consistent format.", "Use one date format everywhere (e.g. \"Jun 2026 – Aug 2026\")."),
  ]);

  const kws = Array.from(new Set((keywords || []).map((k) => k.trim()).filter((k) => k && isSkillKeyword(k)))).slice(0, 15);
  const hit = kws.filter((k) => hasKeyword(text, k)); // the original case: "Excel" the program isn't "excel" the verb
  const missing = kws.filter((k) => !hit.includes(k));
  const keywordCat = cat("Keyword match", 25, [
    kws.length
      ? item(hit.length / kws.length >= 0.6, 25, `Matches ${hit.length} of ${kws.length} keywords ${against}.`, `Matches ${hit.length} of ${kws.length} skills ${against}. Work in the missing ones (red below) only where they're true — in a bullet or your Skills line.`, Math.min(1, hit.length / kws.length / 0.6))
      : item(false, 25, "", "Pick or save an opening so Remy can check your keywords against it.", 0.5),
  ]);

  const categories = keywords ? [contact, structure, bulletsCat, format, keywordCat] : [contact, structure, bulletsCat, format];
  const raw = categories.reduce((s, c) => s + c.score, 0);
  const score = keywords ? raw : Math.round((raw * 100) / categories.reduce((s, c) => s + c.max, 0));
  const fixes = categories.flatMap((c) => c.items.filter((i) => !i.ok).map((i) => ({ category: c.name, text: i.text, gain: Math.round(i.max - i.earned), examples: (i as Item).examples })))
    .sort((a, b) => b.gain - a.gain); // every failed check is a suggestion (points only order them)
  return { score, categories, fixes, keywords: { matched: hit, missing }, against, at: new Date().toISOString() };
}

/** True when every word of the keyword is in the text as a whole word ("Power BI" isn't "PowerPoint"),
 *  counting word families ("modeling" finds "models", never "tables" for "Tableau"). Filler like "strong" is ignored. */
// What a resume shows instead of the posting's word ("CAD" → SolidWorks; "Bachelor's" → "B.S.").
const SAME: [RegExp, RegExp][] = [
  [/^cad$/, /\b(cad|solidworks|autocad|fusion 360|catia|creo|inventor|revit|onshape)\b/],
  [/^bachelor/, /\b(bachelor|b\.?s\.?|b\.?a\.?|b\.?b\.?a\.?|bsn|bfa)\b/],
  [/^bsn$/, /\b(bsn|bachelor of science in nursing|nursing)\b/],
  [/^teamwork$/, /\b(teamwork|team|collaborat\w*)\b/],
  [/^communication$/, /\b(communicat\w*|present\w*|wrote|writing|report\w*)\b/],
  [/^excel$/, /\b(excel|spreadsheet\w*)\b/],
  [/^ehr$/, /\b(ehr|epic|cerner|electronic health record\w*)\b/],
];
/** The Office program, not the everyday word. Any "Excel" counts as the program UNLESS it's clearly the verb: "excel
 *  at/under…", "strive/eager… to excel", "I/we/who/can excel", "learn, grow and excel". A missed skill (a false gap) is
 *  worse than the rare "EXCEL Program", so the default is the program (skeptic rounds 4–5: a strict "needs program
 *  context" rule missed 55 of 95 real lines). Outlook: capital "Outlook" unless after "market/credit/Q3…"; lowercase
 *  "outlook" only next to mail/calendar words, a tool word, or another program. Reads the student's own text. */
const PROGRAMS = String.raw`(?:microsoft\s+)?(?:word|excel|powerpoint|outlook|teams|zoom|slack|onenote|sharepoint|(?:ms|microsoft)\s+office|google\s+(?:sheets|docs|slides)|sheets|tableau|power\s*bi|python|sql|vba|quickbooks|salesforce|canva|bloomberg|factset|workday|sap)`;
// "<word> to excel" is the verb after these ("eager to excel", "Mentored freshmen to Excel"); "Exported reports to Excel" isn't.
const TO_EXCEL_VERB = /^(?:eager|driven|strive|strives|striving|want|wants|wanting|ready|looking|hope|hoping|aim|aims|aiming|continue|continues|committed|motivated|passion|passionate|determined|ability|chance|opportunity|desire|goal|learn|grow|work|working|push|pushes|pushed|inspire|inspired|encourage|encouraged|helped|help|helping|students|them|others|me|us|freshmen|teammates|players|kids|children|peers|members|athletes|everyone|team|youth|mentees|scholars)$/i;
// "learn, grow, and excel": the verb when "and/or" joins it to another verb.
const GROW_VERB = /^(?:learn|grow|lead|contribute|adapt|thrive|succeed|develop|improve|serve|collaborate|innovate|achieve)$/i;
const OUTLOOK_WORDS = /^(?:market|industry|economic|economy|financial|global|career|investment|sector|earnings|business|credit|housing|rate|rates|oil|energy|macro|fed|income|q[1-4]|weekly|monthly|quarterly|annual|positive|negative|fresh|optimistic|pessimistic|bright|long-term|short-term|future|growth|\d{4})$/i;
// "Excel Club", "EXCEL Program", "Outlook Magazine": an organization's name, not the program.
const ORG_NAME = /^\s+(?:club|scholars?|scholarship|program|programme|academy|charter|energy|staffing|sports|leadership|fellows?|fellowship|foundation|institute|center|centre|school|magazine|award|society|camp|partners|group|inc|llc)\b/i;
function excelIsVerb(before: string, after: string, word = "Excel"): boolean {
  if (ORG_NAME.test(after)) return true;
  if (/^\s+(?:at|under|academically)\b/i.test(after)) return true;
  const prev = (before.match(/([\w'-]+)\W*$/) || [])[1] || "";
  if (GROW_VERB.test(prev)) return true; // "lead/excel", "grow & excel"
  // "I excel", "students who excel in math", "players excel": a subject right before it.
  if ((/^(?:i|we|you|they|who|can|will|would|always|consistently|strive|strives)$/i.test(prev) || (prev.toLowerCase() !== "to" && TO_EXCEL_VERB.test(prev))) && /^\s*(?:in|on|with|as|and|,|\.|;|$)/i.test(after + " ")) return true;
  if (/^to$/i.test(prev)) {
    const p2 = (before.replace(/\W*to\W*$/i, "").match(/([\w'-]+)\W*$/) || [])[1] || "";
    return !p2 || TO_EXCEL_VERB.test(p2);
  }
  if (/^(?:and|or)$/i.test(prev)) {
    const p2 = (before.replace(/\W*(?:and|or)\W*$/i, "").match(/([\w'-]+)\W*$/) || [])[1] || "";
    // "Word and excel" is the program; "lead teams and excel" (lowercase, after a word that isn't a capitalised program) is the verb.
    return GROW_VERB.test(p2) || (word === "excel" && !(/^[A-Z]/.test(p2) && new RegExp(String.raw`^${PROGRAMS}$`, "i").test(p2)));
  }
  return false;
}
function productIn(text: string, name: string): boolean {
  const t = text, n = name.toLowerCase();
  if (new RegExp(String.raw`\b(?:microsoft|ms)\s+${n}\b`, "i").test(t)) return true;
  if (n === "powerpoint") return /\bpower\s?point\b/i.test(t);
  if (n === "visio") return /\bvisio\b/i.test(t);
  if (n === "excel") return /\bspreadsheets?\b/i.test(t) || [...t.matchAll(/\bexcel\b/gi)].some((m) => !excelIsVerb(t.slice(Math.max(0, m.index! - 60), m.index), t.slice(m.index! + m[0].length, m.index! + m[0].length + 30), m[0]));
  // Outlook
  if ([...t.matchAll(/\b(?:Outlook|OUTLOOK)\b/g)].some((m) => !ORG_NAME.test(t.slice(m.index! + m[0].length, m.index! + m[0].length + 20)) && !OUTLOOK_WORDS.test((t.slice(Math.max(0, m.index! - 40), m.index).match(/([\w'-]+)\W*$/) || [])[1] || ""))) return true;
  if (/\boutlook\s+(?:calendars?|e-?mails?|inbox(?:es)?|invites?|meetings?|scheduling|contacts)\b|\b(?:in|using|with|via|through)\s+Outlook\b/.test(t)) return true;
  if (t.trim().toLowerCase() === "outlook") return true;
  const sep = String.raw`\s*(?:,\s*(?:and\s+|&\s*)?|;|\||/|&|\+|\band\b)\s*`;
  return new RegExp(String.raw`\b${PROGRAMS}${sep}outlook\b|\boutlook${sep}${PROGRAMS}\b`, "i").test(t);
}

export function hasKeyword(text: string, keyword: string): boolean {
  // "Python or Java or C++": the posting asks for any one of them.
  if (/\sor\s/i.test(keyword)) return keyword.split(/\s+or\s+/i).some((k) => hasKeyword(text, k));
  // "Microsoft Excel" / "MS Excel" is the resume's "Excel" (distinct product names only: "Word" or "Project" alone are everyday words).
  const office = keyword.trim().match(/^(?:(?:advanced|basic|intermediate|strong|proficiency in|proficient in|experience with|knowledge of|microsoft|ms)\s+)*(excel|powerpoint|outlook|visio)(?:\s+(?:skills?|proficiency|experience|knowledge))?$/i);
  if (office) return productIn(text, office[1]);
  // "Microsoft Office" is shown by any of its apps on the resume.
  if (/^(?:microsoft|ms)\s+office(?:\s+suite)?$/i.test(keyword.trim())) return /\b(?:microsoft|ms)\s+(?:office|word|365)\b/i.test(text) || ["excel", "powerpoint", "outlook"].some((x) => productIn(text, x));
  const plain = plainEnglish(text); // "excel at" isn't Excel, "react to" isn't React
  const low = lc(plain);
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // One- and two-letter names ("R", "C") count only as their own word: not a middle initial "R." or "R&D".
  if (/^[A-Za-z]{1,2}$/.test(keyword.trim())) return new RegExp(`(?<![\\w&])${esc(keyword.trim())}(?![\\w&+#])`).test(plain);
  const words = lc(keyword).replace(/['’]s\b/g, "").split(/[\s/]+|-(?=[a-z])/).filter((w) => w && !/^(strong|solid|record|knowledge|interest|ability|skills?|experience|proficiency|proficient|familiarity|understanding|demonstrated|excellent|good|basic|hands-on|hands|on|pursuing|pursuit|pursue|currently|degree|program|enrollment|with|and|or|of|in|the|a|an)$/.test(w));
  const own = families(low);
  // Plain words match by word family ("modeling" finds "models"); words with symbols ("C++", "node.js") match whole.
  return words.length > 0 && words.every((w) =>
    (/^[a-z]+$/.test(w) ? own.has(family(w)) : new RegExp(`(^|[^a-z0-9])${esc(w)}($|[^a-z0-9])`).test(low)) || SAME.some(([k, r]) => k.test(w) && r.test(low)));
}

export { isSkillKeyword };
