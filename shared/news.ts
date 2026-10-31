// "What's new": short notes about each update, newest first. Add one when you ship something students
// (or owners) would notice. Ids are "date-NN" and only ever grow, so "seen up to this id" works.
export type NewsItem = { id: string; date: string; kind: "New" | "Improved" | "Fixed" | "Changed"; title: string; body: string; owners?: boolean };

export const NEWS: NewsItem[] = [
  { id: "2026-10-31-07", date: "2026-10-31", kind: "Improved", title: "Start with what you came for", body: "Setup now asks what would help most today: your resume, openings, an interview, figuring out a direction, or just looking around. Back returns you to the same spot in a list, “Due today” is no longer shown as one day left, and if a change can’t be saved Remy says so with a Retry button." },
  { id: "2026-10-31-06", date: "2026-10-31", kind: "New", title: "Agents tab", body: "Owners' dashboard → Agents: the Feedback & bug sorter groups open errors and feedback into themes with to-dos you can add to the board, and the Weekly analyst sums up the week. Openings scout, Researcher and Marketing drafter are next.", owners: true },
  { id: "2026-10-31-05", date: "2026-10-31", kind: "New", title: "X-Ray, evidence and interview stories", body: "On Resume → Base resume: ATS X-Ray shows what Remy read and lets you add lines it missed, the Evidence passport shows which skills a bullet backs up, and the Story deck builds true interview stories from your resume. An interview on your calendar now turns Home into a 3-step prep plan." },
  { id: "2026-10-31-04", date: "2026-10-31", kind: "New", title: "Your week with Remy", body: "Home now shows your week: pick a goal of 2–4 active days, and a day counts when you finish a real step (a to-do, a saved opening, an application or an email draft). Points are optional (Account → Appearance), and weekly emails can nudge you on Fridays if you turn them on." },
  { id: "2026-10-31-03", date: "2026-10-31", kind: "Improved", title: "Openings near you first", body: "If you haven't picked places to work, openings in your own city or state come first. Locations read normally (“Rosemont, IL”), skill tags wrap on phones, and your Opportunities filters stay as you left them." },
  { id: "2026-10-31-02", date: "2026-10-31", kind: "New", title: "Dark mode, your photo, and chat that changes settings", body: "Remy now matches your device's light or dark mode on every page (change it with the screen icon or in Account → Appearance). Add your own profile photo in Account → Profile. Ask Remy to “turn on dark mode” or “stop deadline reminders” and tap to confirm." },
  { id: "2026-10-31-01", date: "2026-10-31", kind: "Fixed", title: "Smoother setup", body: "Setup no longer gets stuck after the last question, start dates are always in the future, and answering a question twice won't repeat your answer." },
  { id: "2026-10-29-08", date: "2026-10-29", kind: "Fixed", title: "Your resume keeps its look", body: "Tailored downloads now keep your font, sizes and margins, including Word files with several bullets per paragraph, monospace fonts and resumes without italics. Honest rewordings like spelling out “RN” are no longer flagged." },
  { id: "2026-10-29-07", date: "2026-10-29", kind: "Improved", title: "Remy learns what you like", body: "Employers you save or apply to come first, ones you keep marking “Not interested” fade out, and “Find more openings” now checks employers it hasn't looked at yet." },
  { id: "2026-10-29-06", date: "2026-10-29", kind: "Improved", title: "More openings that fit you", body: "Remy now reads what a job actually involves, so postings with plain titles like “Summer Intern” show up when the work matches your field. Openings also load faster." },
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
