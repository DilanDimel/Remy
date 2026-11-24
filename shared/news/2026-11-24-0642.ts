import type { NewsNote } from "../news";

export default {
  kind: "Changed",
  title: "Rewards is part of The Big Upgrade",
  body: "Rewards no longer has its own row on Admin → Feature releases. Releasing The Big Upgrade releases Rewards with it, in one step. The welcome card and the students’ What’s new note now mention the Rewards page.",
  to: "/admin",
  owners: true,
} satisfies NewsNote;
