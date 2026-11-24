import { router } from "expo-router";

/** Open a website page that has no native screen yet, or a tab ("jobs", "path"…) when the link names one.
 * A link with a query ("/path?play=1") or `page: true` opens the website page itself: jumping to the tab you're
 * already on would do nothing (the Path rows and Today's round did exactly that). */
export function go(path: string, title = "Remy", opts: { page?: boolean } = {}) {
  const [base, query] = path.split("?");
  // Tailoring is native now: the website's /resume?tab=tailor&job=… (Home's one thing, Jobs) opens the app's screen.
  // (Parsed by hand: React Native's URLSearchParams has no get() on every version.)
  const q = Object.fromEntries((query || "").split("&").filter(Boolean).map((kv) => { const [k, v = ""] = kv.split("="); return [k, decodeURIComponent(v)]; }));
  if (!opts.page && base === "/resume" && q.tab === "tailor") return router.push({ pathname: "/tailor", params: { ...(q.job ? { job: q.job } : {}), ...(q.app ? { app: q.app } : {}) } } as any);
  // Rewards is native too (More → Rewards, and links from My Path and pins).
  if (!opts.page && base === "/rewards") return router.push({ pathname: "/rewards", params: q.tab ? { tab: q.tab } : {} } as any);
  // Progress is native for Applications and To-dos; Email updates and Hours stay the website's tabs for now.
  if (!opts.page && base === "/progress" && (!q.tab || q.tab === "tracker" || q.tab === "todos")) return router.push({ pathname: "/progress", params: q.tab ? { tab: q.tab } : {} } as any);
  // Calendar is native too (More → Calendar, Progress's interview prompt).
  if (!opts.page && base === "/calendar" && !query) return router.push("/calendar" as any);
  const tab = opts.page || query ? undefined : ({ jobs: "/jobs", "/opportunities": "/jobs", "/path": "/path", path: "/path" } as Record<string, string>)[base];
  if (tab) return router.navigate(tab as any);
  router.push({ pathname: "/web", params: { path: path.startsWith("/") ? path : "/" + path, title } });
}

/** Open Remy's chat with a question ready to send (the student can edit it first). */
export function askRemy(question: string) {
  router.push({ pathname: "/remy", params: { ask: question } } as any);
}

/** Open the Jobs tab on For you ("new") or Kept. `at` makes a second tap work after the student switched tabs. */
export function openJobs(show: "new" | "kept") {
  router.navigate({ pathname: "/jobs", params: { show, at: String(Date.now()) } } as any);
}
