import type { NewsNote } from "../news";

export default {
  kind: "Changed",
  title: "Clearer beta note",
  body: "The “Before you start” screen and the terms on the About page now simply say Remy is in beta and still improving. The terms themselves haven’t changed, so you won’t be asked to agree again.",
  to: "/about",
} satisfies NewsNote;
