import type { NewsNote } from "../news";

// Students see this once owners release the redesign (Admin → Feature releases → The Big Upgrade).
export default {
  kind: "New",
  title: "The Big Upgrade is here",
  body: "Remy’s biggest update yet. Every page has a cleaner look, and Remy has a fresh look to match. Ask him in chat to save an opening, add a to-do or fix a resume line, and he does it; you approve every change and can undo anything. My Path is now Remy’s office, with your plan, streak and level in one place, and the new Rewards page shows every pin, level and outfit you can earn. Openings come with the reason they fit you. Want the full tour? Open the menu and pick “Show me around again”.",
  to: "/path",
  release: "redesign",
} satisfies NewsNote;
