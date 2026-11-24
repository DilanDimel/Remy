import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Release the whole redesign in one step",
  body: "Admin → Beta → Feature releases has a new row, “Beta 2: the new Remy”. Set it to Released and every student gets the new design, Remy’s new look and the owner features you’ve been testing, all at once. Features still marked owners-only, like Rewards, stay with owners, and students keep their own AI model. It starts off; nothing changes for students until you flip it.",
  to: "/admin",
  owners: true,
} satisfies NewsNote;
