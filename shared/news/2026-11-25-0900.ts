import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Owners see every student profile",
  body: "Admin → Students now lists everyone who signed up, not just the Founding Cohort, newest first. New counts show total profiles, new today and this week, active students and how many finished setup.",
  owners: true,
  to: "/admin?tab=beta",
} satisfies NewsNote;
