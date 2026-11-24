import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "No more crashes with your browser's translator on",
  body: "If you use your browser's “Translate this page” or a page-changing extension, Remy no longer crashes when something on the page updates (a translated line may not refresh until you reload). And when an AI answer comes back cut off, Remy retries it with more room instead of failing.",
} satisfies NewsNote;
