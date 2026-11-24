// The "What's new" notes, one file each in shared/news/ (see shared/news.ts), gathered at build time by Vite.
import { latestNewsId as latest, toNews, unseenNews as unseen, type NewsNote } from "@shared/news";

export const NEWS = toNews(import.meta.glob<NewsNote>("@shared/news/*.ts", { eager: true, import: "default" }));
export const unseenNews = (seen: string | undefined, owner = false, redesign = false) => unseen(NEWS, seen, owner, redesign);
export const latestNewsId = () => latest(NEWS);
