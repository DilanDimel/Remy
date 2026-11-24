import type { NewsNote } from "../news";

// Students see this once owners release the redesign (Admin → Feature releases → Beta 2).
export default {
  kind: "New",
  title: "Welcome to Beta 2",
  body: "Remy’s biggest update yet. Every page has a cleaner look, and Remy has a fresh look to match. Ask him in chat to save an opening, add a to-do or fix a resume line, and he does it; you approve every change and can undo anything. My Path is now Remy’s office, with your plan, streak and level in one place. Openings come with the reason they fit you. Want the full tour? Open the menu and pick “Show me around again”.",
  to: "/path",
  release: "redesign",
} satisfies NewsNote;
