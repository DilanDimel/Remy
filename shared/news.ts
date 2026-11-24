// "What's new": short notes about each update. Each note is its own file in shared/news/, named by its id, so PRs
// that add notes never touch the same file (docs/development.md). Ids are "YYYY-MM-DD-HHMM" (UTC time you wrote it;
// older ones end in a 2-digit counter) and only ever grow, so "seen up to this id" works.
export type NewsItem = { id: string; date: string; kind: "New" | "Improved" | "Fixed" | "Changed"; title: string; body: string; owners?: boolean; to?: string;
  /** "redesign": students see this note only once owners release the redesign (shared/features.ts). */
  release?: "redesign" };
/** What a note file in shared/news/ exports: the id and date come from its file name. */
export type NewsNote = Omit<NewsItem, "id" | "date">;

/** Turns { "<path>/2026-11-24-0130.ts": note } (a Vite glob, or files read in tests) into notes, newest first. */
export const toNews = (files: Record<string, NewsNote>): NewsItem[] =>
  Object.entries(files)
    .map(([path, note]) => { const id = path.replace(/^.*\//, "").replace(/\.ts$/, ""); return { ...note, id, date: id.slice(0, 10) }; })
    .sort((a, b) => (a.id < b.id ? 1 : -1));

/** Whether someone sees a note: owners see all; others skip owner-only notes, and redesign notes until it's released. */
export const showsNews = (n: NewsItem, owner = false, redesign = false) => owner || (!n.owners && (!n.release || redesign));
/** Items someone hasn't seen: newer than the last id they opened. Owners also see owner-only notes. */
export const unseenNews = (news: NewsItem[], seen: string | undefined, owner = false, redesign = false) =>
  news.filter((n) => showsNews(n, owner, redesign) && (!seen || n.id > seen));
export const latestNewsId = (news: NewsItem[]) => news.reduce((a, n) => (n.id > a ? n.id : a), "");
/** "Caught up as of now", in note-id form: new accounts start here, so only notes written after they joined show. */
export const newsMark = (now: Date) => now.toISOString().slice(0, 16).replace("T", "-").replace(":", "");

// Owners' What's new links each note to its page (Nov 23 PM review: 25 rage clicks on the list). `to` wins; otherwise the
// first page the title names. shortcut: keyword match on the title, set `to` on a note when it guesses wrong.
const PAGES: [RegExp, string][] = [
  [/my path|office|season|streak/i, "/path"], [/resume|cv\b|ats|linkedin/i, "/resume"], [/interview/i, "/interview"],
  [/opening|opportunit|job/i, "/opportunities"], [/calendar/i, "/calendar"], [/progress|to-do|application/i, "/progress"],
  [/community|people/i, "/community"], [/account|profile|memory|setting/i, "/accounts"], [/home\b|tour/i, "/"],
];
export const newsLink = (n: NewsItem) => n.to ?? PAGES.find(([re]) => re.test(n.title))?.[1];
