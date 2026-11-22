import { router } from "expo-router";

/** Open a website page that has no native screen yet, or a tab ("jobs", "path"…) when the link names one. */
export function go(path: string, title = "Remy") {
  const tab = ({ jobs: "/jobs", "/opportunities": "/jobs", "/path": "/path", path: "/path" } as Record<string, string>)[path.split("?")[0]];
  if (tab) return router.navigate(tab as any);
  router.push({ pathname: "/web", params: { path: path.startsWith("/") ? path : "/" + path, title } });
}
