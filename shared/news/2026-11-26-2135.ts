import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Remy reads more resume layouts correctly",
  body: "When a PDF drops the bullet dots, Remy keeps each line under its job instead of making it a job of its own. \"Server, Olive Garden\" is read as the role and the employer, headings like \"— PROFILE —\" or \"Management Experience\" are read as sections, and \"Champaign IL\" is found as your city. Resume suggestions no longer ask your summary or certifications for dates, and short dates like \"Jun. '26\" count.",
} satisfies NewsNote;
