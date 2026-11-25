import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "AI money left matches OpenRouter",
  body: "Admin → System now shows the whole OpenRouter account balance, which every key spends from, instead of only the live key's own cap. The key's own use is shown underneath.",
  to: "/admin?tab=system",
  owners: true,
} satisfies NewsNote;
