import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Profile imports that failed to read",
  body: "Adding a LinkedIn PDF or other profile could fail with an error when a quote in it ran across lines. Remy now reads those.",
} satisfies NewsNote;
