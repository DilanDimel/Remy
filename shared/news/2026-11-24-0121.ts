import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "A welcome back after time away",
  body: "Away from Remy for a week or more? Today's quests on My Path greet you with a welcome back instead of a lost streak, and finishing all three opens a chest with double bonus XP. The XP count on My Path also no longer shows a negative number.",
  owners: true,
  to: "/path",
} satisfies NewsNote;
