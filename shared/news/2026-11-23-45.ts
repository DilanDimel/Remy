import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Openings line counts what you see",
  body: "The line under Opportunities now counts the openings your filters show (“2 new this week. You qualify for 2.”), not every opening Remy found. When filters hide everything it says so. The Owners’ dashboard uses the same Remy. wordmark as the app.",
  owners: true,
} satisfies NewsNote;
