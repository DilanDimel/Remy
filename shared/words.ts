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
