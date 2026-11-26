import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Remy reads more resume layouts correctly",
  body: "When a PDF drops the bullet dots, Remy now keeps each line under its job instead of making it a job of its own. \"Server, Olive Garden\" is read as the role and the employer, and headings like \"Graphic Design Experience\" or \"Management Experience\" start their own section.",
} satisfies NewsNote;
