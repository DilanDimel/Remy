// Which name Remy may use. The profile name can be only the sign-in account's (a borrowed or family Google account);
// when a resume names someone else, Remy asks ("Which name should Remy use?") and uses no name until it's answered.
import type { Workspace } from "./types";

export const NAME_CHECK = "Name check";
/** Name words without accents, middle initials or order ("Doe, Jane M." = "jane doe"); any script. */
const nameKey = (n: string) => n.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length > 1).sort().join(" ");
/** true/false when the two names can be compared, null when they can't (e.g. only initials). */
export const sameName = (a: string, b: string): boolean | null => { const x = nameKey(a), y = nameKey(b); return x && y ? x === y : null; };
/** The resume's name is the account's name plus middle names ("Dilan Desman" -> "Dilan Dimel Desman"): same first and
 *  last name, more words in between. Then it's the same person's full name and Remy takes it without asking. */
export const fullerName = (account: string, resume: string): boolean => {
  const w = (n: string) => n.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().split(/[^\p{L}]+/u).filter((x) => x.length > 1);
  const a = w(account), r = w(resume);
  return a.length >= 2 && r.length > a.length && r[0] === a[0] && r[r.length - 1] === a[a.length - 1] && a.every((x) => r.includes(x));
};
/** The resume names someone other than the profile, and the student hasn't answered "Which name should Remy use?" yet. */
export const nameUnsure = (ws: Pick<Workspace, "profile" | "resume" | "tasks">) =>
  !ws.profile.preferredName && !!ws.resume?.doc.contact.name && sameName(ws.profile.name, ws.resume.doc.contact.name) === false && ws.tasks.some((t) => t.source === NAME_CHECK && !t.done);
/** The full name Remy may show or write, or "" while it isn't confirmed. */
export const knownName = (ws: Pick<Workspace, "profile" | "resume" | "tasks">) => (nameUnsure(ws) ? "" : ws.profile.name);
/** What to call the student ("" while unconfirmed and there's no preferred name). */
export const firstName = (ws: Pick<Workspace, "profile" | "resume" | "tasks">) => ws.profile.preferredName || knownName(ws).split(" ")[0] || "";
