// The length of conversation a student asked for in their own words ("a 15-minute chat", "15 min", "half an hour").
// Live test Nov 19: the student asked for 15 minutes and the drafted email asked for "20 to 30". Their ask wins.
const RANGE = /\b(\d{1,2})(?:\s*(?:-|–|to)\s*(\d{1,2}))?(\s*-?\s*)(min(?:ute)?s?)\b/i;

const core = (m: RegExpMatchArray) => (m[2] ? `${m[1]}-${m[2]}` : m[1]);

/** "15" / "15-20" (minutes) from the student's answers, or "" when they named no length. */
function askedCore(answers: string): string {
  const m = answers.match(RANGE);
  if (m) return core(m);
  return /\bhalf\s+an\s+hour\b/i.test(answers) ? "30" : "";
}

/** "15-minute" (to go before "chat"/"conversation"), or "" when the student named no length. */
export const askedLength = (answers: string) => (askedCore(answers) ? `${askedCore(answers)}-minute` : "");

/** The drafted email, with any other conversation length replaced by the one the student asked for, in the same
 *  form: "a 20-30 minute call" → "a 15-minute call", "have 20-30 minutes" → "have 15 minutes". */
export function keepAskedLength(body: string, answers: string): string {
  const asked = askedCore(answers);
  if (!asked) return body;
  return body.replace(new RegExp(RANGE.source, "gi"), (...m) => {
    const all = m[0] as string, found = m[2] ? `${m[1]}-${m[2]}` : (m[1] as string);
    if (found === asked) return all;
    return /s$/i.test(m[4] as string) && !/-/.test(m[3] as string) ? `${asked} minutes` : `${asked}-minute`;
  });
}
