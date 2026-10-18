import { useCallback, useEffect, useState } from "react";
import type { Job, JobFit } from "@shared/types";
import { api, useStore } from "./store";

let cache: { jobs: Job[]; fits: Record<string, JobFit> } | null = null;
const subs = new Set<() => void>();

export async function reloadJobs() {
  cache = await api("GET", "/api/jobs");
  subs.forEach((f) => f());
}

export function useJobs() {
  const { ws } = useStore();
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);
  // refetch when the workspace changes in ways that affect fit or the list
  const key = `${ws?.jobs.length}-${ws?.resume?.uploadedAt}-${ws?.profile.graduation}-${ws?.profile.classYear}-${Object.keys(ws?.fits || {}).length}`;
  useEffect(() => { reloadJobs().catch(() => {}); }, [key]);
  const refresh = useCallback(() => reloadJobs(), []);
  return { jobs: cache?.jobs || null, fits: cache?.fits || {}, refresh };
}

export const kindLabel: Record<Job["kind"], string> = {
  job: "Job", internship: "Internship", program: "Early-career program", campus: "Campus job", event: "Event",
};
export const isEvent = (j: Job) => j.kind === "event";
