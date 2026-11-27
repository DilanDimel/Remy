/** The pay an opening states in its own words, or "" when it states none. Nothing here is estimated or guessed: the
 *  amount comes straight from the posting text (or summary), only when a pay word or a pay unit ("per hour", "a year")
 *  sits next to it, and bonuses, tuition, revenue and the like are skipped. */
const AMOUNT = String.raw`\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d{1,2})?)(\s?[kK]\b)?`;
const RANGE = new RegExp(`${AMOUNT}(?:\\s?(?:-|–|—|to)\\s?(?:\\$\\s?)?(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d{1,2})?)(\\s?[kK]\\b)?)?`, "g");
const UNIT: [RegExp, "hr" | "yr" | "mo" | "wk"][] = [
  [/^\W{0,3}(?:per\s+hour|an?\s+hour|\/\s?h(?:ou)?r|hourly|p\.?h\.?\b)/i, "hr"],
  [/^\W{0,3}(?:per\s+year|an?\s+year|annually|annual|yearly|\/\s?y(?:ea)?r|per\s+annum|a\s+year)/i, "yr"],
  [/^\W{0,3}(?:per\s+month|a\s+month|monthly|\/\s?mo(?:nth)?)/i, "mo"],
  [/^\W{0,3}(?:per\s+week|a\s+week|weekly|\/\s?w(?:ee)?k)/i, "wk"],
];
const PAY_WORD = /\b(pay|salary|salaries|compensation|wage|wages|stipend|rate|earn|earns|earning|base|hourly|annual|range)\b/i;
const NOT_PAY = /\b(bonus|sign-?on|signing|relocation|tuition|reimburse\w*|401\s?\(?k|equity|stock|budget|revenue|funding|grant|scholarship|million|billion|fee|deposit|retention|referral)\b/i;

const num = (s: string, k?: string) => Number(s.replace(/,/g, "")) * (k ? 1000 : 1);
const money = (n: number, cents: boolean) => "$" + (cents ? n.toFixed(2) : n.toLocaleString("en-US"));

export function payOf(text: string): string {
  if (!text) return "";
  RANGE.lastIndex = 0;
  for (let m = RANGE.exec(text); m; m = RANGE.exec(text)) {
    const before = text.slice(Math.max(0, m.index - 70), m.index);
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40);
    // Skip amounts that are something else: "$5,000 sign-on bonus", "$2 million in funding".
    if (NOT_PAY.test(before.slice(-30)) || /^\s?(?:million|billion|[MB]\b|in\s+(?:funding|revenue|sales))/i.test(after) || NOT_PAY.test(after.slice(0, 22))) continue;
    let a = num(m[1]!, m[2]), b = m[3] ? num(m[3], m[4]) : 0;
    if (b && !m[4] && m[2] && b < 1000) b *= 1000; // "$60k - 80k": the second number takes the first's "k"
    const unit = UNIT.find(([re]) => re.test(after))?.[1];
    const stated = PAY_WORD.test(before.slice(-90));
    if (!unit && !stated) continue;
    // With no unit, tell hourly from yearly by size, and ignore anything that isn't a plausible wage.
    const kind = unit || (a >= 1000 ? "yr" : "hr");
    const lo = kind === "hr" ? 7 : kind === "wk" ? 150 : kind === "mo" ? 600 : 10000;
    const hi = kind === "hr" ? 250 : kind === "wk" ? 6000 : kind === "mo" ? 30000 : 600000;
    if (a < lo || a > hi || (b && (b < lo || b > hi || b < a))) continue;
    const cents = !Number.isInteger(a) || !Number.isInteger(b);
    return `${money(a, cents)}${b ? "–" + money(b, cents) : ""}/${kind}`;
  }
  return "";
}

/** What to show on an opening: its own pay line, from the posting text first, then the summary. */
export const jobPay = (j: { postingText?: string; summary?: string; kind?: string }): string =>
  j.kind === "event" ? "" : payOf(j.postingText || "") || payOf(j.summary || "");
