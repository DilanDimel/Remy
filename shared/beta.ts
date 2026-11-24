// What a student agrees to before using Remy. Bump the version when the wording changes
// so everyone is asked again. shortcut: written by the team, not reviewed by a lawyer yet — get it reviewed before a paid launch.
export const BETA_TERMS_VERSION = "2026-11-18"; // 2026-11-18: "beta testers", not "Founding Cohort" · 2026-11-07: invite-only Founding Cohort line; "Coming soon" wording gone · 2026-11-02: age line

export const BETA_TERMS_LEAD = "Remy is in beta and still improving. By using it you agree that:";

/** Short labels shown above each term (same order as BETA_TERMS; a test keeps the two the same length).
 *  They only help scanning; the terms' own wording is what students agree to. */
export const BETA_TERM_HEADS = ["16 or older", "Invite-only access", "As is, no guarantees", "Check everything", "You're responsible", "Not professional advice", "Limits on liability", "Keep your own copies"];

export const BETA_TERMS = [
  "You're at least 16. If you're under 18, a parent or guardian has read these terms and agrees to them with you.",
  "During the beta, Remy is invite-only: access is for students the team accepts as beta testers, and the team can end or pause access at any time.",
  "Remy is provided as is, without guarantees. Features may change, break or be removed while we build it.",
  "Remy can be wrong. Its suggestions, job matches, scores and drafts are a starting point; check everything yourself before you rely on it or send it.",
  "You're responsible for what you put on your resume, in applications and in messages you send. Remy never applies or sends anything for you.",
  "Remy is not a replacement for your school's career center, an advisor, or legal, financial or immigration advice.",
  "To the fullest extent the law allows, the Remy team isn't liable for any loss or harm from using Remy, including missed deadlines, rejected applications or lost data.",
  "Keep your own copies of anything important. Beta data may be lost, though we work hard to keep it safe.",
];

// Open access (Nov 24): anyone can sign in, so the "invite-only" point reads differently. Its own version, so the day
// owners open Remy everyone agrees once to the open wording (and again if access goes back to invite-only).
export const OPEN_TERMS_VERSION = "2026-11-24-open";
export const OPEN_TERM_2 = "Remy is open to anyone who signs up and is free during the beta. The team can limit, pause or end access at any time, and some features have daily limits.";
export const termsFor = (open?: boolean) => ({
  version: open ? OPEN_TERMS_VERSION : BETA_TERMS_VERSION,
  terms: open ? BETA_TERMS.map((t, i) => (i === 1 ? OPEN_TERM_2 : t)) : BETA_TERMS,
  heads: open ? BETA_TERM_HEADS.map((h, i) => (i === 1 ? "Free during beta" : h)) : BETA_TERM_HEADS,
});

// Beta Insider: offered after a few days of use; insiders get a special pin and a 3-question survey every two weeks
// (the first a week after joining). Days are YYYY-MM-DD.
export const INSIDER_AFTER_DAYS = 3;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);
export const insiderEligible = (w: { visits?: string[]; insider?: unknown }) => !w.insider && (w.visits?.length || 0) >= INSIDER_AFTER_DAYS;
export const insiderSurveyDue = (w: { insider?: { joinedAt: string; surveyAt?: string } }, today: string) =>
  !!w.insider && (w.insider.surveyAt ? daysBetween(w.insider.surveyAt, today) >= 14 : daysBetween(w.insider.joinedAt, today) >= 7);
export const INSIDER_SURVEY = [
  "How useful was Remy for you in the last two weeks, from 1 (not at all) to 5 (very)?",
  "What's one thing Remy got wrong or made hard?",
  "What should Remy do next for you?",
];
