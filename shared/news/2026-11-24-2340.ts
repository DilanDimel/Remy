import type { NewsNote } from "../news";

export default {
  kind: "Changed",
  title: "Phone app: work authorization is optional in setup",
  body: "The app's setup now has the same five work authorization choices as the website (U.S. citizen, Green card holder, F-1 / OPT now, Will need visa sponsorship, Rather not say), and you can skip the question. It only hides postings you can't take.",
  owners: true,
} satisfies NewsNote;
