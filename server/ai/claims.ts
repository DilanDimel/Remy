import { postingSkills } from "@shared/requirements";
import type { AtsCheck, ClaimFlag, Job, ResumeDoc, ResumeStyle } from "@shared/types";
import { family, families } from "@shared/words";
import { hasKeyword } from "../resume/ats";
import { wordFont } from "../resume/docs";

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
const REWORD = /^(author|writ|wrote|draft|compos|collaborat|cooperat|partner|model|analy[sz]|assess|evaluat|review|examin|design|develop|build|built|construct|conduct|coordinat|organiz|arrang|assist|aid|run|ran|operat|fabricat|machin|prepar|creat|produc|perform|complet|execut|deliver|handl|process|apply|appli|test|measur|calculat|research|investigat|present|communicat|explain|document|record|maintain|manag(?!er)|track|monitor|serv|help|support|contribut|participat|work|utiliz|employ|leverag)/;
const LIGHT = new Set("using including various multiple several across within helped worked support supported perform performed create created creating materials".split(" "));
const OUTCOME = /\b(ensuring|ensure|resulting in|leading to|which (improved|increased|reduced)|improv(ed|ing)|increas(ed|ing)|reduc(ed|ing)|driv(ed|ing)|streamlin(ed|ing)|optimiz(ed|ing)|boost(ed|ing)|to keep|enabl(ed|ing)|that emphasizes|emphasizing|demonstrating|showcasing)\b/i;


const lc = (s: string) => s.toLowerCase();

/** Content words in `text` the student's own words never say, compared by word family ("sorted" covers
 * "sorting", "donation" covers "donated", but "accounted" doesn't cover "accountability"). Rewording verbs and filler don't count. */
export function unsaidWords(text: string, said: string) {
  const own = families(said);
  const said_ = (w: string) => w.split("-").every((p) => !p || own.has(family(p)));
  return [...new Set((lc(text).match(/[a-z][a-z-]{3,}/g) || []).filter((w) => !STOP.has(w) && !LIGHT.has(w) && !REWORD.test(w) && !said_(w)))];
}
const normNum = (s: string) => s.replace(/[,$+\s]/g, "").replace(/[.]+$/, "").replace(/k$/i, "000").toLowerCase();

function hasTerm(hay: string, term: string) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`, "i").test(hay);
}

/** Words in `text` that spell out an abbreviation the student used ("RN" → "registered nurses", "PBC" → "Provided by Client"). */
export function spelledOut(text: string, own: string): string {
  // Small words may or may not count toward an abbreviation ("PBC" = Provided by Client; "EHR" = electronic health records).
  const all = text.split(/[^A-Za-z]+/).filter((w) => w.length > 1);
  const lists = [all, all.filter((w) => !/^(of|and|the|for|by|to|in|on)$/i.test(w))];
  const out: string[] = [];
  for (const a of new Set((own.match(/\b[A-Z]{2,5}(?=s?\b)/g) || []).map((x) => x.toLowerCase())))
    for (const words of lists)
      for (let i = 0; i + a.length <= words.length; i++) {
        const run = words.slice(i, i + a.length);
        if (run.map((w) => w[0].toLowerCase()).join("") === a) out.push(...run);
      }
  return out.join(" ");
}

export function claimCheck(
  text: string,
  evidence: string,
  opts: { allowedNames?: string[]; postingText?: string; original?: string; postingNumbersOk?: boolean; entryContext?: string; strict?: boolean } = {},
): ClaimFlag[] {
  // An abbreviation spelled out is the same claim, not new detail.
  const spelled = spelledOut(text, evidence + " " + (opts.original || ""));
  if (spelled) { evidence += " " + spelled; if (opts.original !== undefined) opts = { ...opts, original: opts.original + " " + spelled }; }
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
    // "a tracker to manage requests": the tool manages, not the student.
    const toolDoes = new RegExp(`\\b(tool|tracker|system|spreadsheet|dashboard|database|template|app|process|workflow)s?\\s+(to|that|for)\\s+${m?.[0] || "x"}`, "i").test(body);
    if (m && !own.includes(root) && !re.test(own) && !toolDoes) add({ type: "title", term: m[0], message: `“${m[0]}” claims you ${word}, which your ${opts.original !== undefined ? "original bullet" : "resume"} doesn't say. Keep it only if it's true.` });
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
      // "Assisted" → "supported" gives the same credit; only dropping the hedge altogether overstates.
      const sameCredit = /^(helped|assisted|contributed|participated)$/i.test(m?.[0] || "") && /\b(help\w*|assist\w*|support\w*|aid(ed|ing)?|contribut\w*|participat\w*)\b/i.test(body);
      if (m && !h.test(body) && !sameCredit) add({ type: "scope", term: m[0], message: `Your original says “${m[0]}”. Dropping it makes the claim sound more certain than your resume does; keep it.` });
    }
  }
  if (opts.original !== undefined) {
    const orig = lc(opts.original), ctxt = lc(opts.entryContext || "");
    // A job simulation (Forage, "virtual experience") must stay labeled as one.
    if (/\b(simulat\w*|virtual (experience|internship|program)|forage)\b/.test(orig + " " + ctxt) && !/\b(simulat\w*|virtual|forage)\b/i.test(body) && /\b(intern(ship)?|analyst|worked (at|for)|employed|at (j\.?p\.? ?morgan|goldman|deloitte|pwc|ey|kpmg|citi|bank of america))\b/i.test(body))
      add({ type: "title", term: "simulation", message: "This was a job simulation. Keep it clearly labeled as one; don't make it read like a job or internship." });
    // Team work presented as solo work.
    if (/\b(team|group|we|collaborat\w*|with (my|our|a|the) (team|group|classmates|peers))\b/.test(orig) && !/\b(team|group|collaborat\w*|with|helped|contributed|co-|jointly|alongside|partnered)\b/i.test(body))
      add({ type: "scope", term: "team", message: "Your original describes team work. Say it was a team effort (for example \"with a team of classmates\")." });
    // A recommendation or plan presented as an achieved result.
    if (/\b(recommend\w*|propos\w*|suggest\w*|plann?ed|pitch\w*|designed a (plan|proposal|strategy))\b/.test(orig)) {
      const m = body.match(/\b(increas\w*|grew|grow\w*|boost\w*|reduc\w*|sav(ed|ing)|cut|improv\w*|generat\w*|drove|driving|delivered|achiev\w*|implement\w*|launch\w*)\b/i);
      if (m && !new RegExp(`\\b${m[1].slice(0, 5)}`, "i").test(orig)) add({ type: "scope", term: m[0], message: `Your original says you recommended or proposed this. \u201c${m[0]}\u201d makes it sound like it happened; keep it as a recommendation.` });
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
  // Where or how a skill was learned, or what a job taught them, is the student's to say (Dilan, Nov 18: ask, don't
  // invent). Judged per sentence and per skill: "Through my coursework I built Excel skills" needs the student's own
  // "Where I learned Excel — In a class" (a coursework section or a class answer for another skill doesn't count), and
  // every word naming the class ("my corporate finance classes") must be in their answer. "It taught me…" needs their
  // own words. Plans and hopes ("I look forward to learning how to…") aren't claims about the past.
  const q = (x: string) => lc(x).replace(/[’‘]/g, "'").replace(/\s+/g, " ");
  const said = q(evidence + " " + (opts.original || ""));
  const ownWords = q(opts.original || "");
  const learned = [...evidence.matchAll(/Where I learned ([^—\n]+?)\s+—\s+([^\n]+)/g)].map((f) => ({ skill: f[1].trim(), answer: f[2].trim() }));
  const sentenceAt = (i: number) => { const a = text.slice(0, i).search(/[^.!?\n]*$/); const b = text.slice(i).search(/[.!?\n]/); return text.slice(a, b < 0 ? text.length : i + b); };
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameIn = (name: string, t: string) => new RegExp(String.raw`(?<![\w])${esc(name)}(?![\w+#])`, "i").test(t);
  const SKILL_TALK = /\b(?:learn\w*|buil[td]|develop\w*|gain\w*|proficien\w*|skills?|competenc\w*|experience\s+(?:with|in)|familiar\w*|master\w*)\b/i;
  // Also "built Excel skills while pursuing a Finance degree" (the Strongest match card, Nov 18).
  for (const m of text.matchAll(/\b(?:through|from|via|in|during)\s+(?:my|our)\s+((?:[\w-]+\s+){0,3}?)(?:course\s*work|courses?|classes|class|curriculum|studies|program|major|degree)\b|\bwhile\s+(?:pursuing|studying|earning|completing|working\s+toward)\s+(?:a|an|my|our)\s+((?:[\w-]+\s+){0,3}?)(?:degree|major|coursework|studies)\b/gi)) {
    const sentence = sentenceAt(m.index!);
    if (!SKILL_TALK.test(sentence)) continue; // "Through my studies at TCU, I became interested in banking" says nothing about a skill
    if (/^(?:in|during)\b/i.test(m[0]) && /studies$/i.test(m[0])) continue; // "during my studies" is when, not where
    if (ownWords && ownWords.includes(q(m[0]))) continue; // the student's own words (a rewrite or bullet keeping them)
    const mods = (m[1] || m[2] || "").trim().split(/\s+/).filter((w) => w && !/^(?:the|a|an|own)$/i.test(w));
    const ok = learned.some((f) => /\b(?:class|course)/i.test(f.answer) && nameIn(f.skill, sentence) && mods.every((w) => nameIn(w, f.answer)));
    if (!ok) add({ type: "scope", term: m[0], message: `“${m[0]}” says where you learned this, and you haven't told Remy that. Tell Remy where you learned it, or remove it.` });
  }
  for (const m of text.matchAll(/\b(?:taught|teaches|showed)\s+me\b|\bgave\s+me\s+an?\s+(?:\w+\s+)?(?:sense|appreciation|understanding)\b|\blearned\s+(?:the\s+(?:importance|value)\s+of|how\s+to)\b|\bhelped\s+me\s+(?:to\s+)?(?:develop|build|learn|grow|strengthen|understand|realize|become|improve|gain)\b|\b(?:allowed|enabled)\s+me\s+to\s+(?:develop|build|learn|gain|grow|strengthen|improve)\b|\bwhere\s+I\s+learned\b/gi)) {
    const sentence = sentenceAt(m.index!);
    const before = sentence.slice(0, Math.max(0, sentence.indexOf(m[0])));
    if (/\b(?:will|would|could|can|hope|hoping|look(?:ing)?\s+forward|excited|eager|interested|want|wants|plan|aim|seek)\b/i.test(before)) continue;
    if (ownWords && ownWords.includes(q(m[0]))) continue; // "Learned how to…" kept from the student's own bullet
    // The phrase plus the words after it, up to the next comma or full stop, must be the student's own.
    const tail = (text.slice(m.index! + m[0].length).match(/^[^.,;!?\n]*/)?.[0] || "").trim().split(/\s+/).slice(0, 3).join(" ");
    if (!said.includes(q(`${m[0]} ${tail}`).trim())) add({ type: "scope", term: m[0], message: `“${m[0]}” says what an experience taught you, in Remy's words, not yours. Tell Remy in your own words, or remove it.` });
  }
  // Check-ins: every detail must come from what the student said, so even one new word is flagged.
  if (opts.strict) {
    const u = unsaidWords(body, evidence + " " + (opts.original ?? ""));
    if (u.length) add({ type: "scope", term: u.slice(0, 6).join(", "), message: `This adds words you didn't say (${u.slice(0, 6).join(", ")}). Keep them only if they're true.` });
  }
  // Rewrites that add outcomes or scope the original bullet never claimed.
  if (opts.original !== undefined && !opts.strict) {
    // Hyphenated words ("cross-functional") compare as their parts.
    const stem = (w: string) => w.split("-").map(family).join("-");
    const evStems = new Set((lc(evidence + " " + (opts.postingText || "")).match(/[a-z][a-z-]{3,}/g) || []).map(stem));
    const novel = Array.from(new Set((t.match(/[a-z][a-z-]{4,}/g) || []).filter((w) => !STOP.has(w) && !LIGHT.has(w) && !REWORD.test(w) && !evStems.has(stem(w)))));
    const outcome = body.match(OUTCOME);
    const newOutcome = outcome && !lc(opts.original).includes(lc(outcome[0]));
    // Detail added relative to THIS entry (the bullet, its siblings, role and org).
    // Words that exist elsewhere in the resume don't make an added clause true here.
    const local = lc(opts.original + " " + (opts.entryContext || "")).replace(/\bib\b/g, "investment banking");
    const localStems = new Set((local.match(/[a-z][a-z-]{3,}/g) || []).map(stem));
    // Rewording verbs ("collaborated", "modeled", "analyzed") restate what the student did; they aren't new facts.
    const added = Array.from(new Set((t.match(/[a-z][a-z-]{3,}/g) || []).filter((w) => !STOP.has(w) && !LIGHT.has(w) && !REWORD.test(w) && !localStems.has(stem(w)))));
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
      // Spoken contractions ("Now, I'm looking", "and I've worked") are not names.
      if (words.length === 1 && /^(I|It|That|There|Here|What|We|You|They|He|She|Let)['’](m|ve|d|ll|s|re)$/.test(phrase)) continue;
      // "TCU" when the record says "Texas Christian University": the initials of a name already on file.
      if (words.length === 1 && /^[A-Z]{2,5}$/.test(phrase) && initialsOn(phrase, [evidence, ...(opts.allowedNames || [])])) continue;
      const meaningful = words.filter((w) => !STOP_CAPS.has(w) && !/^(of|and|&|for|the)$/i.test(w));
      if (!meaningful.length) continue;
      const pl = lc(phrase);
      if (ev.includes(pl) || allowed.some((a) => a.includes(pl) || pl.includes(a))) continue;
      // "TCU's" is the resume's "TCU", and "RNs" its "RN".
      if (meaningful.map((w) => lc(w.replace(/^([A-Z]{2,5})s$/, "$1")).replace(/['’]s$/, "")).every((w) => ev.includes(w) || allowed.some((a) => a.includes(w)))) continue;
      add({ type: "name", term: phrase, message: `“${phrase}” is not mentioned in your resume or approved facts.` });
    }
  }
  return flags;
}

/** True when `abbr` is the initials of one whole name on a single line of `texts` ("TCU" ← "Texas Christian University";
 *  small words like "of" may count or not). Never a slice of a name or words from two lines, so "UBS" isn't
 *  read out of "University" + "Bachelor of Science". */
function initialsOn(abbr: string, texts: string[]) {
  for (const t of texts)
    for (const m of t.matchAll(/[A-Z][a-zA-Z&'-]*(?:[ \t]+(?:of|and|&|for|the|[A-Z][a-zA-Z&'-]*))+/g)) {
      const w = m[0].split(/[ \t]+/);
      if (w.map((x) => x[0]).join("").toUpperCase() === abbr || w.filter((x) => /^[A-Z]/.test(x)).map((x) => x[0]).join("") === abbr) return true;
    }
  return false;
}

export function evidenceText(resumeRaw: string, facts: string[]) {
  return resumeRaw + "\n" + facts.join("\n");
}

// ---------- ATS-format checks on the composed resume ----------
/** Tables, text boxes and columns in the student's own Word file (some applicant tracking systems read them out of order).
 *  Left out when Remy hasn't seen the file's layout (a PDF, or a Word file uploaded before this check). */
function layoutCheck(style?: ResumeStyle): AtsCheck[] {
  const l = style?.layout;
  if (!l) return [];
  const found = [l.tables && "a table", l.textBoxes && "text boxes", l.columns && "two or more columns"].filter(Boolean) as string[];
  return [{ id: "layout", label: "Single column, no tables or text boxes", pass: !found.length, detail: found.length ? `Your Word file uses ${found.join(" and ")}. Some applicant tracking systems read those out of order; if an online application garbles your details, upload Remy's one-column PDF instead.` : "Your Word file is one column with no tables or text boxes." }];
}

// Fonts that come with Windows and Mac Office, so a Word file opens the same on a recruiter's computer.
// Compared without spaces or style suffixes, since PDFs name them "TrebuchetMS", "PalatinoLinotype-Roman", "ArialMT".
const STANDARD_FONTS = new Set("arial calibri cambria timesnewroman georgia garamond helvetica helveticaneue verdana tahoma trebuchetms trebuchet bookantiqua palatino palatinolinotype aptos centurygothic couriernew".split(" "));
const fontKey = (f: string) => f.toLowerCase().replace(/[-,].*$/, "").replace(/[^a-z]/g, "").replace(/(psmt|mt|ps|regular)$/, "");
/** The student's own font and size, as read from their file. Left out when Remy doesn't know them (a pasted resume). */
export function fontCheck(style?: ResumeStyle): AtsCheck[] {
  if (!style?.font) return [];
  const font = wordFont(style), size = Math.round(style.size * 2) / 2;
  const standard = STANDARD_FONTS.has(fontKey(font)) || STANDARD_FONTS.has(fontKey(style.font)), readable = size >= 10;
  const detail = !standard ? `${font} isn't installed on every computer, so Word may swap it for another font when a recruiter opens your file. Arial, Calibri, Garamond and Times New Roman look the same everywhere.`
    : !readable ? `Your body text is about ${size} pt. 10 to 12 pt is easier to read.`
    : `${font}, about ${size} pt: a standard font that looks the same on any computer.`;
  return [{ id: "font", label: "Readable standard font", pass: standard && readable, detail }];
}

export function atsChecks(doc: ResumeDoc, job: Job, fileBase: string, style?: ResumeStyle): AtsCheck[] {
  const text = [doc.contact.name, ...doc.sections.flatMap((s) => [s.heading, ...s.entries.flatMap((e) => [e.org, e.role, e.dates, ...e.bullets.map((b) => b.text)])]), ...doc.skills.map((k) => k.label + " " + k.items)].join("\n");
  const words = text.split(/\s+/).filter(Boolean).length;
  const headings = doc.sections.map((s) => lc(s.heading));
  const longBullets = doc.sections.flatMap((s) => s.entries.flatMap((e) => e.bullets)).filter((b) => b.text.length > 260);
  const undated = doc.sections
    .filter((s) => !/cert|skill|award|honor/i.test(s.heading))
    .flatMap((s) => s.entries)
    .filter((e) => (e.role || e.bullets.length) && !e.dates.trim());
  const asks = postingSkills(job.requirements);
  const reqHits = asks.filter((k) => hasKeyword(text, k));
  const placeholders = /\[(PERSONALIZE|ADD|TODO)/i.test(text);
  return [
    { id: "contact", label: "Contact details at the top", pass: !!doc.contact.name && !!doc.contact.email, detail: doc.contact.email ? "Name and email found." : "Add an email address to the contact line." },
    { id: "headings", label: "Standard section headings", pass: headings.some((h) => h.includes("education")) && headings.some((h) => /experience|projects|leadership/.test(h)), detail: "ATS parsers look for Education and Experience-style headings." },
    ...layoutCheck(style),
    ...fontCheck(style),
    { id: "dates", label: "Every experience entry has dates", pass: undated.length === 0, detail: undated.length ? `Missing dates: ${undated.map((e) => e.org || e.role).join(", ")}` : "All entries are dated." },
    { id: "bullets", label: "Bullets are concise (under ~2 lines)", pass: longBullets.length === 0, detail: longBullets.length ? `${longBullets.length} bullet(s) run long.` : "All bullets are a scannable length." },
    { id: "length", label: "Fits about one page for an undergraduate", pass: words <= 700, detail: words < 250 ? `${words} words: fits easily, with room to add detail to your strongest roles.` : `${words} words.` },
    { id: "keywords", label: "Posting priorities reflected (only where true)", pass: reqHits.length >= Math.min(2, asks.length), detail: asks.length ? `${reqHits.length} of ${asks.length} skills the posting names appear${asks.length > reqHits.length ? ` (not shown: ${asks.filter((k) => !reqHits.includes(k)).slice(0, 5).join(", ")})` : ""}. Never add one you can't support.` : "Remy couldn't read specific skills in this posting." },
    { id: "placeholders", label: "No unfinished placeholders", pass: !placeholders, detail: placeholders ? "Remove [PERSONALIZE] markers." : "None found." },
    { id: "filename", label: "Clear file name", pass: true, detail: `${fileBase}.docx` },
  ];
}
