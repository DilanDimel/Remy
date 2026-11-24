import type { NewsNote } from "../news";

export default {
  kind: "Changed",
  title: "Founding Cohort: invite-only beta",
  body: "Remy can now run as an invite-only beta. Students apply with the Founding Cohort form; once the team accepts them, they sign in with the same email (Google or a 6-digit email code). Anyone else who tries to sign in sees why and gets the link to apply. Owners manage the accepted list on Admin → Beta list and can email new members “You’re in”.",
  owners: true,
} satisfies NewsNote;
