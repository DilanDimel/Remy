import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "A cleaner About page",
  body: "About and Privacy now use the full page with a contents list beside the text, and the team row no longer squeezes names or splits email addresses.",
  to: "/about",
} satisfies NewsNote;
