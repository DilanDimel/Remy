// The "What's new" notes, one file each in shared/news/ (see shared/news.ts), gathered at build time by Metro, the way
// the website gathers them with Vite (client/src/lib/news.ts). A note added in a PR shows in the next app update.
import { latestNewsId as latest, toNews, unseenNews as unseen, type NewsNote } from "@shared/news";

// @ts-ignore: Metro's require.context (Expo turns it on for expo-router); TypeScript doesn't know it.
const files = require.context("../../../shared/news", false, /\.ts$/);
export const NEWS = toNews(Object.fromEntries(files.keys().map((k: string) => [k.replace(/^.*\//, ""), files(k).default as NewsNote])));
export const unseenNews = (seen: string | undefined, owner = false, redesign = false) => unseen(NEWS, seen, owner, redesign);
export const latestNewsId = () => latest(NEWS);
