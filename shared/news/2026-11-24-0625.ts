import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "What's new and feedback in the phone app",
  body: "More in the phone app now has What's new, with a count of the notes you haven't seen, and Send feedback, so you can tell the team what's confusing or broken without leaving the app.",
  owners: true,
} satisfies NewsNote;
