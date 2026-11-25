import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "Remy reads scanned resumes",
  body: "If your resume is a scan or a photo saved as a PDF, Remy now reads the words off the page instead of turning it away. Check each line against your original before you use it.",
  to: "/resume",
} satisfies NewsNote;
