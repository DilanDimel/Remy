/** Same employer, however it's written ("Deloitte LLP" = "deloitte", "Ernst & Young" = "Ernst and Young"). */
const orgKey = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/\b(inc|llc|llp|ltd|corp|corporation|company|co|the|usa|us)\b/g, "").replace(/[^a-z0-9]/g, "");
export const sameOrg = (a: string, b: string) => { const x = orgKey(a || ""), y = orgKey(b || ""); return !!x && !!y && (x === y || (x.length > 3 && y.startsWith(x)) || (y.length > 3 && x.startsWith(y))); };
