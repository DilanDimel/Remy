import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "The tour no longer flickers between pages",
  body: "When Remy’s tour moved to another page, the screen flashed bright, the highlight slid across from where it was on the last page, and the bubble jumped ahead of it. Now the screen stays dimmed while the next page opens, and the highlight and bubble appear right where they belong.",
} satisfies NewsNote;
