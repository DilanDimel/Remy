import { useState } from "react";
import type { CalItem, TrackItem, Workspace } from "@shared/types";
import { rid, useStore } from "../lib/store";
import { go } from "../lib/router";
import { useCanGo } from "./ComingSoon";

const DAY = 86_400_000;
const ago = (iso?: string) => (iso ? (Date.now() - Date.parse(iso)) / DAY : 0);

/** One question at a time on Home, so applications don't stall silently:
 *  "Did you apply?" 2+ days after the student approved a tailored version, and
 *  "Follow up?" 2+ weeks after they applied with no news since. */
export function ApplyNudge({ w }: { w: Workspace }) {
  const { save, run } = useStore();
  const canMeet = useCanGo()("/community"); // people are saved on Community, locked for students until it's released
  // First, the most time-sensitive: an interview in the last week with no debrief yet.
  const today = new Date().toLocaleDateString("en-CA");
  const interview = w.calendar.find((c) => c.kind === "Interview" && c.date < today && ago(c.date + "T12:00:00") <= 7 && !c.debriefed);
  if (interview) return <Debrief key={interview.id} w={w} c={interview} />;
  // Then a career fair, info session or other event that just happened: the people met there are worth saving now.
  // Only real meet-people events: saved from an event opening, or named like one ("Career fair", "Info session"); not
  // a study session added with the Calendar's default type (skeptic review).
  const MEET = /fair|career|info(rmation)? session|network|meet ?up|mixer|conference|expo|panel|summit|recruit|coffee chat|open house|reception|alumni/i;
  const event = canMeet && w.calendar.find((c) => c.kind === "Event" && c.date < today && ago(c.date + "T12:00:00") <= 7 && !c.debriefed && (!!c.linkedId || MEET.test(c.title)));
  if (event) return <MetAnyone key={event.id} w={w} c={event} />;
  const approvedAt = (t: TrackItem) => w.applications.find((a) => a.id === t.applicationId)?.versions.at(-1)?.at;
  const ask = w.tracker.find((t) => t.status === "Saved" && t.applicationId && ago(approvedAt(t)) >= 2 && !(t.askedAt && ago(t.askedAt) < 5));
  const lastEvent = (t: TrackItem) => t.events.reduce((m, e) => (e.at > m ? e.at : m), "");
  const quiet = !ask && w.tracker.find((t) => (t.status === "Applied" || t.status === "Heard back") && !t.followUp && ago(lastEvent(t)) >= 14);
  const item = ask || quiet;
  if (!item) return null;
  const update = (patch: Partial<TrackItem>, extra?: () => Promise<unknown>) => run(async () => {
    await save("tracker", w.tracker.map((t) => (t.id === item.id ? { ...t, ...patch } : t)));
    if (extra) await extra();
  });
  const name = item.role ? `${item.role} at ${item.company}` : item.company;
  return (
    <section className="card card-pad row-between" style={{ gap: 12 }} data-testid="apply-nudge">
      {ask ? (
        <>
          <span className="small"><b>Did you apply for {name}?</b> You approved your tailored resume {Math.floor(ago(approvedAt(item)))} days ago.</span>
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

/** After an interview: one tap first (Dilan, Nov 19: boxes that ask for effort and give nothing back get ignored), and
 *  each answer does something: a thank-you to-do, a story to build, or the new date if it moved. Notes are optional. */
function Debrief({ w, c }: { w: Workspace; c: CalItem }) {
  const { save, run } = useStore();
  const [how, setHow] = useState("");
  const [text, setText] = useState("");
  const who = c.title.replace(/^interview( with)?:?\s*/i, "");
  const day = new Date(c.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const thanksTask = { id: rid("t"), title: `Send a thank-you note for your ${/interview/i.test(who) ? who.replace(/^(past|your|my)\s+/i, "") : `${who} interview`} (${day})`, why: "Two or three sentences within a day: thank them, mention one thing you discussed, restate your interest.", due: new Date().toLocaleDateString("en-CA"), category: "Connect" as const, done: false, source: `Interview debrief ${c.id}` };
  const finish = (note: string) => run(async () => {
    // Kept in its own field, not the event notes: those sync to Google Calendar and the .ics export, and a debrief is private.
    const full = [how, note].filter(Boolean).join(". ");
    await save("calendar", w.calendar.map((x) => (x.id === c.id ? { ...x, debriefed: true, ...(full ? { debrief: full } : {}) } : x)));
    const t = w.tracker.find((x) => x.id === c.linkedId);
    if (t && full) await save("tracker", w.tracker.map((x) => (x.id === t.id ? { ...x, notes: [x.notes, `Debrief ${c.date}: ${full}`].filter(Boolean).join("\n").slice(-3900) } : x)));
    return true;
  }, note ? "Debrief saved" : undefined);
  const fresh = ago(c.date + "T12:00:00") <= 3;
  const [added, setAdded] = useState(false);
  const thanks = added ? " I added a thank-you note to your to-dos." : "";
  const reply: Record<string, string> = {
    "Went well": `Nice.${thanks} What did they ask? Writing it down makes your next one easier.`,
    "Okay": `Okay is normal.${thanks} Which question felt hardest? Write it down and we'll build a better answer.`,
    "Rough": `That happens to everyone.${thanks} Note the question that threw you, so it can't again.`,
  };
  return (
    <section className="card card-pad stack-sm" data-testid="interview-debrief" style={{ borderLeft: "3px solid var(--fox)" }}>
      <b className="small">{/interview/i.test(who) ? `How did "${who}" go?` : `How did your interview with ${who} go?`} <span className="muted" style={{ fontWeight: 400 }}>({day})</span></b>
      {!how ? (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {["Went well", "Okay", "Rough"].map((k) => <button key={k} className="btn btn-secondary btn-sm" onClick={async () => { setHow(k); if (fresh && !w.tasks.some((x) => x.source === thanksTask.source)) setAdded(!!(await run(() => save("tasks", [thanksTask, ...w.tasks])))); }} data-testid={`button-debrief-${k.toLowerCase().replace(/\s/g, "-")}`}>{k}</button>)}
          <button className="btn btn-ghost btn-sm" onClick={() => { setHow("It didn't happen"); }} data-testid="button-debrief-moved">It didn't happen</button>
        </div>
      ) : how === "It didn't happen" ? (
        <div className="stack-sm">
          <span className="small">Was it moved? Paste the new email and Remy updates your calendar.</span>
          <div className="row"><button className="btn btn-primary btn-sm" onClick={async () => { if (await finish("It was moved")) go("/progress?tab=email"); }}>Paste the new email</button><button className="btn btn-ghost btn-sm" onClick={() => finish("It was canceled")}>It was canceled</button></div>
        </div>
      ) : (
        <div className="stack-sm">
          <span className="small">{reply[how]}</span>
          <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Optional: what they asked, what you'd do differently" maxLength={1500} style={{ minHeight: 60 }} />
          <div className="row"><button className="btn btn-primary btn-sm" onClick={() => finish(text.trim())} data-testid="button-save-debrief">{text.trim() ? "Save" : "Done"}</button></div>
        </div>
      )}
    </section>
  );
}

/** After an event (career fair, info session): the people met there, saved while names are fresh. */
function MetAnyone({ w, c }: { w: Workspace; c: CalItem }) {
  const { save, run } = useStore();
  const name = c.title.replace(/:\s*event$/i, "");
  const done = () => run(() => save("calendar", w.calendar.map((x) => (x.id === c.id ? { ...x, debriefed: true } : x))));
  return (
    <section className="card card-pad row-between" style={{ gap: 12, borderLeft: "3px solid var(--fox)" }} data-testid="event-met">
      <span className="small"><b>Did you meet anyone at {name}?</b> Save them now while you remember names; Remy helps you follow up.</span>
      <div className="row">
        <button className="btn btn-primary btn-sm" onClick={async () => { await done(); go(`/community?met=${encodeURIComponent(name)}&metOn=${c.date}`); }} data-testid="button-event-met-yes">Yes, add them</button>
        <button className="btn btn-ghost btn-sm" onClick={done} data-testid="button-event-met-no">No</button>
      </div>
    </section>
  );
}
