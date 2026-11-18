import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Job } from "@shared/types";
import { rid, useStore } from "../lib/store";

/** "Apply" (or "Register" for events) that opens the employer's site, then asks right away "Did you apply?" instead of
 *  days later, for any opening, tailored or not. "Yes" puts it in the tracker as applied (reusing an existing row,
 *  including one the student typed in by hand for the same company and role). */
export function ApplyLink({ j, className = "btn btn-secondary btn-sm", testid = "link-apply" }: { j: Job; className?: string; testid?: string }) {
  const { ws, save, run } = useStore();
  const [ask, setAsk] = useState(false);
  const url = j.applyUrl || j.sourceUrl;
  if (!ws || !url) return null;
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const tracked = ws.tracker.find((t) => t.jobId === j.id) || ws.tracker.find((t) => !t.jobId && same(t.company, j.company) && same(t.role, j.title));
  const markApplied = () => run(async () => {
    const ev = { id: rid("ev"), at: new Date().toISOString(), status: "Applied" as const, source: "Manual (asked after Apply)" };
    await save("tracker", tracked
      ? ws.tracker.map((t) => (t.id === tracked.id ? { ...t, status: "Applied" as const, jobId: t.jobId || j.id, events: [...t.events, ev] } : t))
      : [{ id: rid("tr"), company: j.company, role: j.title, jobId: j.id, status: "Applied" as const, notes: "", events: [ev] }, ...ws.tracker]);
    setAsk(false);
  }, "Added to your tracker as applied");
  return (
    <>
      <a className={className} href={url} target="_blank" rel="noreferrer" onClick={() => { if (j.kind !== "event" && (!tracked || tracked.status === "Saved")) setAsk(true); }} data-testid={testid}>
        {j.kind === "event" ? "Register" : "Apply"} <ArrowUpRight size={13} />
      </a>
      {ask && (
        <span className="row small" style={{ gap: 8, flexBasis: "100%", order: 99 }} data-testid="ask-applied">
          <b>Did you apply?</b>
          <button className="btn btn-primary btn-sm" onClick={markApplied} data-testid="button-applied-yes">Yes, I applied</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAsk(false)} data-testid="button-applied-not-yet">Not yet</button>
        </span>
      )}
    </>
  );
}
