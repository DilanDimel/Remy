import type { NewsNote } from "../news";

export default {
  kind: "Changed",
  title: "Privacy page says exactly what happens",
  body: "The Privacy & terms page now spells out how long backups keep a copy after you delete your account, what the team can read when you send feedback or join Beta Insider, that work authorization is optional, and that Remy uses no ad or analytics trackers.",
  to: "/policies",
} satisfies NewsNote;
