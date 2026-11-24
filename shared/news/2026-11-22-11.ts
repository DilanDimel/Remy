import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Texts for urgent deadlines",
  body: "Turn on texts in Account → Appearance & alerts and add your number: Remy texts you when an application closes today or tomorrow, at most once a day. Texts are in test mode for now, so they show on the owners’ dashboard instead of your phone.",
  owners: true,
} satisfies NewsNote;
