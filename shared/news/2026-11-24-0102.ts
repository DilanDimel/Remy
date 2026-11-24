import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Full titles in What’s new",
  body: "Long update titles in the What’s new list now wrap onto a second line instead of getting cut off with “…”, on phones and computers.",
  owners: true,
} satisfies NewsNote;
