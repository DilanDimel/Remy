import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "Errors & feedback fits on one screen",
  body: "On the owners' dashboard, the Errors tab now opens with what to look at first: switch between errors, feedback and recent fixes on the left, and see rage clicks and the most opened pages on the right. The full lists are one click away.",
  owners: true,
  to: "/admin?tab=errors",
} satisfies NewsNote;
