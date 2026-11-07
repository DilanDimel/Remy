import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Inbox, Mail, Plus, Trash2, Wand2 } from "lucide-react";
import type { HoursEntry, Suggestion, Task, TrackItem, TrackStatus, Workspace } from "@shared/types";
import { api, fmtDate, rid, useStore } from "../lib/store";
import { useCompleting } from "../lib/completing";
import { go, useRoute } from "../lib/router";
import { Empty, Modal, Remy, Spinner, StatusChip } from "../components/common";
import { MIN_FOR_RATE, replyStats } from "@shared/progress";

const STATUSES: TrackStatus[] = ["Saved", "Applied", "Received", "Heard back", "Interview", "Offer", "Rejected", "No reply", "Withdrawn"];
const STATUS_HELP: Record<string, string> = {
  Received: "Application receipt — the employer confirmed they got it. Not an interview.",
  "Heard back": "A person wrote back (asked for more, offered a quick call) — not an interview yet.",
  Interview: "An interview invitation — not an offer.",
  "No reply": "You stopped waiting: no answer after you applied.",
  Offer: "A written offer of employment or internship.",
};
type Tab = "tracker" | "email" | "todos" | "hours";

export default function Progress() {
  const { query } = useRoute();
  const tab = (query.get("tab") as Tab) || "tracker";
  const { ws } = useStore();
  const open = ws!.suggestions.filter((s) => s.state === "open").length;
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Progress</span>
          <h1>Follow through, without the spreadsheet.</h1>
          <p className="hide-phone">Track every application, turn recruiting emails into reviewed status updates, and keep your to-dos honest.</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {([["tracker", "Applications"], ["email", `Email updates${open ? ` (${open})` : ""}`], ["todos", "To-dos"], ["hours", "Hours"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(`/progress?tab=${k}`)} data-testid={`tab-progress-${k}`}>{l}</button>
        ))}
      </div>
      {tab === "tracker" && <Tracker />}
      {tab === "email" && <EmailUpdates />}
      {tab === "todos" && <Todos />}
      {tab === "hours" && <Hours />}
    </>
  );
}

/** After a "no": three small steps that turn it into the next application, never a pep talk with made-up numbers. */
// How many applications got a reply from a person, with tailored vs not once both have 3 (council, Nov 6).
function ReplyRate() {
  const { ws } = useStore();
  const r = replyStats(ws!);
  if (!r.applied) return null;
  return (
    <div className="card card-pad stack-sm" data-testid="reply-rate">
      {r.rate === null
        ? <span className="small">Your answer rate shows after {MIN_FOR_RATE} applications (you have {r.applied}). Mark an application <b>Heard back</b> when someone writes back, or <b>No reply</b> when you stop waiting.</span>
        : <span><b>{r.replied} of {r.applied}</b> applications got an answer (<b>{r.rate}%</b>) · {r.interviews} interview{r.interviews === 1 ? "" : "s"} · {r.offers} offer{r.offers === 1 ? "" : "s"}</span>}
      {r.split && <span className="small muted">Materials approved in Remy: {r.split.tailored.replied} of {r.split.tailored.applied} answered ({r.split.tailored.rate}%) · Not tailored: {r.split.plain.replied} of {r.split.plain.applied} ({r.split.plain.rate}%)</span>}
      <span className="xs muted">An automatic "we received your application" doesn't count; a rejection does, since you got an answer.</span>
    </div>
  );
}

function Recovery({ t }: { t: TrackItem }) {
  const { ws, save, run } = useStore();
  const w = ws!;
  const mark = (recovery: TrackItem["recovery"]) => w.tracker.map((x) => (x.id === t.id ? { ...x, recovery } : x));
  const add = () => run(async () => {
    const steps: [string, string, string][] = [
      [`Send ${t.company} a short thank-you and ask for one piece of feedback`, "Two or three sentences. Many won't answer, but a reply can tell you what to fix, and it leaves a good impression for next time.", "/community"],
      [`Find two openings like ${t.role || "this one"}`, "Same kind of role, different employers. The work you put into this application carries over.", "/opportunities"],
      ["Write down one thing to try differently next time", "A stronger bullet, an earlier application, a referral. One change is enough.", "/resume?tab=base"],
    ];
    const have = new Set(w.tasks.map((x) => x.title));
    await save("tasks", [...steps.filter(([title]) => !have.has(title)).map(([title, why, link]) => ({ id: rid("t"), title, why, due: "", category: "Apply", done: false, source: "Recovery", link })), ...w.tasks]);
    return save("tracker", mark("added"));
  }, "Added 3 steps to your to-dos");
  return (
    <div className="remy-prompt" style={{ marginTop: 10 }} data-testid="recovery">
      <Remy size={32} mood="wave" />
      <div className="stack-sm grow">
        <p className="small"><b>Sorry, that's a tough one.</b> A no from {t.company} doesn't undo what you built for it. Want three small steps to turn it into your next application?</p>
        <div className="row">
          <button className="btn btn-primary btn-sm" onClick={add} data-testid="button-recovery-add">Add 3 steps</button>
          <button className="btn btn-ghost btn-sm" onClick={() => run(() => save("tracker", mark("dismissed")))} data-testid="button-recovery-dismiss">Not now</button>
        </div>
      </div>
    </div>
  );
}

/** An interview: get its date on the calendar (which turns Home into a prep plan) and point to the Story deck. */
function InterviewDate({ t }: { t: TrackItem }) {
  const { ws, save, run } = useStore();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const add = () => run(() => save("calendar", [...ws!.calendar, { id: rid("cal"), title: `Interview: ${t.company}${t.role ? ` (${t.role})` : ""}`, date, time, kind: "Interview" as const, source: "From your applications", linkedId: t.id, notes: "" }]), "Interview added. Home will show a prep plan as it gets close");
  return (
    <div className="remy-prompt" style={{ marginTop: 10 }} data-testid="interview-date">
      <Remy size={32} mood="happy" />
      <div className="stack-sm grow">
        <p className="small"><b>An interview with {t.company}!</b> When is it? Remy will turn Home into a prep plan the two days before.</p>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" type="date" style={{ width: "auto" }} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Interview date" data-testid="input-interview-date" />
          <input className="input" type="time" style={{ width: "auto" }} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Interview time" />
          <button className="btn btn-primary btn-sm" disabled={!date} onClick={add} data-testid="button-interview-add">Add to calendar</button>
          <button className="btn btn-ghost btn-sm" onClick={() => go("/resume?tab=prep")}>Build interview stories</button>
        </div>
      </div>
    </div>
  );
}

function Tracker() {
  const { ws, save, run, toast } = useStore();
  const w = ws!;
  const [open, setOpen] = useState("");
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ company: "", role: "" });
  const counts = ["Saved", "Applied", "Received", "Heard back", "Interview", "Offer", "Rejected", "No reply"].map((s) => [s, w.tracker.filter((t) => t.status === s).length] as const);
  const setStatus = (t: TrackItem, status: TrackStatus) =>
    run(() => save("tracker", w.tracker.map((x) => (x.id === t.id ? { ...x, status, events: [...x.events, { id: rid("ev"), at: new Date().toISOString(), status, source: "Manual correction" }] } : x))), `Marked ${status}`);
  const add = async () => {
    if (w.tracker.some((t) => t.company.trim().toLowerCase() === n.company.trim().toLowerCase() && t.role.trim().toLowerCase() === n.role.trim().toLowerCase()))
      return toast("You're already tracking that application.", true);
    await run(() => save("tracker", [{ id: rid("tr"), company: n.company, role: n.role, status: "Applied", notes: "", events: [{ id: rid("ev"), at: new Date().toISOString(), status: "Applied", source: "Manual" }] }, ...w.tracker]), "Tracking added");
    setAdding(false);
    setN({ company: "", role: "" });
  };
  return (
    <div className="stack">
      <div className="pipeline">{counts.map(([s, c]) => <div key={s} className="pipe"><span className="xs muted">{s}</span><strong>{c}</strong></div>)}</div>
      <ReplyRate />
      <div className="card card-pad">
        <div className="row-between" style={{ marginBottom: 8 }}><h3>Applications</h3><button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)} data-testid="button-add-tracking"><Plus size={14} /> Track an application</button></div>
        {w.tracker.length ? w.tracker.map((t) => (
          <div key={t.id} className="item" data-testid="row-tracker">
            <div className="item-main">
              <div className="row-between">
                <div><strong>{t.company}</strong><div className="why">{t.role}</div></div>
                <div className="row">
                  <select className="select" style={{ width: 140 }} value={t.status} onChange={(e) => setStatus(t, e.target.value as TrackStatus)} aria-label="Status" data-testid="select-track-status">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                  <button className="icon-btn" onClick={() => setOpen(open === t.id ? "" : t.id)} aria-label="Timeline">{open === t.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
                </div>
              </div>
              {t.status === "Rejected" && !t.recovery && <Recovery t={t} />}
              {t.status === "Interview" && !w.calendar.some((c) => c.linkedId === t.id) && <InterviewDate t={t} />}
              {open === t.id && (
                <div className="stack-sm" style={{ marginTop: 10 }}>
                  {t.events.map((e) => (
                    <div key={e.id} className="small" style={{ borderLeft: "2px solid var(--lav)", paddingLeft: 10 }}>
                      <strong>{e.status}</strong> <span className="muted">· {new Date(e.at).toLocaleString()} · {e.source.split(" · ")[0]}</span>
                      {e.evidence && <div className="quote" style={{ marginTop: 4 }}>“{e.evidence}”</div>}
                    </div>
                  ))}
                  <textarea className="textarea" style={{ minHeight: 60 }} defaultValue={t.notes} placeholder="Notes" onBlur={(e) => e.target.value !== t.notes && save("tracker", w.tracker.map((x) => (x.id === t.id ? { ...x, notes: e.target.value } : x)))} aria-label="Notes" />
                  <div className="row">
                    {t.applicationId && <button className="btn btn-ghost btn-sm" onClick={() => go(`/resume?tab=tailor&app=${t.applicationId}`)}>Open materials</button>}
                    <button className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={() => run(() => save("tracker", w.tracker.filter((x) => x.id !== t.id)), "Removed")}><Trash2 size={14} /> Stop tracking</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )) : <Empty title="Nothing tracked yet" body="Approving tailored materials adds the opening here automatically. You can also add applications by hand." />}
      </div>
      {adding && (
        <Modal title="Track an application" onClose={() => setAdding(false)}>
          <label className="field"><span>Company</span><input className="input" value={n.company} onChange={(e) => setN({ ...n, company: e.target.value })} data-testid="input-track-company" /></label>
          <label className="field"><span>Role</span><input className="input" value={n.role} onChange={(e) => setN({ ...n, role: e.target.value })} data-testid="input-track-role" /></label>
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" disabled={!n.company.trim()} onClick={add} data-testid="button-save-tracking">Save</button></div>
        </Modal>
      )}
    </div>
  );
}

function highlight(body: string, quote: string) {
  if (!quote) return body;
  const i = body.indexOf(quote);
  if (i < 0) return body;
  return <>{body.slice(0, i)}<mark>{quote}</mark>{body.slice(i + quote.length)}</>;
}

function EmailUpdates() {
  const { ws, setWs, run } = useStore();
  const w = ws!;
  const [busy, setBusy] = useState("");
  const [paste, setPaste] = useState(false);
  const [m, setM] = useState({ from: "", subject: "", body: "" });
  const classify = async (id: string) => {
    setBusy(id);
    const r = await run(() => api<{ workspace: Workspace }>("POST", `/api/inbox/${id}/classify`));
    if (r) setWs(r.workspace);
    setBusy("");
  };
  const submitPaste = async () => {
    const r = await run(() => api<Workspace>("POST", "/api/inbox/paste", m), "Email added");
    if (r) { setWs(r); setPaste(false); setM({ from: "", subject: "", body: "" }); }
  };
  return (
    <div className="stack">
      <div className="notice small"><StatusChip label="Needs setup">Inbox: coming soon</StatusChip><div>Remy doesn't read your inbox. Paste a recruiting email and Remy suggests a status update. Nothing changes until you confirm.</div></div>
      <div className="row">
        <button className="btn btn-primary btn-sm" onClick={() => setPaste(true)} data-testid="button-paste-email"><Mail size={14} /> Paste an email</button>
      </div>
      {w.inbox.length ? w.inbox.map((msg) => {
        const s = w.suggestions.find((x) => x.messageId === msg.id && x.state !== "dismissed");
        return (
          <div key={msg.id} className="card card-pad stack-sm" data-testid="card-email">
            <div className="row-between"><div><strong className="small">{msg.subject}</strong><div className="xs muted">{msg.from} · {fmtDate(msg.date)}</div></div><span className={"chip " + (msg.label === "Sample email" ? "chip-demo" : "chip-student")}>{msg.label}</span></div>
            <p className="small" style={{ whiteSpace: "pre-wrap" }}>{s ? highlight(msg.body, s.evidence) : msg.body}</p>
            {!s && <div><button className="btn btn-secondary btn-sm" onClick={() => classify(msg.id)} disabled={!!busy} data-testid="button-classify">{busy === msg.id ? <Spinner /> : <Wand2 size={14} />} Suggest a status</button></div>}
            {s && <SuggestionBox s={s} />}
          </div>
        );
      }) : <div className="card"><Empty title="No emails yet" body="Paste a recruiting email or load the samples." /></div>}
      {paste && (
        <Modal title="Paste a recruiting email" onClose={() => setPaste(false)}>
          <label className="field"><span>From</span><input className="input" value={m.from} onChange={(e) => setM({ ...m, from: e.target.value })} placeholder="recruiting@company.com" /></label>
          <label className="field"><span>Subject</span><input className="input" value={m.subject} onChange={(e) => setM({ ...m, subject: e.target.value })} /></label>
          <label className="field"><span>Email text</span><textarea className="textarea" style={{ minHeight: 180 }} value={m.body} onChange={(e) => setM({ ...m, body: e.target.value })} data-testid="input-email-body" /></label>
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" disabled={m.body.length < 30} onClick={submitPaste} data-testid="button-submit-email">Add email</button></div>
        </Modal>
      )}
    </div>
  );
}

function SuggestionBox({ s }: { s: Suggestion }) {
  const { ws, setWs, run } = useStore();
  const w = ws!;
  const [status, setStatus] = useState<TrackStatus>(s.proposed);
  const [trackId, setTrackId] = useState(s.trackId || "");
  const [company, setCompany] = useState(s.company);
  const resolve = async (action: "apply" | "dismiss") => {
    const r = await run(() => api<Workspace>("POST", `/api/suggestions/${s.id}/resolve`, { action, status, trackId: trackId || undefined, company, role: s.role }), action === "apply" ? "Status updated with evidence" : "Dismissed");
    if (r) setWs(r);
  };
  if (s.state === "applied") {
    const t = w.tracker.find((x) => x.id === s.trackId);
    return <div className="notice notice-good small"><Check size={16} /><div>Applied: <strong>{t?.company}</strong> marked <strong>{t?.events.find((e) => e.evidence === s.evidence)?.status || status}</strong>. The quoted sentence is saved as evidence.</div></div>;
  }
  const unclear = s.rulesSay === "Unclear" && (!s.aiSays || s.aiSays === "Unclear");
  return (
    <div className="card card-pad stack-sm" style={{ background: "var(--lav-2)", boxShadow: "none" }} data-testid="suggestion">
      <div className="row-between">
        <strong className="small">{unclear ? "This email doesn't clearly change your status" : `Suggested status: ${s.proposed}`}</strong>
        <span className={"chip " + (s.confidence === "high" ? "chip-live" : s.confidence === "medium" ? "chip-setup" : "chip-bad")}>{s.confidence} confidence</span>
      </div>
      <span className="xs muted">Rules: {s.rulesSay} · AI: {s.aiSays || "not used"}{s.evidence ? " · evidence highlighted above" : " · no decisive sentence found"}</span>
      {STATUS_HELP[status] && <span className="xs">{STATUS_HELP[status]}</span>}
      <div className="grid-3">
        <label className="field"><span className="xs">Apply to</span>
          <select className="select" value={trackId} onChange={(e) => setTrackId(e.target.value)} data-testid="select-suggestion-track">
            <option value="">New / match by company</option>
            {w.tracker.map((t) => <option key={t.id} value={t.id}>{t.company} — {t.role}</option>)}
          </select></label>
        {!trackId && <label className="field"><span className="xs">Company</span><input className="input" value={company} onChange={(e) => setCompany(e.target.value)} /></label>}
        <label className="field"><span className="xs">Status</span><select className="select" value={status} onChange={(e) => setStatus(e.target.value as TrackStatus)} data-testid="select-suggestion-status">{STATUSES.map((x) => <option key={x}>{x}</option>)}</select></label>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => resolve("dismiss")} data-testid="button-dismiss-suggestion">Dismiss</button>
        <button className="btn btn-primary btn-sm" onClick={() => resolve("apply")} data-testid="button-apply-suggestion">Confirm update</button>
      </div>
    </div>
  );
}

function Todos() {
  const { ws, save, run, setWs } = useStore();
  const w = ws!;
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const add = () => run(() => save("tasks", [{ id: rid("t"), title, why: "Added by you", due, category: "Prepare", done: false, source: "Added by you" } as Task, ...w.tasks]), "To-do added").then(() => { setTitle(""); setDue(""); });
  const { isFading, mark } = useCompleting();
  const [showDone, setShowDone] = useState(false);
  const doneCount = w.tasks.filter((t) => t.done && !isFading(t.id)).length;
  const sorted = [...w.tasks].filter((t) => !t.done || isFading(t.id) || showDone).sort((a, b) => Number(a.done && !isFading(a.id)) - Number(b.done && !isFading(b.id)) || (a.due || "9999").localeCompare(b.due || "9999"));
  return (
    <div className="card card-pad stack">
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (title.trim()) add(); }}>
        <input className="input" style={{ flex: 1, minWidth: 180 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a to-do" aria-label="New to-do" data-testid="input-new-todo" />
        <input className="input" style={{ width: 160 }} type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        <button className="btn btn-primary" disabled={!title.trim()} data-testid="button-add-todo"><Plus size={16} /> Add</button>
      </form>
      {sorted.length ? sorted.map((t) => (
        <div key={t.id} className={"item" + (t.done && isFading(t.id) ? " completing" : "")} data-testid="row-todo">
          <button className="check" role="checkbox" aria-checked={t.done} onClick={() => { if (!t.done) mark(t.id); run(() => api<Workspace>("PATCH", `/api/tasks/${t.id}`, { done: !t.done }).then(setWs)); }} aria-label="Toggle done">{t.done && <Check size={13} />}</button>
          <div className="item-main"><strong className="small" style={{ textDecoration: t.done ? "line-through" : undefined }}>{t.title}</strong><div className="why">{t.why} · <span className="faint">{t.source}</span></div></div>
          {t.due && <span className="chip chip-plain">{fmtDate(t.due)}</span>}
          <button className="icon-btn" onClick={() => save("tasks", w.tasks.filter((x) => x.id !== t.id))} aria-label="Delete to-do"><Trash2 size={15} /></button>
        </div>
      )) : <Empty title={doneCount ? "All caught up" : "No to-dos"} body={doneCount ? "Everything on your list is done." : "Add one above, or build your path to get suggestions."} />}
      {doneCount > 0 && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setShowDone((v) => !v)} data-testid="button-show-done">{showDone ? "Hide" : "Show"} completed ({doneCount})</button>}
    </div>
  );
}

// ---------------------------------------------------------------- hours
const ACTIVITIES = ["Volunteering", "Shadowing", "Clinical hours", "Research", "Work shifts", "Club or leadership", "Tutoring", "Apprenticeship hours"];

/** A simple hours log: what pre-health, volunteer and apprenticeship students are asked to total up. */
function Hours() {
  const { ws, save, run } = useStore();
  const list = [...(ws!.hours || [])].sort((a, b) => b.date.localeCompare(a.date));
  const [activity, setActivity] = useState("");
  const [hours, setHours] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [note, setNote] = useState("");
  const n = parseFloat(hours);
  const ok = activity.trim() && n > 0 && n <= 24 && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const add = () => run(async () => {
    const e: HoursEntry = { id: rid("h"), activity: activity.trim(), hours: Math.round(n * 4) / 4, date, ...(note.trim() ? { note: note.trim() } : {}) };
    await save("hours", [e, ...(ws!.hours || [])]);
    setHours(""); setNote("");
  }, "Hours logged");
  const remove = (id: string) => run(() => save("hours", (ws!.hours || []).filter((h) => h.id !== id)));
  const totals = [...list.reduce((m, h) => m.set(h.activity, (m.get(h.activity) || 0) + h.hours), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0$/, ""));
  return (
    <div className="stack">
      <div className="card card-pad stack-sm">
        <h3>Log hours</h3>
        <span className="small muted">Volunteering, shadowing, clinical, research or shifts: many programs and applications ask for totals, so keep them as you go.</span>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="field" style={{ minWidth: 200 }}><span className="xs muted">Activity</span><input className="input" list="hour-activities" value={activity} onChange={(e) => setActivity(e.target.value)} placeholder="e.g. Shadowing" data-testid="input-hours-activity" /></label>
          <datalist id="hour-activities">{[...new Set([...totals.map(([a]) => a), ...ACTIVITIES])].map((a) => <option key={a} value={a} />)}</datalist>
          <label className="field" style={{ width: 90 }}><span className="xs muted">Hours</span><input className="input" type="number" min="0.25" max="24" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} data-testid="input-hours-amount" /></label>
          <label className="field" style={{ width: 160 }}><span className="xs muted">Date</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-hours-date" /></label>
          <label className="field grow" style={{ minWidth: 180 }}><span className="xs muted">Note (optional)</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Dr. Lee, cardiology clinic" /></label>
          <button className="btn btn-primary" disabled={!ok} onClick={add} data-testid="button-add-hours"><Plus size={16} /> Add</button>
        </div>
      </div>
      {list.length ? (
        <>
          <div className="card card-pad stack-sm" data-testid="hours-totals">
            <h3>Totals</h3>
            {totals.map(([a, t]) => <div key={a} className="row-between small"><span>{a}</span><strong>{fmt(t)} h</strong></div>)}
          </div>
          <div className="card card-pad stack-sm">
            <h3>Log</h3>
            {list.map((h) => (
              <div key={h.id} className="row-between small" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <span>{fmtDate(h.date)} · {h.activity} · <strong>{fmt(h.hours)} h</strong>{h.note ? <span className="muted"> · {h.note}</span> : null}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(h.id)} aria-label={`Delete ${h.activity} on ${h.date}`}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </>
      ) : <div className="card"><Empty title="No hours yet" body="Add your first entry above. Totals per activity add up here." /></div>}
    </div>
  );
}
