import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Saved openings table switch on Admin → System",
  body: "Owners can start copying saved openings into their own table, after a fresh backup, and see how the copy compares with each account. Off undoes it at once.",
  to: "/admin?tab=system",
  owners: true,
} satisfies NewsNote;
