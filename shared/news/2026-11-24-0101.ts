import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Surprises in the daily chest",
  body: "Finish all three daily quests on My Path and tap the chest to open it. Most days it holds 20 bonus XP. Now and then you find something rare for Remy's office that only the chest gives: a bonsai, a golden mug, a team pennant or a record player. Rewards shows which ones you've found.",
  owners: true,
  to: "/path",
} satisfies NewsNote;
