import { useCallback, useEffect, useState } from "react";
import type { Job, JobFit, Workspace } from "@shared/types";
import { api, useStore } from "./store";

let cache: { jobs: Job[]; fits: Record<string, JobFit>; needsProfile?: string; refreshing?: boolean } | null = null;
let polling = false;
const subs = new Set<() => void>();

let loadedAt = 0;
export async function reloadJobs() {
  loadedAt = Date.now();
  cache = await api("GET", "/api/jobs");
  subs.forEach((f) => f());
}

// A tab left open: reload openings when the student comes back after 5 minutes, or every 15 while it's open.
// Loading them also starts Remy's own search when the last one is over 6 hours old (server side).
if (typeof document !== "undefined") {
  const visible = () => document.visibilityState === "visible" && subs.size > 0;
  const onBack = () => { if (visible() && Date.now() - loadedAt > 5 * 60_000) reloadJobs().catch(() => {}); };
  document.addEventListener("visibilitychange", onBack);
  window.addEventListener("focus", onBack);
  setInterval(() => { if (visible() && Date.now() - loadedAt > 15 * 60_000) reloadJobs().catch(() => {}); }, 60_000);
}

export function useJobs() {
  const { ws, setWs } = useStore();
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);
  // refetch when the workspace changes in ways that affect fit or the list
  const key = `${ws?.jobs.length}-${ws?.resume?.uploadedAt}-${ws?.profile.graduation}-${ws?.profile.classYear}-${Object.keys(ws?.fits || {}).length}`;
  useEffect(() => { reloadJobs().catch(() => {}); }, [key]);
  // Remy searches employers' sites by itself every few hours; while it does, check back until it's done.
  const refreshing = !!cache?.refreshing;
  useEffect(() => {
    if (!refreshing || polling) return;
    polling = true;
    const t = setInterval(async () => {
      await reloadJobs().catch(() => {});
      if (cache?.refreshing) return;
      clearInterval(t);
      polling = false;
      const m = await api<{ workspace: Workspace | null }>("GET", "/api/me").catch(() => null);
      if (m?.workspace) setWs(m.workspace);
    }, 8000);
    return () => { clearInterval(t); polling = false; };
  }, [refreshing, setWs]);
  const refresh = useCallback(() => reloadJobs(), []);
  return { jobs: cache?.jobs || null, fits: cache?.fits || {}, needsProfile: cache?.needsProfile, refreshing, refresh };
}

export const kindLabel: Record<Job["kind"], string> = {
  job: "Job", internship: "Internship", program: "Early-career program", campus: "Campus job", event: "Event",
};
export const isEvent = (j: Job) => j.kind === "event";
export { sameOrg } from "@shared/org";
