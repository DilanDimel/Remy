import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "Release switches are at the top of Beta",
  body: "On the owners' dashboard, the Beta tab now opens with \"Let everyone in\" and Feature releases, so you don't have to scroll past the cohort numbers to flip a release.",
  owners: true,
  to: "/admin?tab=beta",
} satisfies NewsNote;
