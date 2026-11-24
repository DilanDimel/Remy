import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Remy knows what he emailed you",
  body: "Remy now remembers the emails he sent you (new openings, deadline reminders and your weekly digest), so in chat you can ask “what did you email me about?” and he can pick up where the email left off. He only sees your own emails.",
  owners: true,
} satisfies NewsNote;
