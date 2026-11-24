import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "A new owners' dashboard",
  body: "The Overview opens with a greeting, the week's north star and what needs you (errors, feedback, your to-dos), then coloured tiles and the team's hours. Hours shows each person's total and last 8 weeks, and you can add time you forgot to clock. The Agents tab is gone; nobody used it.",
  owners: true,
} satisfies NewsNote;
