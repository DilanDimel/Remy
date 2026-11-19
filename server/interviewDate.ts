// "AI asks, never assumes" for interview dates (Nov 19): the AI may suggest a date, but it's kept only when the words it
// quotes from the email really state that day and month, the email names only one date, and the date is ahead.
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
// "November 24", "Nov. 24th", "24 November", "11/24"
const DATE_RE = new RegExp(String.raw`\b${MONTH_RE}\.?\s+\d{1,2}(?:st|nd|rd|th)?\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?${MONTH_RE}\b|\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b`, "gi");

/** The distinct month-day pairs a text names ("11-24"). */
export function datesIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(DATE_RE)) {
    const s = m[0].toLowerCase();
    const num = s.match(/^(\d{1,2})\/(\d{1,2})/);
    if (num) { out.add(`${+num[1]}-${+num[2]}`); continue; }
    const mon = MONTHS.findIndex((x) => new RegExp(`\\b${x}`).test(s));
    const day = s.match(/\d{1,2}/);
    if (mon >= 0 && day) out.add(`${mon + 1}-${+day[0]}`);
  }
  return [...out];
}

/** Keep the AI's interview date only if the quote states it, the body names just that one date, and it's in the coming
 *  year (a stated year must match). Returns the date, or "" to leave it for the student. */
export function checkedInterviewDate(body: string, quote: string, date: string, today: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || quote.trim().length < 6) return "";
  const [y, m, d] = date.split("-").map(Number);
  const inQuote = datesIn(quote);
  if (!inQuote.includes(`${m}-${d}`)) return "";               // "Tuesday at 2 PM", "tomorrow" or a different day
  const named = datesIn(body);
  if (named.length > 1) return "";                             // several slots offered: the student picks
  const year = quote.match(/\b(20\d{2})\b/);
  if (year && +year[1] !== y) return "";
  if (!year && Date.parse(date) - Date.parse(today) > 330 * 864e5) return ""; // a far-off year the email didn't state
  return date;
}

const ZONES: [RegExp, string][] = [[/\b(?:ET|EST|EDT|Eastern)\b/, "Eastern"], [/\b(?:PT|PST|PDT|Pacific)\b/, "Pacific"], [/\b(?:MT|MST|MDT|Mountain)\b/, "Mountain"], [/\b(?:CT|CST|CDT|Central)\b/, "Central"], [/\b(?:UTC|GMT)\b/, "UTC"]];
/** The time zone a quote names, if any ("2:00 PM ET" → "Eastern"). */
export const zoneIn = (quote: string) => ZONES.find(([re]) => re.test(quote))?.[1] || "";
