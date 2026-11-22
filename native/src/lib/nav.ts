import { router } from "expo-router";

/** Open a website page that has no native screen yet, or a tab ("jobs", "path"…) when the link names one.
 * A link with a query ("/path?play=1") or `page: true` opens the website page itself: jumping to the tab you're
 * already on would do nothing (the Path rows and Today's round did exactly that). */
export function go(path: string, title = "Remy", opts: { page?: boolean } = {}) {
  const [base, query] = path.split("?");
  const tab = opts.page || query ? undefined : ({ jobs: "/jobs", "/opportunities": "/jobs", "/path": "/path", path: "/path" } as Record<string, string>)[base];
  if (tab) return router.navigate(tab as any);
  router.push({ pathname: "/web", params: { path: path.startsWith("/") ? path : "/" + path, title } });
}

/** Open Remy's chat with a question ready to send (the student can edit it first). */
export function askRemy(question: string) {
  router.navigate({ pathname: "/remy", params: { ask: question } } as any);
}
