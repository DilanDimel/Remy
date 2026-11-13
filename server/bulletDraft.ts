// Checks Remy's draft of one improved resume bullet before the student sees it (Review tab). The draft may only say
// what the line says plus what the student just told Remy, and never upgrade a hedged action into a claim.
import { claimCheck } from "./claims";
import { isAction } from "@shared/bullets";
import { family } from "@shared/words";

const HEDGE = /^(helped( with| to)?|assisted( with| in)?|supported|responsible for|worked on|tasked with|duties included|was in charge of|handled|did)\s+/i;
const words = (t: string) => t.toLowerCase().match(/[a-z]+/g) || [];
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

export function draftOk(kind: "numbers" | "verbs", text: string, answer: string, draft: string): boolean {
  if (!draft || draft === text) return false;
  const evidence = draftEvidence(kind, text, answer);
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
