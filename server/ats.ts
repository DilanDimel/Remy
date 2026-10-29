import type { AtsScore, Job, ResumeDoc } from "@shared/types";

// ATS readiness score out of 100, computed from the resume itself (no AI), so
// it's instant and gives the same number every time. Each lost point comes with
// the specific fix that would earn it back.

const STRONG = /^(led|built|grew|launched|managed|created|designed|developed|analyz|organized|trained|presented|drove|owned|published|surveyed|coordinated|improved|increased|reduced|negotiated|founded|directed|executed|implemented|researched|modeled|forecast|automated|streamlined|delivered|won|raised|secured|mentored|wrote|produced|planned|conducted|evaluated|optimized|spearheaded|initiated|established|collaborated|supported|prepared|assisted|served|tutored|taught|volunteered|completed|calculated|reviewed|tracked|built)/i;
// Past-tense verbs ("Organized", "Pitched") count too, minus a few that aren't actions.
const PAST_VERB = /^(?!(?:need|interest|based|located|expected|detailed|related|used)ed\b)[A-Z][a-z]{2,}ed\b/;
// Present tense is right for a current role ("Manage…", "Provide…").
const PRESENT = /^(lead|build|grow|launch|manage|create|design|develop|analy[sz]e|organi[sz]e|train|present|drive|own|publish|coordinate|improve|increase|reduce|negotiate|direct|execute|implement|research|model|forecast|automate|deliver|raise|mentor|write|produce|plan|conduct|evaluate|optimi[sz]e|collaborate|support|prepare|serve|tutor|teach|run|oversee|maintain|review|track|provide|advise|facilitate|recruit|schedule|process|operate|handle|assist)s?\b/i;
const isAction = (b: string) => STRONG.test(b) || PAST_VERB.test(b) || PRESENT.test(b);
const WEAK = /^(responsible for|helped|assisted with|worked on|duties included|tasked with|was in charge of|handled|did)\b/i;
const QUANT = /\d|%|\$/;

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
  const isListSection = (h: string) => /educ|skill|course|honou?r|award|interest|certif|language|activit/i.test(h);
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
    item(new Set(entries.map((e) => (/[a-z]{3}\s+\d{4}/i.test(e.dates) ? "word" : /\d{1,2}\/\d{4}/.test(e.dates) ? "num" : "other"))).size <= 1, 3, "Dates use one consistent format.", "Use one date format everywhere (e.g. \"Jun 2026 – Aug 2026\")."),
  ]);

  const kws = Array.from(new Set((keywords || []).map((k) => k.trim()).filter((k) => k && isSkillKeyword(k)))).slice(0, 15);
  const hit = kws.filter((k) => hasKeyword(low, k));
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
    .filter((f) => f.gain > 0).sort((a, b) => b.gain - a.gain);
  return { score, categories, fixes, keywords: { matched: hit, missing }, against, at: new Date().toISOString() };
}

/** True when every word of the keyword is in the text as a whole word ("Power BI" isn't "PowerPoint");
 *  longer words match on their first 5 letters so "modeling" finds "models". Filler like "strong" is ignored. */
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
export function hasKeyword(text: string, keyword: string) {
  const low = lc(text);
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const words = lc(keyword).replace(/['’]s\b/g, "").split(/[\s/]+/).filter((w) => w && !/^(strong|solid|record|knowledge|interest|ability|skills?|experience|proficiency|proficient|familiarity|understanding|demonstrated|excellent|good|basic|hands-on|pursuing|pursuit|pursue|currently|degree|program|enrollment|with|and|or|of|in|the|a|an)$/.test(w));
  return words.length > 0 && words.every((w) =>
    new RegExp(w.length > 5 ? `\\b${esc(w.slice(0, 5))}` : `(^|[^a-z0-9])${esc(w)}($|[^a-z0-9])`).test(low) || SAME.some(([k, r]) => k.test(w) && r.test(low)));
}

/** Skills and qualities an ATS can match — not eligibility rules (class year, GPA,
 * work authorization) or hiring steps (assessments, HireVue, "resume + transcript"). */
export function isSkillKeyword(k: string) {
  return !/\b(?:freshm|first-year|sophom|junior|senior|class of|gpa|graduat|enrolled|authoriz|sponsor|citizen|applica|apply|assessment|hirevue|predictive index|transcript|resume|cv\b|cover letter|interview|deadline|diversity|interest|motivat|curious|passion|work ethic|eligib|academic record|degree in progress|background check|drug (test|screen)|driver'?s licen)/i.test(k);
}
