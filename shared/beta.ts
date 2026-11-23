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
