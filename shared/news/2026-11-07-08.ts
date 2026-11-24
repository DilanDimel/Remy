import type { NewsNote } from "../news";

export default {
  kind: "Changed",
  title: "Updated privacy, terms and About",
  body: "The privacy policy now covers the Founding Cohort application, your ratings and feedback, and Remy's automatic problem reports (which page broke and what failed; never your screen or what you type). The beta terms add one line: Remy is invite-only during the beta. Because the terms changed, you'll be asked to agree once more. Delete everything now also removes your feedback, problem reports and Founding Cohort application.",
} satisfies NewsNote;
