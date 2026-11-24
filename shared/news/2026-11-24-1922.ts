import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "No more \"502\" page while Remy updates",
  body: "When we ship an update, the new version now starts before the old one stops, so Remy stays open the whole time. The Privacy page now also says Remy keeps an encrypted copy of your workspace with Cloudflare to stay fast.",
} satisfies NewsNote;
