// The work authorization answer in setup and Account (legal audit, Nov 24): optional, and it keeps U.S. citizens,
// green card holders, students on F-1 / OPT and students who'll need sponsorship apart, because they can apply to
// different openings. Older answers ("U.S. citizen or permanent resident", "I'll need visa sponsorship (F-1 / OPT)")
// keep the filtering they had.
export const AUTH_OPTS = ["U.S. citizen", "Green card holder", "F-1 / OPT now", "Will need visa sponsorship", "Rather not say"];

export type AuthKind = "citizen" | "resident" | "opt" | "sponsor" | "";

/** What a work authorization answer means for filtering openings. "" = nothing hidden. */
export function authKind(answer = ""): AuthKind {
  const s = answer.toLowerCase();
  if (!s.trim() || /rather not|prefer not/.test(s)) return "";
  if (/opt now|on opt|\bcpt\b/.test(s)) return "opt";
  if (/sponsor|visa|h-?1b|f-?1|\bopt\b/.test(s)) return "sponsor";
  if (/citizen or permanent/.test(s)) return ""; // the old combined answer: as before, nothing hidden
  if (/green card|permanent resident/.test(s)) return "resident";
  if (/citizen/.test(s)) return "citizen";
  return "";
}

/** The setup chip for a saved answer, or none when it isn't one of today's choices. */
export const authChip = (answer = "") => (AUTH_OPTS.includes(answer) ? [answer] : []);
