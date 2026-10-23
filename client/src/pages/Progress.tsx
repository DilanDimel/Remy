import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Inbox, Mail, Plus, Trash2, Wand2 } from "lucide-react";
import type { Suggestion, Task, TrackItem, TrackStatus, Workspace } from "@shared/types";
import { api, fmtDate, rid, useStore } from "../lib/store";
import { useCompleting } from "../lib/completing";
import { go, useRoute } from "../lib/router";
import { Empty, Modal, Spinner, StatusChip } from "../components/common";

const STATUSES: TrackStatus[] = ["Saved", "Applied", "Received", "Interview", "Offer", "Rejected", "Withdrawn"];
const STATUS_HELP: Record<string, string> = {
  Received: "Application receipt — the employer confirmed they got it. Not an interview.",
  Interview: "An interview invitation — not an offer.",
  Offer: "A written offer of employment or internship.",
};
type Tab = "tracker" | "email" | "todos";

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
          <p>Track every application, turn recruiting emails into reviewed status updates, and keep your to-dos honest.</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {([["tracker", "Applications"], ["email", `Email updates${open ? ` (${open})` : ""}`], ["todos", "To-dos"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(`/progress?tab=${k}`)} data-testid={`tab-progress-${k}`}>{l}</button>
        ))}
      </div>
      {tab === "tracker" && <Tracker />}
      {tab === "email" && <EmailUpdates />}
      {tab === "todos" && <Todos />}
    </>
  );
}

function Tracker() {
  const { ws, save, run, toast } = useStore();
  const w = ws!;
  const [open, setOpen] = useState("");
  const [adding, setAdding] = useState(false);
  const [n, setN] = useState({ company: "", role: "" });
  const counts = ["Saved", "Applied", "Received", "Interview", "Offer", "Rejected"].map((s) => [s, w.tracker.filter((t) => t.status === s).length] as const);
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
  const loadSample = async () => { const r = await run(() => api<Workspace>("POST", "/api/inbox/sample"), "Sample emails loaded"); if (r) setWs(r); };
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
      <div className="notice small"><StatusChip label="Needs setup">Inbox connection</StatusChip><div>Remy doesn't read your inbox. Paste a recruiting email, or load <strong>sample emails</strong> (clearly labeled, not from real employers) to see how status suggestions work. Nothing changes until you confirm.</div></div>
      <div className="row">
        <button className="btn btn-primary btn-sm" onClick={() => setPaste(true)} data-testid="button-paste-email"><Mail size={14} /> Paste an email</button>
        {!w.inbox.some((x) => x.label === "Sample email") && <button className="btn btn-secondary btn-sm" onClick={loadSample} data-testid="button-sample-emails"><Inbox size={14} /> Load sample emails</button>}
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
