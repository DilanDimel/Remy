import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Remy emails you when something fits",
  body: "When Remy finds a new opening that fits you, he emails you about it with two buttons: Yes opens tailoring for that opening, Not now drops it. It only goes to people who used Remy in the last 14 days. Choose daily, weekly (the default) or off in Account → Appearance & alerts. Owners see how many get a Yes on the dashboard.",
  owners: true,
} satisfies NewsNote;
