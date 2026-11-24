import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "The phone app has its own release switch",
  body: "Admin → Beta → Feature releases now lists the phone app. It stays with owners until you release it; then students who sign in to the app get in instead of seeing \"The new app is almost here\".",
  owners: true,
} satisfies NewsNote;
