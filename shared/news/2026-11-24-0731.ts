import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "Students tab gets some color",
  body: "On the owners' dashboard, each student has a colored badge for where they are (Insider, using Remy, hasn't signed in yet), release switches show their state at a glance, and Insider answers read like messages, with the average rating up top. The dropdowns are no longer cut off.",
  owners: true,
  to: "/admin?tab=beta",
} satisfies NewsNote;
