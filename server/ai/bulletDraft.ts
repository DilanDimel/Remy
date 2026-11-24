// Checks Remy's draft of one improved resume bullet before the student sees it (Review tab). The draft may only say
// what the line says plus what the student just told Remy, and never upgrade a hedged action into a claim.
import { claimCheck, unsaidWords } from "./claims";
import { WEAK, isAction } from "@shared/bullets";
import { family } from "@shared/words";

const HEDGE = /^(helped( with| to)?|assisted( with| in)?|supported|responsible for|worked on|tasked with|duties included|was in charge of|handled|did)\s+/i;
const words = (t: string): string[] => t.toLowerCase().match(/[a-z]+/g) || [];
const nums = (t: string) => (t.match(/\d[\d,.]*\+?/g) || []).map((n) => n.replace(/[.,]+$/, ""));

/** The evidence the draft is checked against: the line (its hedge replaced by what the student said they did, for
 *  "verbs") plus the student's answer. */
export function draftEvidence(kind: "numbers" | "verbs", text: string, answer: string) {
  return kind === "verbs" ? `${answer}. ${text.replace(HEDGE, "")}` : `${text} ${answer}`;
}

// A line that opens like this only says the student took part; every action in the rest of it stays theirs only
// in part ("Supported the launch of the app" never becomes "Launched the app").
const PART = /^(helped|assisted|supported|worked on|contributed|participated|was part of|was involved in|aided|collaborated)\b/i;
const KEEPS_PART = /\b(helped|assisted|supported|contributed|participated|collaborated|aided|as part of)\b/i;
const IRREGULAR = new Set("ran led built made wrote gave sold took met kept set grew drove began won taught brought bought found held spoke chose drew rode sent spent stood told thought understood".split(" "));

/** The draft's action words: the first word, words after "and", past-tense "-ed" words and common irregulars. */
function draftActions(draft: string): string[] {
  const ws = words(draft);
  return ws.filter((w, i) => i === 0 || ws[i - 1] === "and" || IRREGULAR.has(w) || (w.length > 4 && /ed$/.test(w)));
}

/** True when the draft claims, as the student's own, an action the line only says they took part in. */
export function upgradesPart(text: string, answer: string, draft: string): boolean {
  if (!PART.test(text) || KEEPS_PART.test(draft)) return false;
  const line = new Set(words(text.replace(PART, "")).filter((w) => w.length > 2).map(family));
  const said = new Set(words(answer).map(family));
  return draftActions(draft).some((w) => line.has(family(w)) && !said.has(family(w)));
}

/** `context`: the rest of the same resume entry (its header and other lines). Facts there may be used, but never
 *  count as the student's own answer (so they can't upgrade a "helped" line). */
export function draftOk(kind: "numbers" | "verbs", text: string, answer: string, draft: string, context = ""): boolean {
  if (!draft || draft === text) return false;
  const evidence = draftEvidence(kind, text, answer) + (context ? ` ${context}` : "");
  // Every number exactly as given ("12" doesn't become "12+").
  if (!nums(draft).every((n) => nums(evidence).includes(n))) return false;
  if (kind === "verbs") {
    // Opens with an action, and that action is the student's own (from their answer) or a recognized action verb.
    const first = words(draft)[0] || "";
    if (!isAction(draft) && !words(answer).some((w) => family(w) === family(first))) return false;
  }
  // "Helped organize the fair" + "booked the venue" must not become "Organized the fair" (either fix type).
  if (upgradesPart(text, answer, draft)) return false;
  return !claimCheck(draft, evidence, { original: evidence, strict: true }).length;
}

/** Remy's own rewrite (no answer, owners): false when it isn't worth showing. Live check Nov 24: "Manage office
 *  communications" came back as "Managed …" (a current role made to sound finished), and "Selected participant" as
 *  "Selected as a participant" (no real change). Then Remy asks instead. */
export function ownRewriteOk(text: string, draft: string): boolean {
  const a = words(text), b = words(draft);
  const [w0, d0] = [a[0] || "", b[0] || ""];
  if (w0 !== d0 && family(w0) === family(d0) && !/ed$/.test(w0) && /ed$/.test(d0)) return false; // tense flipped to past
  // Word edits in order (reordering counts): a one-verb swap ("Provide" → "Deliver", Nov 24 live check) or a word or
  // two isn't a stronger line; the rewrite has to restructure it.
  const lcs = a.reduce((row, x) => { const next = [0]; b.forEach((y, j) => next.push(x === y ? row[j] + 1 : Math.max(row[j + 1], next[j]))); return next; }, new Array(b.length + 1).fill(0));
  // Moving the line's own action to the front ("As Ambassador, raised $5,000" → "Raised $5,000 as Ambassador") is the
  // restructure that counts most, even though it's few edits.
  return a.length + b.length - 2 * lcs[b.length] > 4 || a.indexOf(d0) > 0;
}

// Outcome words are claims, never just a sharper verb ("Improved office communications").
const RESULT = /^(improv|increas|reduc|boost|grew|grow|won|win|rais|secur|sav|generat|achiev|exceed|drove|driv|ensur|enabl|optimiz|streamlin|maximiz|transform|accelerat|expand|doubl|tripl|resolv|lead|led)/;
const CONNECT = new Set("while through including alongside across using various related daily weekly ongoing tasks".split(" "));
/** Why Remy's own rewrite (owners, no answer; Nov 24 "make it really good") can't be shown, or "" when it can. The
 *  rewrite may reword freely with sharper action verbs, but every other word, every number and every result must
 *  already be in the line or the same entry (`context`), and a "helped" line keeps its share of the credit. */
export function ownDraftProblem(text: string, draft: string, context = ""): string {
  if (!draft || draft === text) return "it came back unchanged";
  const evidence = `${text} ${context}`;
  if (!nums(draft).every((n) => nums(evidence).includes(n))) return "it changed or added a number";
  if (!isAction(draft) || WEAK.test(draft)) return "it doesn't open with a strong action verb";
  if (upgradesPart(text, "", draft)) return "it claimed more credit than the line gives";
  const ev = new Set(words(evidence).map(family));
  const added = unsaidWords(draft, evidence).filter((w) => {
    if (ev.has(family(w)) || CONNECT.has(w)) return false;
    const verb = isAction(w[0].toUpperCase() + w.slice(1)) || /(ed|ing)$/.test(w);
    return !verb || RESULT.test(w);
  });
  if (added.length) return `it added words that aren't on the resume (${added.slice(0, 4).join(", ")})`;
  if (claimCheck(draft, evidence, { original: text, entryContext: context }).length) return "it added a result or detail that isn't on the resume";
  if (!ownRewriteOk(text, draft)) return "it was too close to the original or changed the tense";
  return "";
}
