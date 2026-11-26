import type { NewsNote } from "../news";

export default {
  kind: "Fixed",
  title: "No more endless loading screen",
  body: "If Remy can't reach the server, or loading takes longer than 25 seconds, the website now says the page isn't loading and gives you a Try again button, instead of spinning forever or looking like you were signed out.",
} satisfies NewsNote;
