import type { NewsNote } from "../news";

export default {
  kind: "Changed",
  title: "Smoother updates behind the scenes",
  body: "Each What’s new note now lives in its own file, so the team can ship several updates at once without them tripping over each other. Nothing changes in how What’s new looks or works.",
  owners: true,
} satisfies NewsNote;
