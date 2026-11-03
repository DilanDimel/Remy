import type { Workspace } from "./types";
import { sameOrg } from "./org";
// What a weekly check-in can be about (tap one; "Nothing new" just records the check-in).
export const CHECKIN_KINDS = ["Worked shifts", "Volunteered", "Club", "Class project", "Competition or hackathon", "Certificate", "Leadership role"] as const;


/** Something a check-in sentence says that Remy can update for the student, once they approve it. */
export type CheckinProposal =
  | { id: string; kind: "hours"; label: string; activity: string; hours: number }
  | { id: string; kind: "applied" | "interview"; label: string; company: string; trackId?: string };

const ACTIVITY: Record<string, string> = { "Worked shifts": "Work shifts", Volunteered: "Volunteering", Club: "Club or leadership", "Leadership role": "Club or leadership" };
// A company name as students write it: capitalised words, "&", "'s", up to 4 words ("Texas Capital", "AT&T", "Cook Children's").
const COMPANY = "([A-Z][\\w&.'’-]*(?:\\s+(?:of\\s+)?[A-Z][\\w&.'’-]*){0,3})";

/** What a check-in sentence says beyond the resume line, worked out without AI so nothing is invented:
 *  hours ("about 18 hours shadowing"), an application ("applied to Frost Bank"), an interview ("interview with Texas Capital").
 *  Only clear statements count; the student approves each one. */
export function checkinProposals(ws: Pick<Workspace, "tracker">, kind: string, said: string): CheckinProposal[] {
  const out: CheckinProposal[] = [];
  const h = said.match(/\b(\d{1,3}(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i);
  if (h && !/\b(no|not|zero)\s+\d/i.test(said)) {
    const hours = Math.min(24 * 7, parseFloat(h[1]));
    const activity = /shadow/i.test(said) ? "Shadowing" : /clinic|scribe|patient/i.test(said) ? "Clinical hours" : /research|lab\b/i.test(said) ? "Research" : /tutor/i.test(said) ? "Tutoring" : ACTIVITY[kind] || kind || "Volunteering";
    if (hours > 0) out.push({ id: "hours", kind: "hours", label: `Log ${hours} h of ${activity} in Progress → Hours`, activity, hours });
  }
  const applied = said.match(new RegExp(`\\b(?:[Aa]pplied|[Ss]ubmitted (?:an |my )?application)\\s+(?:to|at|for|with)\\s+(?:the\\s+)?${COMPANY}`));
  if (applied && !/\b(didn'?t|did not|haven'?t|have not|will|going to|want to|plan to)\s+(?:\w+\s+)?(apply|applied|submit)/i.test(said)) {
    const company = applied[1].replace(/[.,;]$/, "");
    const t = ws.tracker.find((x) => sameOrg(x.company, company));
    if (!t) out.push({ id: "applied", kind: "applied", label: `Track your application to ${company} (Applied)`, company });
    else if (t.status === "Saved") out.push({ id: "applied", kind: "applied", label: `Mark ${t.company} as Applied`, company: t.company, trackId: t.id });
  }
  const iv = said.match(new RegExp(`\\b[Ii]nterview(?:ed)?\\s+(?:with|at|for)\\s+(?:the\\s+)?${COMPANY}`));
  if (iv && !/\b(no|didn'?t get|waiting for|hope to get|preparing for)\b[^.]{0,20}\binterview/i.test(said)) {
    const company = iv[1].replace(/[.,;]$/, "");
    const t = ws.tracker.find((x) => sameOrg(x.company, company));
    if (t && !["Interview", "Offer", "Rejected", "Withdrawn"].includes(t.status)) out.push({ id: "interview", kind: "interview", label: `Mark ${t.company} as Interview`, company: t.company, trackId: t.id });
  }
  return out;
}
