import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Your streak shows in Remy's office",
  body: "Keep your daily streak going and Remy's office shows it: at 7 days in a row the plant on his desk blooms, at 30 a framed “30 days” photo goes up on the wall, and at 100 it turns gold. Milestones count your best streak, so they stay once you reach them. Rewards lists them under Streak and quests.",
  owners: true,
  to: "/path",
} satisfies NewsNote;
