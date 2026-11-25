import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Remy checks your resume's format",
  body: "Remy now tells you when the format holds your resume back: too many pages for your level, a photo, personal details like your birthday, tiny text or two columns that job sites can scramble. Then pick one of three clean formats with your same words.",
  to: "/resume",
} satisfies NewsNote;
