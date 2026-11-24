import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Remy's chat stays on the newest message",
  body: "In the Android app, sending a message used to jump the chat up to older messages, so Remy's reply came in out of sight. The chat now stays at the bottom while Remy writes.",
  owners: true,
} satisfies NewsNote;
