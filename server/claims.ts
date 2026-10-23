import type { AtsCheck, ClaimFlag, Job, ResumeDoc } from "@shared/types";
import { hasKeyword } from "./ats";

// Deterministic unsupported-claim checker. It does not trust the AI: any
// number, tool/skill, credential, title, or organization name that appears in
// generated text but not in the student's own resume or approved facts is flagged.

const SKILL_TERMS = [
  "python", "sql", "r programming", "java", "javascript", "c++", "c#", "vba", "matlab", "sas", "stata", "spss", "tableau", "power bi",
  "excel", "powerpoint", "microsoft word", "ms word", "microsoft access", "ms access", "alteryx", "salesforce", "hubspot", "sap", "oracle", "netsuite", "quickbooks", "workday",
  "bloomberg", "capital iq", "factset", "pitchbook", "refinitiv", "morningstar", "argus", "github", "aws", "azure", "snowflake",
  "machine learning", "data science", "lbo", "dcf", "discounted cash flow", "three-statement", "3-statement", "financial modeling",
  "valuation", "comparable company", "precedent transaction", "m&a", "merger model", "accretion", "dilution", "pitch deck",
  "underwriting", "due diligence", "equity research", "portfolio management", "trading", "derivatives", "fixed income",
  "cfa", "series 7", "series 63", "series 79", "sie", "cpa", "cma", "frm", "six sigma", "pmp", "scrum", "agile",
  "spanish", "french", "mandarin", "tamil", "hindi", "german", "portuguese", "arabic",
  "copilot", "chatgpt", "prompt engineering", "generative ai", "llm", "autodesk", "fusion 360", "figma", "adobe",
];
const TITLE_TERMS = [
  "intern", "internship", "analyst", "associate", "manager", "director", "president", "vice president", "founder", "co-founder",
  "treasurer", "chair", "captain", "lead", "head", "officer", "consultant", "researcher", "teaching assistant", "tutor",
];
const STOP_CAPS = new Set([
  "I", "My", "The", "This", "That", "These", "In", "At", "As", "With", "For", "And", "But", "Through", "During", "Dear", "Sincerely",
  "Thank", "Thanks", "Best", "Regards", "Hiring", "Manager", "Team", "Recruiting", "Summer", "Fall", "Spring", "Winter", "January",
  "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Program",
  "Analyst", "Intern", "Internship", "Committee", "Mr", "Ms", "Mrs", "Dr", "While", "When", "Because", "Since", "Your", "Our",
  "We", "You", "It", "Its", "An", "A", "To", "Of", "On", "By", "From", "Into", "Also", "Additionally", "Finally", "Moreover",
  "Having", "Building", "Working", "Leading", "Managing", "Serving", "Before", "After", "Today", "Overall",
]);

// [pattern, root that must appear in the student's own words, what it claims]
const LEADERSHIP: [RegExp, string, string][] = [
  [/\b(led|leads|leading)\b/i, "lead", "led something"],
  [/\bsupervis(e|ed|es|ing|or)\b/i, "supervis", "supervised people"],
  [/\bmanag(e|ed|es|ing)\b/i, "manag", "managed something"],
  [/\b(oversaw|oversee|oversees|overseeing)\b/i, "overs", "oversaw something"],
  [/\bdirect(ed|s|ing)\b/i, "direct", "directed something"],
  [/\bspearhead(ed|s|ing)?\b/i, "spearhead", "spearheaded something"],
  [/\bheaded\b/i, "head", "headed something"],
];
const NUMBER_WORDS = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred|hundreds|thousand|thousands|million|millions|dozen|dozens)\b/gi;
// "graduate" alone is left out ("as I graduate in 2029" is not a credential claim).
const CREDENTIALS = /\b(master'?s|mba|ph\.?\s?d|doctoral|doctorate)(?:[- ](?:level|degree|course|program))?\b|\b(graduate)[- ](?:level|degree|course|program)\b|\b(certifi)ed\b|\b(licens)ed\b|\b(accredit)ed\b/gi;
const HEDGES = [/\bestimated\b/i, /\bapproximately\b/i, /\bapprox\.?(?=\s)/i, /\broughly\b/i, /\bnearly\b/i, /\balmost\b/i, /\bup to\b/i, /\bmore than\b/i, /\bat least\b/i, /\bco-(?:founded|led|organized|created|authored|chaired)\b/i, /\bhelped\b/i, /\bassisted\b/i, /\bcontributed\b/i, /\bparticipated\b/i];
const CLASS_YEAR = ["first-year", "first year", "freshman", "sophomore", "second-year", "second year", "junior", "third-year", "senior", "fourth-year"];
const STOP = new Set("about above across after again against among because before being below between both during each from further having into itself more most other over same some such than that their them then there these they this those through under until very what when where which while with within would your yours ours also just only onto upon".split(/\s+/));
const LIGHT = new Set("using including various multiple several across within helped worked support supported perform performed create created creating materials".split(" "));
const OUTCOME = /\b(ensuring|ensure|resulting in|leading to|which (improved|increased|reduced)|improv(ed|ing)|increas(ed|ing)|reduc(ed|ing)|driv(ed|ing)|streamlin(ed|ing)|optimiz(ed|ing)|boost(ed|ing)|to keep|enabl(ed|ing)|that emphasizes|emphasizing|demonstrating|showcasing)\b/i;

const lc = (s: string) => s.toLowerCase();
const normNum = (s: string) => s.replace(/[,$+\s]/g, "").replace(/[.]+$/, "").replace(/k$/i, "000").toLowerCase();

function hasTerm(hay: string, term: string) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(hay);
}

export function claimCheck(
  text: string,
  evidence: string,
  opts: { allowedNames?: string[]; postingText?: string; original?: string; postingNumbersOk?: boolean; entryContext?: string } = {},
): ClaimFlag[] {
  const flags: ClaimFlag[] = [];
  const ev = lc(evidence);
  const evNums = new Set((evidence.match(/\$?\d+(?:[.,]\d+)*\+?(?:[kKmM%](?![A-Za-z]))?/g) || []).map(normNum));
  const seen = new Set<string>();
  const add = (f: ClaimFlag) => {
    const k = f.type + ":" + lc(f.term);
    if (!seen.has(k)) {
      seen.add(k);
      flags.push(f);
    }
  };

  // placeholders the student must fill in
  for (const m of text.matchAll(/\[(?:PERSONALIZE|ADD|TODO)[^\]]*\]/gi)) add({ type: "placeholder", term: m[0], message: "Personalize this detail before export." });

  const body = text.replace(/\[(?:PERSONALIZE|ADD|TODO)[^\]]*\]/gi, " ");

  for (const m of body.matchAll(/\$?\d+(?:[.,]\d+)*\+?(?:\s?(?:k|K|m|M|%|percent)(?![A-Za-z]))?/g)) {
    const raw = m[0].trim();
    if (!/\d/.test(raw)) continue;
    const n = normNum(raw.replace(/\s?percent/, "%"));
    if (/^20\d\d$/.test(n) && ev.includes(n)) continue;
    if (opts.allowedNames?.some((a) => normNum(a).includes(n))) continue;
    // In a cover letter, figures quoted from the posting (e.g. "10-week program") describe the employer, not the student.
    if (opts.postingNumbersOk && opts.postingText && lc(opts.postingText).includes(n)) continue;
    if (!evNums.has(n) && !evNums.has(n.replace(/%$/, "")) && !ev.includes(n)) {
      add({ type: "number", term: raw, message: `The figure “${raw}” is not in your resume or approved facts.` });
    }
  }
  const t = lc(body);
  for (const term of ["fast-paced", "high-volume", "high-pressure", "high-stakes", "demanding", "rigorous", "deadline-driven"]) {
    if (hasTerm(t, term) && !hasTerm(ev, term) && !(opts.postingText && hasTerm(lc(opts.postingText), term) && !opts.original)) {
      add({ type: "scope", term, message: `“${term}” describes your experience in a way your resume doesn't support. Remove it or add evidence.` });
    }
  }
  // Leadership verbs the student's own words don't support ("Led", "supervised", "managed").
  // A rewrite is compared to its own entry; a letter to the whole resume.
  const own = lc(opts.original !== undefined ? opts.original + " " + (opts.entryContext || "") : evidence);
  for (const [re, root, word] of LEADERSHIP) {
    const m = body.match(re);
    if (m && !own.includes(root) && !re.test(own)) add({ type: "title", term: m[0], message: `“${m[0]}” claims you ${word}, which your ${opts.original !== undefined ? "original bullet" : "resume"} doesn't say. Keep it only if it's true.` });
  }
  // Numbers written as words ("a team of five", "thirty percent").
  for (const m of body.matchAll(NUMBER_WORDS)) {
    const w = lc(m[0]);
    if (hasTerm(ev, w) || (opts.postingNumbersOk && opts.postingText && hasTerm(lc(opts.postingText), w))) continue;
    add({ type: "number", term: m[0], message: `The amount “${m[0]}” is not in your resume or approved facts.` });
  }
  // Degrees and credentials ("master's-level", "MBA", "certified").
  for (const m of body.matchAll(CREDENTIALS)) {
    const root = lc(m.slice(1).find(Boolean) || m[0]);
    if (!ev.includes(root.replace(/'/g, ""))  && !ev.includes(root)) add({ type: "title", term: m[0], message: `“${m[0]}” describes a degree or credential your resume doesn't show.` });
  }
  // Hedges dropped from the original ("an estimated budget" → "a budget") make a claim sound more certain.
  if (opts.original !== undefined) {
    for (const h of HEDGES) {
      const m = opts.original.match(h);
      if (m && !h.test(body)) add({ type: "scope", term: m[0], message: `Your original says “${m[0]}”. Dropping it makes the claim sound more certain than your resume does; keep it.` });
    }
  }
  // Letters have no original bullet: a figure the resume hedges ("an estimated $5,000+") must keep a hedge nearby.
  if (opts.original === undefined) {
    // Thousands separators only, so "$5,000," at a clause end still matches the resume's "$5,000+".
    for (const m of body.matchAll(/\$?\d+(?:,\d{3})*/g)) {
      const near = lc(body.slice(Math.max(0, m.index! - 60), m.index! + 60));
      if (/\b(estimated|approximately|roughly|nearly|about|up to|around)\b/.test(near)) continue;
      // The same figure can appear twice on a resume; only the occurrence the letter is talking about counts.
      for (let at = evidence.indexOf(m[0]); at >= 0; at = evidence.indexOf(m[0], at + 1)) {
        const ctx = lc(evidence.slice(Math.max(0, at - 45), at));
        const hedge = ctx.match(/\b(estimated|approximately|roughly|nearly|about|up to)\b/);
        if (hedge && (ctx.match(/[a-z]{5,}/g) || []).some((w) => w !== hedge[1] && near.includes(w))) {
          add({ type: "scope", term: hedge[1], message: `Your resume says “${hedge[1]}” about ${m[0]}. Keep that word so the letter isn't more certain than your resume.` });
          break;
        }
      }
    }
  }
  for (const term of CLASS_YEAR) {
    // Only when it describes the student ("as a senior", "junior year"), not "senior finance leaders".
    const aboutStudent = new RegExp(`\\b(a|an|as a|i am a|i'm a|rising|current)\\s+${term}\\b|\\b${term}\\s+(year|student|at|in|majoring|studying)\\b`, "i");
    if (aboutStudent.test(t) && !hasTerm(ev, term)) {
      add({ type: "title", term, message: `Class standing “${term}” is not stated in your resume or profile. Set your class year in Accounts or remove it.` });
    }
  }
  // Rewrites that add outcomes or scope the original bullet never claimed.
  if (opts.original !== undefined) {
    const IRREG: Record<string, string> = { built: "build", led: "lead", ran: "run", made: "make", wrote: "write", taught: "teach", won: "win", grew: "grow", began: "begin", held: "hold" };
    const stem = (w: string) => {
      let x = IRREG[w] || w;
      x = x.replace(/(ing|ed|es|s)$/, "");
      return x.slice(0, 6);
    };
    const evStems = new Set((lc(evidence + " " + (opts.postingText || "")).match(/[a-z][a-z-]{3,}/g) || []).map(stem));
    const novel = Array.from(new Set((t.match(/[a-z][a-z-]{4,}/g) || []).filter((w) => !STOP.has(w) && !evStems.has(stem(w)))));
    const outcome = body.match(OUTCOME);
    const newOutcome = outcome && !lc(opts.original).includes(lc(outcome[0]));
    // Detail added relative to THIS entry (the bullet, its siblings, role and org).
    // Words that exist elsewhere in the resume don't make an added clause true here.
    const local = lc(opts.original + " " + (opts.entryContext || "")).replace(/\bib\b/g, "investment banking");
    const localStems = new Set((local.match(/[a-z][a-z-]{3,}/g) || []).map(stem));
    const added = Array.from(new Set((t.match(/[a-z][a-z-]{3,}/g) || []).filter((w) => !STOP.has(w) && !LIGHT.has(w) && !localStems.has(stem(w)))));
    if (added.length >= 3 && novel.length < 3 && !newOutcome) {
      add({
        type: "scope",
        term: added.slice(0, 6).join(", "),
        message: `This rewrite adds detail that isn't in this entry (${added.slice(0, 6).join(", ")}). Keep it only if it's true for this experience.`,
      });
    }
    if (newOutcome || novel.length >= 3) {
      add({
        type: "scope",
        term: novel.slice(0, 6).join(", ") || (outcome ? outcome[0] : ""),
        message: `This rewrite adds claims your original bullet doesn't make${novel.length ? ` (new wording: ${novel.slice(0, 6).join(", ")})` : ""}${newOutcome ? `${novel.length ? " and" : ""} an outcome (“${outcome![0]}…”)` : ""}. Keep it only if it's true.`,
      });
    }
  }
  for (const term of SKILL_TERMS) {
    if (hasTerm(t, term) && !hasTerm(ev, term)) {
      const inPosting = opts.postingText && hasTerm(lc(opts.postingText), term);
      add({
        type: "skill",
        term,
        message: inPosting
          ? `“${term}” comes from the posting, not from your experience. Remove it or confirm you really have it.`
          : `“${term}” is not supported by your resume or approved facts.`,
      });
    }
  }
  for (const term of TITLE_TERMS) {
    if (hasTerm(t, term) && !hasTerm(ev, term)) {
      // "internship"/"analyst" are fine when naming the target role
      const allowed = (opts.allowedNames || []).some((n) => hasTerm(lc(n), term));
      if (!allowed) add({ type: "title", term, message: `The title/role word “${term}” does not appear in your background.` });
    }
  }
  const allowed = (opts.allowedNames || []).map(lc);
  for (const sentence of body.split(/(?<=[.!?])\s+|\n+/)) {
    for (const m of sentence.matchAll(/\b([A-Z][a-zA-Z&'-]*(?:\.[A-Z])*\.?(?:\s+(?:of|and|&|for|the)?\s*[A-Z][a-zA-Z&'-]*(?:\.[A-Z])*)*)/g)) {
      let words = m[1].replace(/[.]$/, "").trim().split(/\s+/);
      if (m.index === 0) words = words.slice(1); // sentence-initial capital is not a name signal
      while (words.length && /^(of|and|&|for|the)$/i.test(words[0])) words = words.slice(1);
      const phrase = words.join(" ");
      if (!phrase || (words.length === 1 && (STOP_CAPS.has(phrase) || phrase.length < 3))) continue;
      const meaningful = words.filter((w) => !STOP_CAPS.has(w) && !/^(of|and|&|for|the)$/i.test(w));
      if (!meaningful.length) continue;
      const pl = lc(phrase);
      if (ev.includes(pl) || allowed.some((a) => a.includes(pl) || pl.includes(a))) continue;
      // "TCU's" is the resume's "TCU".
      if (meaningful.map((w) => lc(w).replace(/['’]s$/, "")).every((w) => ev.includes(w) || allowed.some((a) => a.includes(w)))) continue;
      add({ type: "name", term: phrase, message: `“${phrase}” is not mentioned in your resume or approved facts.` });
    }
  }
  return flags;
}

export function evidenceText(resumeRaw: string, facts: string[]) {
  return resumeRaw + "\n" + facts.join("\n");
}

// ---------- ATS-format checks on the composed resume ----------
export function atsChecks(doc: ResumeDoc, job: Job, fileBase: string): AtsCheck[] {
  const text = [doc.contact.name, ...doc.sections.flatMap((s) => [s.heading, ...s.entries.flatMap((e) => [e.org, e.role, e.dates, ...e.bullets.map((b) => b.text)])]), ...doc.skills.map((k) => k.label + " " + k.items)].join("\n");
  const words = text.split(/\s+/).filter(Boolean).length;
  const headings = doc.sections.map((s) => lc(s.heading));
  const longBullets = doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).filter((b) => b.text.length > 260);
  const undated = doc.sections
    .filter((s) => !/cert|skill|award|honor/i.test(s.heading))
    .flatMap((s) => s.entries)
    .filter((e) => (e.role || e.bullets.length) && !e.dates.trim());
  const reqHits = job.requirements.filter((r) => hasKeyword(text, r.keyword));
  const placeholders = /\[(PERSONALIZE|ADD|TODO)/i.test(text);
  return [
    { id: "contact", label: "Contact details at the top", pass: !!doc.contact.name && !!doc.contact.email, detail: doc.contact.email ? "Name and email found." : "Add an email address to the contact line." },
    { id: "headings", label: "Standard section headings", pass: headings.some((h) => h.includes("education")) && headings.some((h) => /experience|projects|leadership/.test(h)), detail: "ATS parsers look for Education and Experience-style headings." },
    { id: "layout", label: "Single column, no tables, images or text boxes", pass: true, detail: "Remy exports a one-column document with real text only." },
    { id: "font", label: "Readable standard font", pass: true, detail: "Exports use Calibri 10.5–11 pt (Word) / Helvetica (PDF)." },
    { id: "dates", label: "Every experience entry has dates", pass: undated.length === 0, detail: undated.length ? `Missing dates: ${undated.map((e) => e.org || e.role).join(", ")}` : "All entries are dated." },
    { id: "bullets", label: "Bullets are concise (under ~2 lines)", pass: longBullets.length === 0, detail: longBullets.length ? `${longBullets.length} bullet(s) run long.` : "All bullets are a scannable length." },
    { id: "length", label: "Fits about one page for an undergraduate", pass: words <= 700, detail: `${words} words.` },
    { id: "keywords", label: "Posting priorities reflected (only where true)", pass: reqHits.length >= Math.min(2, job.requirements.length), detail: `${reqHits.length} of ${job.requirements.length} posting priorities appear. Never add a keyword you can't support.` },
    { id: "placeholders", label: "No unfinished placeholders", pass: !placeholders, detail: placeholders ? "Remove [PERSONALIZE] markers." : "None found." },
    { id: "filename", label: "Clear file name", pass: true, detail: `${fileBase}.docx` },
  ];
}
