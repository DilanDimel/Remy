import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Owners' System numbers match our DigitalOcean plan",
  body: "Admin → System now measures database space, memory and database transfer against the DigitalOcean plan Remy runs on, instead of the old Supabase and Render limits, so it no longer warns about limits we don't have.",
  owners: true,
} satisfies NewsNote;
