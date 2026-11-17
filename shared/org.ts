/** Same employer, however it's written ("Deloitte LLP" = "deloitte", "Ernst & Young" = "Ernst and Young"). */
export const orgKey = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/\b(inc|llc|llp|ltd|corp|corporation|company|co|the|usa|us)\b/g, "").replace(/[^a-z0-9]/g, "");
export const sameOrg = (a: string, b: string) => { const x = orgKey(a || ""), y = orgKey(b || ""); return !!x && !!y && (x === y || (x.length > 3 && y.startsWith(x)) || (y.length > 3 && x.startsWith(y))); };

/** A posting title without the employer's name repeated (the card already shows it):
 *  "State Street Investment Management - Global Leveraged Finance Intern" → "Global Leveraged Finance Intern",
 *  "University – Corporate Finance Intern at Booz Allen Hamilton" → "Corporate Finance Intern".
 *  Only the employer's own name and a few program labels are removed; nothing else is reworded. */
// The text names the whole employer ("State Street Investment Management" holds "State Street"); a shorter word that only
// starts the employer's name ("Sales" for Salesforce, "Intelligence" for Intel) is a department, so it stays. Whole words only.
const orgWords = (s: string) => s.toLowerCase().replace(/&/g, " and ").split(/[^a-z0-9]+/).filter((w) => w && !/^(inc|llc|llp|ltd|corp|corporation|company|co|the)$/.test(w));
const holdsOrg = (text: string, company: string) => { const x = orgWords(text || ""), y = orgWords(company || ""); return y.length > 0 && y.every((w, i) => x[i] === w); };
export function shortTitle(title: string, company: string) {
  let t = (title || "").trim();
  const dash = /\s+[-–—|]\s*/;
  const m = t.match(dash);
  if (m && m.index !== undefined) {
    const head = t.slice(0, m.index), rest = t.slice(m.index + m[0].length).trim();
    if (rest.length >= 4 && (holdsOrg(head, company) || /^(university|campus|early careers?|students?)$/i.test(head.trim()))) t = rest;
  }
  const at = t.match(/\s+(?:at|@)\s+(.+)$/i);
  if (at && holdsOrg(at[1], company) && t.length - at[0].length >= 4) t = t.slice(0, t.length - at[0].length);
  return t || title;
}

/** Dream employers the student named that have no opening in their list (first 5, the ones Remy searches).
 *  "JPMorgan" matches "JPMorgan Chase & Co." (same employer by sameOrg); "EY" doesn't match "Disney". */
export function dreamWithoutOpenings(dreamEmployers: string | undefined, companies: string[]): string[] {
  return (dreamEmployers || "").split(/[,;]+/).map((x) => x.trim()).filter((x) => x.length > 1 && orgKey(x)).slice(0, 5)
    .filter((d) => !companies.some((c) => sameOrg(d, c)));
}
