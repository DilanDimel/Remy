import { useState } from "react";
import type { CalItem, TrackItem, Workspace } from "@shared/types";
import { rid, useStore } from "../lib/store";

const DAY = 86_400_000;
const ago = (iso?: string) => (iso ? (Date.now() - Date.parse(iso)) / DAY : 0);

/** One question at a time on Home, so applications don't stall silently:
 *  "Did you apply?" 2+ days after the student approved a tailored version, and
 *  "Follow up?" 2+ weeks after they applied with no news since. */
export function ApplyNudge({ w }: { w: Workspace }) {
  const { save, run } = useStore();
  // First, the most time-sensitive: an interview in the last week with no debrief yet.
  const today = new Date().toLocaleDateString("en-CA");
  const interview = w.calendar.find((c) => c.kind === "Interview" && c.date < today && ago(c.date + "T12:00:00") <= 7 && !c.debriefed);
  if (interview) return <Debrief w={w} c={interview} />;
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

/** After an interview: what they asked and what to do differently, written while it's fresh, plus a thank-you note to-do. */
function Debrief({ w, c }: { w: Workspace; c: CalItem }) {
  const { save, run } = useStore();
  const [text, setText] = useState("");
  const [thanks, setThanks] = useState(ago(c.date + "T12:00:00") <= 2);
  const who = c.title.replace(/^interview:?\s*/i, "");
  const finish = (note: string, addThanks: boolean) => run(async () => {
    const stamp = `Debrief ${c.date}: ${note}`;
    await save("calendar", w.calendar.map((x) => (x.id === c.id ? { ...x, debriefed: true, notes: note ? [x.notes, stamp].filter(Boolean).join("\n") : x.notes } : x)));
    const t = w.tracker.find((x) => x.id === c.linkedId);
    if (t && note) await save("tracker", w.tracker.map((x) => (x.id === t.id ? { ...x, notes: [x.notes, stamp].filter(Boolean).join("\n") } : x)));
    if (addThanks) await save("tasks", [{ id: rid("t"), title: `Send a thank-you note for your ${who} interview`, why: "Two or three sentences within a day: thank them, mention one thing you discussed, restate your interest.", due: "", category: "Connect", done: false, source: "Interview debrief (Home)" }, ...w.tasks]);
  }, note ? "Debrief saved" : undefined);
  return (
    <section className="card card-pad stack-sm" data-testid="interview-debrief">
      <b className="small">How did your interview go? {who}, {c.date}</b>
      <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="What did they ask? What went well? What would you do differently next time?" style={{ minHeight: 70 }} data-testid="input-debrief" />
      <label className="row small"><input type="checkbox" checked={thanks} onChange={(e) => setThanks(e.target.checked)} /> Add a thank-you note to my to-dos</label>
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={!text.trim()} onClick={() => finish(text.trim(), thanks)} data-testid="button-save-debrief">Save debrief</button>
        <button className="btn btn-ghost btn-sm" onClick={() => finish("", false)} data-testid="button-skip-debrief">Skip</button>
      </div>
    </section>
  );
}
