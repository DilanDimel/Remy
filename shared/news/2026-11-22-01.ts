import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Your resume in your own file",
  body: "The colours and fixes now show on your own resume. For a Word file, your changes are written into your file so it keeps your exact design. For a PDF, the colours sit on your real pages until you make a change; upload a Word file to keep your design after edits.",
  owners: true,
} satisfies NewsNote;
