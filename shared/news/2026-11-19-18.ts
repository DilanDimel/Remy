import type { NewsNote } from "../news";

export default {
  kind: "New",
  owners: true,
  title: "Owners only: Career quest, for testing",
  body: "Owners now see a test version of Career quest: your level, XP and a weekly streak in the left menu, and this week's 3 missions on Home. Missions finish by themselves when you do the real thing (rate openings, save or tailor one, add a person, answer a story question, add a number to a bullet, apply). One mission a week keeps the streak; one missed week is forgiven. Badges only for real wins. Students don't see any of it yet.",
} satisfies NewsNote;
