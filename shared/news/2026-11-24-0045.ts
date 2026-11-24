import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Your pins in Remy’s office",
  body: "Remy’s office on My Path now has a corkboard with every career pin you’ve earned, best first, and Remy wears your three best pins on his jacket. Tap the pin count on the board to see all your rewards.",
  owners: true,
  to: "/path",
} satisfies NewsNote;
