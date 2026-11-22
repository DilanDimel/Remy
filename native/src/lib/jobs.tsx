import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Job, JobFit, Workspace } from "@shared/types";
import { api } from "./api";
import { useSession } from "./session";

type JobsRes = { jobs: Job[]; fits: Record<string, JobFit>; needsProfile?: string };
type Jobs = { jobs: Job[]; fits: Record<string, JobFit | undefined>; loading: boolean; error: string; reload: () => Promise<void>;
  keep: (j: Job) => Promise<void>; pass: (j: Job) => Promise<void> };
const Ctx = createContext<Jobs>(null as unknown as Jobs);

/** Openings and fits, loaded once and shared by Today and Jobs. */
export function JobsProvider({ children }: { children: ReactNode }) {
  const { status, setWs } = useSession();
  const [data, setData] = useState<JobsRes>({ jobs: [], fits: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await api<JobsRes>("GET", "/api/jobs")); setError(""); } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { if (status === "ready") reload(); }, [status, reload]);
  // Same calls as the website's Keep / Pass (client/src/pages/Opportunities.tsx).
  const keep = async (j: Job) => setWs(await api<Workspace>("PUT", `/api/jobs/${j.id}/interest`, { rating: 5, keep: true }));
  const pass = async (j: Job) => setWs(await api<Workspace>("PUT", `/api/jobs/${j.id}/interest`, { rating: 1, hide: true }));
  return <Ctx.Provider value={{ jobs: data.jobs, fits: data.fits, loading, error, reload, keep, pass }}>{children}</Ctx.Provider>;
}
export const useJobs = () => useContext(Ctx);
