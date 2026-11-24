import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Release features with one click",
  body: "Admin → Beta has a new Feature releases card. Every new feature starts owners-only; set it to Locked and students see it in the menu with a lock and a “coming in a future update” card over a blurred preview, or Released and everyone gets it. No deploy needed. Interview (with Julio’s mock interview coach) and Community are now locked for students; owners still get both. Switch to student view to see what students see.",
  to: "/admin",
  owners: true,
} satisfies NewsNote;
