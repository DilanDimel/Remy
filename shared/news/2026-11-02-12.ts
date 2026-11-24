import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "Cleaner postings and skill lists",
  body: "Postings from school-district job boards no longer show code bits like “document.write” or “&bull;”. Skills written as a group, like “Excel (pivot tables, VLOOKUP)” or “Microsoft Office (Word, Outlook)”, are read as the skills they are instead of being cut at the comma, and one-letter languages like R are kept.",
} satisfies NewsNote;
