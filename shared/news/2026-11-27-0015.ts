import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Delete everything no longer says a sign-in record is left",
  body: "When you delete your account with a LinkedIn or email sign-in, Remy used to say a sign-in record couldn't be removed and to email the team. Nothing was left over: your account is fully deleted, and now Remy says so.",
  to: "/account",
} satisfies NewsNote;
