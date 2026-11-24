import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Your activity, day by day",
  body: "The Activity tab shows every past day, newest first: your chat with Remy as one session you can open, what Remy did, openings he found, applications you started and steps you took.",
  owners: true,
} satisfies NewsNote;
