import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "Saved openings table: Everyone reads it",
  body: "After owners have read their saved openings from the new table for a day, Admin → System can switch everyone over. Accounts keep their own copy, and Owners read it or Off switches back at once.",
  to: "/admin?tab=system",
  owners: true,
} satisfies NewsNote;
