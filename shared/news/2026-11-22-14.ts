import type { NewsNote } from "../news";

export default {
  kind: "Changed",
  title: "A simpler homepage",
  body: "The public homepage is shorter and plainer: one message, a real look at the app, the team, and links to our Instagram (@coachremyai) and LinkedIn. The “pick a major” browser moved to its own page. Owners see it from “Remy homepage” in the sidebar; visitors still see today’s page until Dilan releases it.",
  owners: true,
} satisfies NewsNote;
