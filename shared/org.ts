/** Same employer, however it's written ("Deloitte LLP" = "deloitte", "Ernst & Young" = "Ernst and Young"). */
const orgKey = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/\b(inc|llc|llp|ltd|corp|corporation|company|co|the|usa|us)\b/g, "").replace(/[^a-z0-9]/g, "");
export const sameOrg = (a: string, b: string) => { const x = orgKey(a || ""), y = orgKey(b || ""); return !!x && !!y && (x === y || (x.length > 3 && y.startsWith(x)) || (y.length > 3 && x.startsWith(y))); };

/** A posting title without the employer's name repeated (the card already shows it):
 *  "State Street Investment Management - Global Leveraged Finance Intern" → "Global Leveraged Finance Intern",
 *  "University – Corporate Finance Intern at Booz Allen Hamilton" → "Corporate Finance Intern".
 *  Only the employer's own name and a few program labels are removed; nothing else is reworded. */
export function shortTitle(title: string, company: string) {
  let t = (title || "").trim();
  const dash = /\s+[-–—|]\s*/;
  const m = t.match(dash);
  if (m && m.index !== undefined) {
    const head = t.slice(0, m.index), rest = t.slice(m.index + m[0].length).trim();
    if (rest.length >= 4 && (sameOrg(head, company) || /^(university|campus|early careers?|students?)$/i.test(head.trim()))) t = rest;
  }
  const at = t.match(/\s+(?:at|@)\s+(.+)$/i);
  if (at && sameOrg(at[1], company) && t.length - at[0].length >= 4) t = t.slice(0, t.length - at[0].length);
  return t || title;
}
