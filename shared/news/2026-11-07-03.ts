import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "Accept sends a welcome email",
  body: "On Admin → Beta list, Accept now opens a ready-to-send “You're in” email with the student's name and exact sign-in email filled in. Edit it if you like, see exactly what they'll get, then Accept & send: it goes out from the Remy email with a Sign in button. Accepted students have an “Email them” button to send it again.",
  owners: true,
} satisfies NewsNote;
