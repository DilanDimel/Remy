import type { NewsNote } from "../news";

export default {
  kind: "New",
  owners: true,
  title: "The app tells you when you're offline",
  body: "If your phone can't reach Remy, the app now shows a small note at the top instead of failing quietly. It goes away on its own once you're back online.",
} satisfies NewsNote;
