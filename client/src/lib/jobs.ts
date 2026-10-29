import { useCallback, useEffect, useState } from "react";
import type { Job, JobFit, Workspace } from "@shared/types";
import { api, useStore } from "./store";

let cache: { jobs: Job[]; fits: Record<string, JobFit>; needsProfile?: string; refreshing?: boolean } | null = null;
let polling = false;
const subs = new Set<() => void>();

export async function reloadJobs() {
  cache = await api("GET", "/api/jobs");
  subs.forEach((f) => f());
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
