import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Using Remy, for the team",
  body: "Team & hours now has a Using Remy view: how many days, minutes and visits each owner spent using Remy this week, which parts they opened and what they did, with the same rules for everyone and a shared goal of 3 days a week. It counts only while Remy is open and in use, never recordings or typing, and never students. It's on the website and in the app under Owners.",
  owners: true,
} satisfies NewsNote;
