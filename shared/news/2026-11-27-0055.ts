import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "Team hours fill in on their own",
  body: "Team & hours now adds estimated time from each owner's commits, PRs and Claude work every hour, marked \"auto, estimated\". Time you clock or log always comes first.",
  owners: true,
} satisfies NewsNote;
