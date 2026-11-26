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
  // Today's round is native: Home's streak row, its quest row and My Path's quests all link to /path?play=1.
  if (!opts.page && base === "/path" && q.play) return router.push("/round" as any);
  // Rewards is native too (More → Rewards, and links from My Path and pins).
  if (!opts.page && base === "/rewards") return router.push({ pathname: "/rewards", params: q.tab ? { tab: q.tab } : {} } as any);
  // Email updates and Hours, Progress's other two tabs, are native screens of their own.
  if (!opts.page && base === "/progress" && (q.tab === "email" || q.tab === "hours")) return router.push(`/${q.tab}` as any);
  // Progress is native for Applications and To-dos.
  if (!opts.page && base === "/progress" && (!q.tab || q.tab === "tracker" || q.tab === "todos")) return router.push({ pathname: "/progress", params: q.tab ? { tab: q.tab } : {} } as any);
  // Account is native for the profile summary, Remy's memory, sources and data; its other tabs stay the website's.
  if (!opts.page && base === "/accounts" && (!q.tab || q.tab === "memory")) return router.push("/account" as any);
  // Calendar is native too (More → Calendar, Progress's interview prompt).
  if (!opts.page && base === "/calendar" && !query) return router.push("/calendar" as any);
  // The mock interview is native (More → Interview, job cards, Remy's "start" link).
  if (!opts.page && base.startsWith("/interview#")) return router.push("/prep" as any); // Home's "story deck" link
  if (!opts.page && base === "/interview") return router.push({ pathname: "/interview", params: q } as any);
  // Community is native too (More → Community, Home's "Did you meet anyone at …?").
  if (!opts.page && base === "/community") return router.push({ pathname: "/community", params: q } as any);
  // Team & hours → Using Remy is native (owners).
  if (!opts.page && base === "/admin" && q.view === "use") return router.push("/use" as any);
  const tab = opts.page || query ? undefined : ({ jobs: "/jobs", "/opportunities": "/jobs", "/path": "/path", path: "/path" } as Record<string, string>)[base];
  if (tab) return router.navigate(tab as any);
  router.push({ pathname: "/web", params: { path: path.startsWith("/") ? path : "/" + path, title } });
}

/** Open Remy's chat with a question ready to send (the student can edit it first). With `send`, it is asked at once:
 *  the student already typed it (My Path's office box), so a second tap on Send was one too many. */
export function askRemy(question: string, opts: { send?: boolean } = {}) {
  router.push({ pathname: "/remy", params: { ask: question, ...(opts.send ? { send: "1", at: String(Date.now()) } : {}) } } as any);
}

/** Open Resume on "Remy's fixes", his one-line-at-a-time rewrites (the website's startResumeFix). `at` makes a second
 *  open work after the student closed it. */
export function openResumeFix() {
  router.navigate({ pathname: "/resume", params: { fix: "1", at: String(Date.now()) } } as any);
}

/** Open the Jobs tab on For you ("new") or Kept. `at` makes a second tap work after the student switched tabs. */
export function openJobs(show: "new" | "kept") {
  router.navigate({ pathname: "/jobs", params: { show, at: String(Date.now()) } } as any);
}
