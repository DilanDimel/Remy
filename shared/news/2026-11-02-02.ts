import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Skills in the posting’s own words",
  body: "Openings and the tailoring checks now list the skills a posting actually names (Excel, SolidWorks, CPR, Figma), not made-up labels like “Software Skills”. Majors in “pursuing a degree in…” aren’t counted as skills, “you will excel in…” isn’t Excel, and “Python, Java or C++” counts as one choice. More fields covered: engineering, health, design and trades.",
} satisfies NewsNote;
