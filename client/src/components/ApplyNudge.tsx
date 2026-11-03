import type { TrackItem, Workspace } from "@shared/types";
import { rid, useStore } from "../lib/store";

const DAY = 86_400_000;
const ago = (iso?: string) => (iso ? (Date.now() - Date.parse(iso)) / DAY : 0);

/** One question at a time on Home, so applications don't stall silently:
 *  "Did you apply?" 2+ days after the student approved a tailored version, and
 *  "Follow up?" 2+ weeks after they applied with no news since. */
export function ApplyNudge({ w }: { w: Workspace }) {
  const { save, run } = useStore();
  const approvedAt = (t: TrackItem) => w.applications.find((a) => a.id === t.applicationId)?.versions.at(-1)?.at;
  const ask = w.tracker.find((t) => t.status === "Saved" && t.applicationId && ago(approvedAt(t)) >= 2 && !(t.askedAt && ago(t.askedAt) < 5));
  const lastEvent = (t: TrackItem) => t.events.reduce((m, e) => (e.at > m ? e.at : m), "");
  const quiet = !ask && w.tracker.find((t) => t.status === "Applied" && !t.followUp && ago(lastEvent(t)) >= 14);
  const item = ask || quiet;
  if (!item) return null;
  const update = (patch: Partial<TrackItem>, extra?: () => Promise<unknown>) => run(async () => {
    await save("tracker", w.tracker.map((t) => (t.id === item.id ? { ...t, ...patch } : t)));
    if (extra) await extra();
  });
  const name = `${item.company}${item.role ? ` (${item.role})` : ""}`;
  return (
    <section className="card card-pad row-between" style={{ gap: 12 }} data-testid="apply-nudge">
      {ask ? (
        <>
          <span className="small"><b>Did you apply to {name}?</b> You approved your tailored resume {Math.floor(ago(approvedAt(item)))} days ago.</span>
          <div className="row">
            <button className="btn btn-primary btn-sm" data-testid="button-nudge-applied" onClick={() => update({ status: "Applied", events: [...item.events, { id: rid("ev"), at: new Date().toISOString(), status: "Applied", source: "Manual (asked on Home)" }] })}>Yes, I applied</button>
            <button className="btn btn-ghost btn-sm" data-testid="button-nudge-later" onClick={() => update({ askedAt: new Date().toISOString() })}>Not yet</button>
          </div>
        </>
      ) : (
        <>
          <span className="small"><b>No news from {name} in {Math.floor(ago(lastEvent(item)))} days.</b> A short, polite follow-up to the recruiter or a contact there is normal after about two weeks.</span>
          <div className="row">
            <button className="btn btn-primary btn-sm" data-testid="button-nudge-followup" onClick={() => update({ followUp: "added" }, () => save("tasks", [{ id: rid("t"), title: `Send a short follow-up about ${name}`, why: "Two weeks without news: a two-line note restating your interest is normal and often gets a reply.", due: "", category: "Connect", done: false, source: "Follow-up (Home)" }, ...w.tasks]))}>Add a follow-up to-do</button>
            <button className="btn btn-ghost btn-sm" data-testid="button-nudge-dismiss" onClick={() => update({ followUp: "dismissed" })}>Not needed</button>
          </div>
        </>
      )}
    </section>
  );
}
