import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "Shorter lists on the owners’ dashboard",
  body: "Activity, Hours and Openings on the owners’ dashboard show 20 rows at a time with “Show more”, so they no longer run on for pages.",
  owners: true,
  to: "/admin?tab=activity",
} satisfies NewsNote;
