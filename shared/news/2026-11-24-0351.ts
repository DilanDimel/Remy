import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "Board and Calendar are now one tab",
  body: "On the owners' dashboard, the to-do board sits next to this month's calendar and what's coming up, so the whole team plan fits on one screen. Add a meeting from the calendar card; old Calendar links still open it.",
  owners: true,
  to: "/admin?tab=board",
} satisfies NewsNote;
