import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Your answer rate",
  body: "Progress now shows how many of your applications got an answer, once you have 5 (an automatic “we received your application” doesn’t count; a rejection does). Two new statuses help: “Heard back” when someone writes back, and “No reply” when you stop waiting. A status you change again within 10 minutes counts as a slip, not an answer. Once you have 3 applications with materials approved in Remy and 3 without, it compares them too.",
} satisfies NewsNote;
