import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Your major reads right when a dot sits before your GPA",
  body: "A degree line like \"Finance · GPA 3.6\" now fills in your major as Finance, without the dot.",
  to: "/accounts?tab=profile",
} satisfies NewsNote;
