import type { Workspace } from "./types";
// What a weekly check-in can be about (tap one; "Nothing new" just records the check-in).
export const CHECKIN_KINDS = ["Worked shifts", "Volunteered", "Club", "Class project", "Competition or hackathon", "Certificate", "Leadership role"] as const;


/** Something a check-in sentence says that Remy can update for the student, once they approve it.
 *  `checked`: ticked by default (a clear update to something they already track); new tracker items start unticked. */
export type CheckinProposal =
  | { id: string; kind: "hours"; label: string; activity: string; hours: number; checked: boolean }
  | { id: string; kind: "applied" | "interview"; label: string; company: string; trackId?: string; checked: boolean };

const ACTIVITY: Record<string, string> = { "Worked shifts": "Work shifts", Volunteered: "Volunteering", Club: "Club or leadership", "Leadership role": "Club or leadership" };
// A company name as students write it: capitalised words, "&", up to 4 words ("Texas Capital", "AT&T"); not a possessive.
const COMPANY = "([A-Z][\\w&.-]*(?:\\s+(?:of\\s+)?[A-Z][\\w&.-]*){0,3})(?![\\w&'’-])";
// Places students apply through or things that aren't employers.
const NOT_EMPLOYER = /^(linkedin|handshake|indeed|glassdoor|ziprecruiter|remy|easy apply|the career fair|career fair|tcu|my school|honors|summer|fall|spring|winter|internship|intern|analyst|associate|jobs?)\b/i;
const NEGATED = /\b(never|not yet|no|not|didn'?t|did not|haven'?t|have not|hasn'?t|still haven'?t|will|going to|want to|plan(?:ning)? to|hope to|waiting for|preparing for|mock|practice)\b/i;
const key = (x: string) => x.toLowerCase().replace(/[^a-z0-9& ]+/g, "").replace(/\s+/g, " ").trim();

/** What a check-in says beyond the resume line, worked out without AI so nothing is invented: hours ("about 18 hours
 *  shadowing"), an application ("applied to Frost Bank"), an interview ("interview with Texas Capital"). One sentence at a
 *  time; plans, negations, ranges and unclear names are left out. The student approves each one. */
export function checkinProposals(ws: Pick<Workspace, "tracker">, kind: string, said: string): CheckinProposal[] {
  const out: CheckinProposal[] = [];
  // Sentences, but not after "Dr.", "Mr.", "St." and other short abbreviations.
  const sentences = said.split(/(?<!\b(?:Dr|Mr|Mrs|Ms|St|Jr|Sr|Inc|Co|Prof))(?<=[.!?;])\s+|\s+(?:and then|then)\s+/i);
  // A tracker item that is clearly this company: same name, or the student shortened it ("Frost" for "Frost Bank"); one only.
  const tracked = (company: string) => {
    const k = key(company);
    const hits = ws.tracker.filter((t) => key(t.company) === k || (k.length > 3 && key(t.company).startsWith(k + " ")));
    return hits.length === 1 ? hits[0] : hits.length ? null : undefined; // null = ambiguous
  };
  const hoursIn = sentences.flatMap((x) => [...x.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*(?:hours?|hrs?)\b/gi)].map((m) => ({ s: x, n: parseFloat(m[1]) })));
  const h = hoursIn[0];
  if (hoursIn.length === 1 && h.n > 0 && h.n <= 168 && !/\d\s*[-–]\s*\d+\s*(?:hours?|hrs?)\b|\b(?:to|or)\s+\d+\s*(?:hours?|hrs?)\b/i.test(h.s) && !NEGATED.test(h.s.replace(/\bwill\b.*$/i, "")) && !/\b(total|so far|altogether|over the (year|semester))\b/i.test(h.s) && !/\bapply|application/i.test(h.s)) {
    const activity = /shadow/i.test(said) ? "Shadowing" : /clinic|scribe|patient/i.test(said) ? "Clinical hours" : /\bresearch\b|\blab (work|assistant|hours)\b/i.test(said) ? "Research" : /tutor/i.test(said) ? "Tutoring" : ACTIVITY[kind] || kind || "Volunteering";
    out.push({ id: "hours", kind: "hours", label: `Log ${h.n} h of ${activity} in Progress → Hours`, activity, hours: h.n, checked: true });
  }
  for (const x of sentences) {
    if (NEGATED.test(x)) continue;
    const applied = x.match(new RegExp(`\\b(?:[Aa]pplied|[Ss]ubmitted (?:an |my )?application)\\s+(?:[Tt]o|[Aa]t)\\s+(?:the\\s+)?${COMPANY}`)) || x.match(new RegExp(`\\b[Aa]pplied\\s+for\\s+[^.]{1,60}?\\s+(?:[Aa]t|[Ww]ith)\\s+(?:the\\s+)?${COMPANY}`));
    if (applied && !out.some((p) => p.id === "applied")) {
      const company = applied[1].replace(/[.,;]$/, "").trim();
      if (!NOT_EMPLOYER.test(company)) {
        const t = tracked(company);
        if (t === undefined) out.push({ id: "applied", kind: "applied", label: `Track your application to ${company} (Applied)`, company, checked: false });
        else if (t && t.status === "Saved") out.push({ id: "applied", kind: "applied", label: `Mark ${t.company}${t.role ? ` (${t.role})` : ""} as Applied`, company: t.company, trackId: t.id, checked: true });
      }
    }
    const iv = x.match(new RegExp(`\\b[Ii]nterview(?:ed)?\\s+(?:with|at|for)\\s+(?:the\\s+)?${COMPANY}`));
    if (iv && !out.some((p) => p.id === "interview")) {
      const t = tracked(iv[1].replace(/[.,;]$/, "").trim());
      if (t && !["Interview", "Offer", "Rejected", "Withdrawn"].includes(t.status)) out.push({ id: "interview", kind: "interview", label: `Mark ${t.company}${t.role ? ` (${t.role})` : ""} as Interview`, company: t.company, trackId: t.id, checked: true });
    }
  }
  return out;
}
