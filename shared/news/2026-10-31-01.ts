import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Smoother setup",
  body: "Setup no longer gets stuck after the last question, start dates are always in the future, and answering a question twice won't repeat your answer.",
} satisfies NewsNote;
