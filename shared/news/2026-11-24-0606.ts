import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Team & hours shows what everyone's AI is working on",
  body: "Each teammate's row now says what they're working on and how many requests from other teammates are open, overdue or done. Hours and AI cost written in a merged pull request are added to their time automatically, once, and never on top of time they already clocked.",
  owners: true,
} satisfies NewsNote;
