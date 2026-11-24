import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Let everyone in, with one switch",
  body: "Admin → Beta has a new switch: “Let everyone in”. When it’s on, anyone can sign in and start right away, no application. Tailoring is capped at 5 a day per student, every page gets a Feedback button, mock interview scorecards ask “Was this useful?”, and after 3 days of use Remy invites students to Beta Insider (a secret pin and three quick questions every two weeks). “Back to invite-only” returns to apply-first at any time. It’s off until the team turns it on.",
  to: "/admin",
  owners: true,
} satisfies NewsNote;
