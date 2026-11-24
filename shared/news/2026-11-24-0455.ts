import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "The phone app's tab bar is dark in dark mode",
  body: "On Android the tab bar stayed light when the app was dark. It now follows the app's theme. On My Path, the arrow next to \"Ask Remy anything\" opens Remy's chat even before you type.",
  owners: true,
} satisfies NewsNote;
