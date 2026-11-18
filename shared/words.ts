// Word families for matching: "sorted"/"sorting" → "sort", "donation"/"donated" → "donat",
// "Shift Manager"/"management" → "manag", "analyzed"/"data analysis" → "analyz". Only known endings and
// known families are folded, so different words with the same first letters stay different
// ("tables" ≠ "Tableau", "accounted" ≠ "accountability", "compute" ≠ "computer").

const IRREG: Record<string, string> = { built: "build", led: "lead", ran: "run", made: "make", wrote: "write", written: "write", taught: "teach", won: "win", grew: "grow", began: "begin", held: "hold", took: "take", taken: "take", taking: "take", spoke: "speak", sold: "sell", bought: "buy", met: "meet", kept: "keep", went: "go", going: "go", gone: "go", agreed: "agree", guaranteed: "guarantee", embedded: "embed" };

// Words whose final s isn't a plural.
const KEEP_S = /^(canvas|atlas|alias|bias|lens|series|species|news|physics|ethics|chaos|gas|its|this|has|was|is|us|plus|campus|bus|thus|always|perhaps)$/;

// Longest first. Each turns an ending into what the shorter form of the word ends with.
const ENDINGS: [RegExp, string][] = [
  [/ations?$/, "ate"], [/ated$/, "ate"], [/ating$/, "ate"],
  [/ments?$/, ""], [/ies$/, "y"], [/ied$/, "y"],
  [/ings?$/, ""], [/(?<!e)ed$/, ""], [/es$/, ""], [/(?<![su])s$/, ""], // "exceed", "process", "status" keep theirs
];

/** The word with common endings removed ("planned" → "plan", "studies" → "study"). */
export function stem(word: string): string {
  let w = word.toLowerCase();
  if (IRREG[w]) w = IRREG[w];
  else if (!KEEP_S.test(w)) {
    for (const [end, to] of ENDINGS) {
      if (!end.test(w)) continue;
      const cut = w.replace(end, to);
      if (cut.replace(/e$/, "").length < 3) break; // "comment", "bus", "red" stay whole
      w = cut;
      // "planned" → "plann" → "plan"; but "filled" stays "fill".
      if (/([b-df-hj-km-np-rtv-z])\1$/.test(w) && !/(ll|ss|zz|ff)$/.test(w)) w = w.slice(0, -1);
      break;
    }
  }
  return w.replace(/(?<=..)e$/, "");
}

// Families that endings alone can't join (a role and its skill, a noun and its verb).
// Anchored on purpose: "accountability" is not "accounting", "computer" is not "compute".
const FAMILIES: [RegExp, string][] = [
  [/^analy[sztc]/, "analyz"],              // analysis, analyzed, analyst, analytics, analytical, analyse
  [/^manag(er|ement)?$/, "manag"],          // manage(d/s), manager, management
  [/^lead(er|ership)?$/, "lead"],           // led, leading, leader, leadership
  [/^organi[sz](e|er|at|ation|ational)?$/, "organiz"], // organize(d), organizer, organization, organizational
  [/^present(er|at|ation)?$/, "present"],
  [/^coordinat(e|or|ion)?$/, "coordinat"],
  [/^mentor(ship)?$/, "mentor"],
  [/^research(er)?$/, "research"],
  [/^teach(er)?$/, "teach"],
  [/^statistic(s|al|ian)?$/, "statistic"],
  [/^financ(e|ial)?$/, "financ"],
  [/^scien(c|ce|tific|tist)$/, "scien"],
  [/^model(l)?$/, "model"],                 // modelling (British)
  [/^develop(er|ment)?$/, "develop"],
  [/^engineer$/, "engineer"],
  [/^volunteer$/, "volunteer"],
  [/^communicat(e|ion)?$/, "communicat"],
  [/^supervis(e|or|ion)?$/, "supervis"],
  [/^administ(e|er|rat|rate|ration|rator|rative)?$/, "administ"],
  [/^schedul$/, "schedul"],
];

/** The family a word belongs to: its stem, joined with related forms ("Manager" and "management"). */
export function family(word: string): string {
  // Accounting the skill, not "accounted for" or an "Account Executive".
  if (/^(accountan(t|ts|cy)|accounting)$/i.test(word)) return "accountancy";
  const s = stem(word);
  for (const [re, key] of FAMILIES) if (re.test(s)) return key;
  return s;
}

/** Word families in a text: lower-case letter runs, each mapped to its family. */
export const families = (text: string) => new Set((text.toLowerCase()
  .replace(/(?:[–—-]|\bto)\s*present\b/g, " ")       // "Aug 2025 – Present" is a date, not presentation skills
  .replace(/\blead\s+gen(eration)?\b/g, " leadgen ")  // "Lead generation" is sales, not leadership
  .match(/[a-z]+/g) || []).map(family));

/** Splits a list on , ; | • · (and " and " when asked), but never inside parentheses or brackets:
 *  "Excel (pivot tables, VLOOKUP), R (beginner)" → ["Excel (pivot tables, VLOOKUP)", "R (beginner)"]. */
export function splitList(s: string, opts: { and?: boolean } = {}): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  const text = s || "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(" || c === "[") depth++;
    else if ((c === ")" || c === "]") && depth > 0) depth--;
    const sep = depth === 0 && (/[,;|•·]/.test(c) || (opts.and && /^ and /i.test(text.slice(i, i + 5))));
    if (sep) { out.push(cur); cur = ""; if (c === " ") i += 4; continue; }
    cur += c;
  }
  // An unclosed "(" ("Excel (advanced, Python, SQL") mustn't swallow the rest: split that part normally.
  if (depth > 0) out.push(...cur.split(/[,;|•·]/).map((x) => x.replace(/\s*[([]\s*/g, " ")));
  else out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

/** A grouped skill and the skills inside it: "Microsoft Office (Word, Excel, Outlook)" → ["Microsoft Office", "Word", "Excel", "Outlook"].
 *  A plain skill or a short note ("R (beginner)") comes back as the skill alone or unchanged. */
export function skillParts(item: string): string[] {
  const m = item.match(/^([^()]+?)\s*\(([^()]*)\)\s*$/);
  if (!m) return [item];
  const inner = splitList(m[2]).map((x) => x.replace(/^(and|or)\s+/i, "").trim()).filter(Boolean);
  // "(beginner)", "(advanced)", "(2 years)" describe the skill; they aren't skills themselves.
  const notes = inner.every((x) => /^(basic|beginner|intermediate|advanced|proficient|fluent|native|conversational|certified|\d+\+?\s*(yrs?|years?))$/i.test(x));
  return notes ? [m[1].trim()] : [m[1].trim(), ...inner];
}

/** "skip", "idk", "I don't really have one": the student didn't answer. Used so a non-answer never becomes a fact
 *  about them or a line in their cover letter. */
export function isNonAnswer(text: string): boolean {
  if (!/[\p{L}\p{N}]/u.test(text || "")) return true; // empty, "-", "?"; any letter (any language) or digit counts
  const t = (text || "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z/ ]+/g, " ").replace(/\s+/g, " ").trim();
  if (/^(skip|skipped|pass|no|nope|nah|none|n\/a|na|nothing|nothing really|not really|idk|dunno|no idea|not sure|unsure|no reason|no comment|whatever|nothing to add|nothing else)$/.test(t)) return true;
  return /^(i )?(dont|do not|dont really|do not really) (know|have (one|any|anything|an answer)|really (know|have (one|any|anything)))$/.test(t)
    || /^(i )?(dont|do not)( really)? (have|know)( one| any| anything)?( yet| really)?$/.test(t)
    || /^(im |i am )?not (sure|really sure)( yet)?$/.test(t);
}

/** The resume line that shows a skill is used, or undefined. "MS Excel", "Microsoft Excel" and "Excel" are the same skill. */
export function skillProof(skill: string, lines: string[]): string | undefined {
  const norm = (x: string) => x.toLowerCase()
    .replace(/\bms\s+(?=(excel|word|powerpoint|outlook|office|access|teams|project|visio|365)\b)/g, "microsoft ")
    .replace(/\bmicrosoft\s+(?=(excel|powerpoint|visio|365)\b)/g, ""); // only names that aren't everyday words drop the prefix
  const s = norm(skill).trim();
  if (!s) return undefined;
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`);
  return lines.find((l) => re.test(norm(l)));
}

/** A skill group's name as printed, or "" when it only repeats the Skills heading ("Skills", "SKILLS:"), so a
 *  download never reads "SKILLS / Skills: Excel". */
export const skillGroupName = (label: string) => (/^\s*skills?\s*:?\s*$/i.test(label || "") ? "" : (label || "").trim());

/** "BBA Finance, Expected May 2029. GPA 3.6" with dates "Expected May 2029" (or just "May 2029") → "BBA Finance, GPA 3.6":
 *  the date prints once, in the dates column. A lead-in ("Expected", "Class of", "since") goes with it, and brackets
 *  only when the date fills them. Only dates with a year: "Summer" in "Summer Analyst" is part of the title. */
export function dropDates(role: string, dates: string): string {
  const d = (dates || "").trim();
  if (!role || !/\b(19|20)\d{2}\b/.test(d)) return role || "";
  const esc = d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const core = `(?:(?:expected|anticipated|graduat\\w*|class of|since)\\s*:?\\s*)?(?<!\\w)${esc}(?!\\w)`;
  const re = new RegExp(`\\(\\s*${core}\\s*\\)|\\[\\s*${core}\\s*\\]|${core}`, "i");
  if (!re.test(role)) return role;
  return role.replace(re, " | ")
    .replace(/(?:\s*[,.;|–—-]\s*)+(?=[A-Za-z0-9(])/g, (m) => (/[|]/.test(m) ? ", " : m.replace(/\s*\|\s*/, "")))
    .replace(/\((?:\s*[,;|–—-])+\s*/g, "(").replace(/(?:\s*[,;|–—-])+\s*\)/g, ")")
    .replace(/^[\s,.;|–—-]+|[\s,;|–—-]+$/g, "").replace(/(?<=[a-z]{3})\.$/, "").trim(); // "Finance." loses the period; "B.S." and "Co." keep it
}
