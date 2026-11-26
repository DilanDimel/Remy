import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Resumes with small typos read correctly",
  body: "A section heading with a typo, like “Employmnet” or “Referances”, now starts its own section. Job lines without bullet marks stay as separate lines, so each one can be edited on its own.",
} satisfies NewsNote;
