import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "Services and Database are now one System tab",
  body: "The owners' dashboard has one System page: server, memory, AI money and database space at a glance, the data transfer per day as a chart, the biggest tables, and emails and texts. Old Services and Database links still open it.",
  owners: true,
  to: "/admin",
} satisfies NewsNote;
