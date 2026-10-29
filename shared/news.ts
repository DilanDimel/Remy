// "What's new": short notes about each update, newest first. Add one when you ship something students
// (or owners) would notice. Ids are "date-NN" and only ever grow, so "seen up to this id" works.
export type NewsItem = { id: string; date: string; kind: "New" | "Improved" | "Fixed" | "Changed"; title: string; body: string; owners?: boolean };

export const NEWS: NewsItem[] = [
  { id: "2026-10-29-04", date: "2026-10-29", kind: "Improved", title: "A clearer front page", body: "The front page now shows one thing at a time, with a footer for privacy, beta terms and contact." },
  { id: "2026-10-29-03", date: "2026-10-29", kind: "Changed", title: "Remy is officially in beta", body: "You'll see a Beta label and a one-time agreement. Unfinished features say “Coming soon” so you always know what works today." },
  { id: "2026-10-29-02", date: "2026-10-29", kind: "Changed", title: "Alumni matching is paused", body: "We removed the alumni list until a school gives us permission to use it. Contacts you add yourself still work." },
  { id: "2026-10-29-01", date: "2026-10-29", kind: "Fixed", title: "Word resumes show on Base resume", body: "Your uploaded Word resume appears again, with a Minimize button that Remy remembers." },
  { id: "2026-10-28-01", date: "2026-10-28", kind: "New", title: "One-click tailoring", body: "Tailor your resume for an opening straight from its card, and send us feedback from the menu anytime." },
  { id: "2026-10-29-05", date: "2026-10-29", kind: "Improved", title: "Board, meetings and history", body: "Several teammates per to-do and meeting, instant moves, a north-star number, and finished to-dos move to History after 3 days.", owners: true },
];

/** Items someone hasn't seen: newer than the last id they opened. Owners also see owner-only notes. */
export const unseenNews = (seen: string | undefined, owner = false) =>
  NEWS.filter((n) => (owner || !n.owners) && (!seen || n.id > seen));
export const latestNewsId = () => NEWS.reduce((a, n) => (n.id > a ? n.id : a), "");
