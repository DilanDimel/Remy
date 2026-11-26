import type { NewsNote } from "../news";

export default {
  kind: "New",
  title: "Students, openings and team hours in the app",
  body: "The owners' dashboard in the phone app now has Students (who's in, applications, adding people, stats), Openings (every saved posting with filters) and Team & hours (clock in, add forgotten time, everyone's week, activity), like the website.",
  owners: true,
} satisfies NewsNote;
