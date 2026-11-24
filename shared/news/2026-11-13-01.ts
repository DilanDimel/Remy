import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Fixes from the first feedback",
  body: "When you tailor, answers like “idk” or “I don’t really have one” count as skipped, so they’re never saved as facts about you or used in your letter. If you skip most of Remy’s questions, it tells you the letter will be generic and asks for one real reason first (or type “go” to write it anyway). Evidence Passport now knows “MS Excel” and “Microsoft Excel” are the same skill. Your 30-second pitch no longer ends with a question. LinkedIn coach says plainly that it can’t see your photo instead of asking you to check. Longer feedback notes are now kept in full.",
} satisfies NewsNote;
