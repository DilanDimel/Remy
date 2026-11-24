import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "No more freezes after you update your resume",
  body: "After you uploaded or edited your resume, the next visit to Opportunities could make Remy freeze for a few seconds for everyone, because it re-checked every opening against your resume the slow way. That check is now about 10 times faster, so the pause is a fraction of a second instead of several seconds. A resume or posting with the word “constructor” in it no longer breaks the match scores either.",
} satisfies NewsNote;
