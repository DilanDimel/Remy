import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Inbox, Mail, Plus, Trash2, Wand2 } from "lucide-react";
import type { HoursEntry, Job, Suggestion, Task, TrackItem, TrackStatus, Workspace } from "@shared/types";
import { api, fmtDate, rid, useOwnerView, useStore } from "../lib/store";
import { useJobs } from "../lib/jobs";
import { useCompleting } from "../lib/completing";
import { go, useRoute } from "../lib/router";
import { Empty, Modal, Remy, Spinner, StatusChip } from "../components/common";
import { MIN_FOR_RATE, keptUntracked, replyStats } from "@shared/progress";
import { OrgLogo } from "../components/OrgLogo";

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
  const owner = useOwnerView(); // tabs redesign (Nov 22), owners first
  const open = ws!.suggestions.filter((s) => s.state === "open").length;
  const { jobs, fits } = useJobs();
  const kept = owner ? keptUntracked(ws!, jobs || []) : [];
  // Nothing tracked or kept yet: the board offers two openings to start from (Nov 23 review: half the page was empty).
  const start = owner && !ws!.tracker.length && !kept.length ? (jobs || [])
    .filter((j) => { const f = fits[j.id]; return !!f && !f.excluded && !f.closed && f.regionMatch !== false && f.eligibility !== "unlikely" && j.kind !== "event" && !ws!.hiddenJobIds.includes(j.id); })
    .sort((a, b) => (fits[b.id]?.score || 0) - (fits[a.id]?.score || 0)).slice(0, 2) : []; // same pick as Home's main card
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Progress</span>
          <h1><span className="title-slogan">Follow through, without the spreadsheet.</span><span className="title-plain">Progress</span></h1>
          {owner ? <ProgressLine w={ws!} kept={kept} /> : <p className="hide-phone">Track every application, turn recruiting emails into reviewed status updates, and keep your to-dos honest.</p>}
        </div>
      </div>
      <div className="tabs" role="tablist">
        {([["tracker", "Applications"], ["email", `Email updates${open ? ` (${open})` : ""}`], ["todos", "To-dos"], ["hours", "Hours"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(`/progress?tab=${k}`)} data-testid={`tab-progress-${k}`}>{l}</button>
        ))}
      </div>
      {tab === "tracker" && <Tracker kept={kept} start={start} />}
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
          <button className="btn btn-ghost btn-sm" onClick={() => go("/interview")}>Build interview stories</button>
        </div>
      </div>
    </div>
  );
}

function Tracker({ kept, start }: { kept: Job[]; start: Job[] }) {
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
  const owner = useOwnerView();
  const [details, setDetails] = useState(false); // owners: the full list stays folded so the page fits on one screen
  const openRow = (id: string) => { setOpen(id); setDetails(true); setTimeout(() => document.getElementById("tr-" + id)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50); };
  return (
    <div className="stack">
      {owner ? <Board w={w} kept={kept} start={start} onOpen={openRow} onAdd={() => setAdding(true)} /> : <div className="pipeline">{counts.map(([s, c]) => <div key={s} className="pipe"><span className="xs muted">{s}</span><strong>{c}</strong></div>)}</div>}
      {owner && <NextUp w={w} />}
      <ReplyRate />
      {/* Owners: "Details and notes · Show all 0" was a dead row with nothing tracked yet (Nov 23 PM review). */}
      {(!owner || w.tracker.length > 0) && <div className="card card-pad">
        <div className="row-between" style={{ marginBottom: owner && !details ? 0 : 8 }}><h3>{owner ? "Details and notes" : "Applications"}</h3>
          {owner ? <button className="btn btn-ghost btn-sm" onClick={() => setDetails(!details)} aria-expanded={details} data-testid="button-toggle-details">{details ? "Hide" : `Show all ${w.tracker.length}`}</button>
            : <button className="btn btn-secondary btn-sm" onClick={() => setAdding(true)} data-testid="button-add-tracking"><Plus size={14} /> Track an application</button>}</div>
        {owner && !details ? null : w.tracker.length ? w.tracker.map((t) => (
          <div key={t.id} id={"tr-" + t.id} className="item" data-testid="row-tracker">
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
      </div>}
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

// Owners (tabs redesign, Nov 22): the tracker as lanes, Remy's line from real counts, and what's next from email and to-dos.
const LANES: [string, TrackStatus[], string][] = [["Saved", ["Saved"], "a"], ["Applied", ["Applied", "Received"], "b"], ["Heard back", ["Heard back"], "c"], ["Interview", ["Interview"], "d"], ["Offer", ["Offer"], ""]];
const lastAt = (t: TrackItem) => t.events[t.events.length - 1]?.at || "";
const daysSince = (iso: string) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 864e5) : 0);
/** An application sent more than a week ago with no news since: worth a short follow-up. */
const quiet = (t: TrackItem) => (t.status === "Applied" || t.status === "Received") && daysSince(lastAt(t)) >= 7;

function ProgressLine({ w, kept }: { w: Workspace; kept: Job[] }) {
  const sent = w.tracker.filter((t) => !["Saved", "Withdrawn"].includes(t.status));
  const replies = w.tracker.filter((t) => ["Heard back", "Interview", "Offer", "Rejected"].includes(t.status)).length;
  const q = w.tracker.filter(quiet).sort((a, b) => lastAt(a).localeCompare(lastAt(b)))[0];
  if (!w.tracker.length && kept.length) return <p className="op-say" data-testid="progress-line"><b>{kept.length} opening{kept.length === 1 ? "" : "s"} saved, none applied yet.</b> Tailor one and apply, and Remy tracks it from there.</p>;
  if (!w.tracker.length) return <p className="op-say"><b>Nothing tracked yet.</b> Approve tailored materials and Remy adds the opening here.</p>;
  return (
    <p className="op-say" data-testid="progress-line">
      <b>{sent.length} application{sent.length === 1 ? "" : "s"} out, {replies} {replies === 1 ? "reply" : "replies"} in.</b>
      {q ? ` ${q.company} hasn't answered in ${daysSince(lastAt(q))} days, so a short follow-up is worth it.` : ""}
    </p>
  );
}

const LANE_MAX = 3; // a lane shows its newest few; the rest open on tap, so the board fits on one screen
function Board({ w, kept, start, onOpen, onAdd }: { w: Workspace; kept: Job[]; start: Job[]; onOpen: (id: string) => void; onAdd: () => void }) {
  const [more, setMore] = useState<string[]>([]);
  const closed = w.tracker.filter((t) => ["Rejected", "No reply", "Withdrawn"].includes(t.status));
  return (
    <>
      {/* Lane headers carry the counts, so the count tiles are gone: one screen, no scrolling (Dilan, Nov 22). */}
      <div className="op-card" data-testid="progress-board">
        <div className="op-ch"><h3>Your applications</h3><span className="row" style={{ gap: 8 }}><span className="xs muted hide-phone">{closed.length ? `${closed.length} closed · ` : ""}Tap one for its timeline</span><button className="btn btn-secondary btn-sm" onClick={onAdd} data-testid="button-add-tracking"><Plus size={14} /> Track one</button></span></div>
        <div className="pr-flow">{LANES.map(([l, st]) => {
          const items = w.tracker.filter((t) => st.includes(t.status));
          const cards = [
            ...items.map((t) => (
              <button key={t.id} className={"pr-mini" + (quiet(t) ? " hot" : "")} onClick={() => onOpen(t.id)} data-testid="button-board-card">
                <OrgLogo company={t.company} />
                <span className="pr-mini-t"><b>{t.role || t.company}</b><small>{t.company}{quiet(t) ? ` · ${daysSince(lastAt(t))} days, no reply` : t.status === "Received" ? " · received" : ""}</small></span>
              </button>
            )),
            ...(l === "Saved" ? kept.map((j) => (
              <button key={j.id} className="pr-mini" onClick={() => go(`/opportunities?id=${j.id}`)} data-testid="button-board-kept">
                <OrgLogo company={j.company} url={j.applyUrl} />
                <span className="pr-mini-t"><b>{j.title}</b><small>{j.company} · kept</small></span>
              </button>
            )) : []),
          ];
          const all = more.includes(l), hidden = cards.length - LANE_MAX;
          return (
          <div key={l} className="pr-lane"><h4>{l} <em>{cards.length}</em></h4>
            {all ? cards : cards.slice(0, LANE_MAX)}
            {hidden > 0 && <button className="pr-more" onClick={() => setMore(all ? more.filter((x) => x !== l) : [...more, l])} aria-expanded={all} data-testid="button-lane-more">{all ? "Show fewer" : `+${hidden} more`}</button>}
            {!cards.length && <span className="pr-ghost">{l === "Interview" ? "Your first one lands here. Interview has you ready." : l === "Offer" ? "Waits here" : "None yet"}</span>}
          </div>
        ); })}</div>
        {start.length > 0 && (
          <div className="pr-start" data-testid="progress-start">
            <p className="small"><b>Start here.</b> Tailor your resume for one of these and it moves along the board as you go.</p>
            {start.map((j) => (
              <div key={j.id} className="pr-start-row">
                <OrgLogo company={j.company} url={j.applyUrl} />
                <span className="pr-mini-t"><b>{j.title}</b><small>{j.company}</small></span>
                <button className="btn btn-ghost btn-sm" onClick={() => go(`/opportunities?id=${j.id}`)} data-testid="button-start-see">See it</button>
                <button className="btn btn-primary btn-sm" onClick={() => go(`/resume?tab=tailor&job=${j.id}&go=1`)} data-testid="button-start-tailor">Tailor resume</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function NextUp({ w }: { w: Workspace }) {
  const mail = w.suggestions.filter((s) => s.state === "open").slice(0, 3);
  // Nov 23 PM review: with no email waiting the left card was empty text and the page ended half way, so it offers
  // the paste box instead, and Next up shows five to-dos.
  const todos = w.tasks.filter((t) => !t.done).slice(0, 5);
  return (
    <div className="pr-cols">
      <div className="op-card">
        <div className="op-ch"><h3>From your email</h3><span className="xs muted">You confirm every change</span></div>
        {mail.length ? <ul className="op-dl">{mail.map((m) => (
          <li key={m.id}><OrgLogo company={m.company} />
            <button onClick={() => go("/progress?tab=email")}><strong>{m.company}{m.role ? `: ${m.role}` : ""}</strong><span>Looks like {m.proposed} · review it</span></button></li>
        ))}</ul> : <div className="stack-sm"><p className="small muted" style={{ margin: 0 }}>Got an interview invite, an offer or a rejection? Paste it and Remy moves the application along. Nothing changes until you confirm.</p>
          <button className="btn btn-secondary btn-sm" style={{ justifySelf: "start" }} onClick={() => go("/progress?tab=email&paste=1")} data-testid="button-progress-paste"><Mail size={14} /> Paste an email</button></div>}
      </div>
      <div className="op-card">
        <div className="op-ch"><h3>Next up</h3><button className="op-link" onClick={() => go("/progress?tab=todos")} data-testid="button-progress-todos">All to-dos →</button></div>
        {todos.length ? <ul className="pr-todo">{todos.map((t) => <li key={t.id}><i />{t.title}{t.due && <em>{fmtDate(t.due)}</em>}</li>)}</ul> : <p className="small muted">No open to-dos.</p>}
      </div>
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
  const owner = useOwnerView();
  const w = ws!;
  const [busy, setBusy] = useState("");
  // Calendar's "Paste an interview invite" and Remy's links open the paste box straight away (?paste=1).
  const [paste, setPasteRaw] = useState(() => new URLSearchParams(location.search).get("paste") === "1");
  const setPaste = (open: boolean) => {
    setPasteRaw(open);
    if (!open && location.search.includes("paste=1")) history.replaceState(history.state, "", location.pathname + location.search.replace(/[&?]paste=1/, "").replace(/^&/, "?"));
  };
  const [reading, setReading] = useState(false);
  const [m, setM] = useState({ from: "", subject: "", body: "" });
  const classify = async (id: string) => {
    setBusy(id);
    const r = await run(() => api<{ workspace: Workspace }>("POST", `/api/inbox/${id}/classify`));
    if (r) setWs(r.workspace);
    setBusy("");
  };
  // One step (Dilan, Nov 19: nobody will paste emails as a chore, but an interview invite is worth it): paste, and Remy
  // reads it right away and shows what it would update. Nothing changes until the student confirms.
  const submitPaste = async () => {
    if (reading) return;
    setReading(true);
    const r = await run(() => api<Workspace>("POST", "/api/inbox/paste", m));
    if (r) { setWs(r); setPaste(false); setM({ from: "", subject: "", body: "" }); if (r.inbox[0]) await classify(r.inbox[0].id); }
    setReading(false);
  };
  return (
    <div className="stack">
      {owner ? (
        <section className="op-pick op-quiet" data-testid="email-hero">
          <div className="stack-sm">
            <span className="op-kick">Email updates</span>
            <b className="iv-q-t">Got an interview invite, an offer or a rejection?</b>
            <span className="small muted">Paste it and Remy updates your tracker, and puts an interview on your calendar with prep steps. Nothing changes until you confirm. Remy doesn't read your inbox.</span>
          </div>
          <button className="btn btn-primary" onClick={() => setPaste(true)} data-testid="button-paste-email"><Mail size={16} /> Paste an email</button>
        </section>
      ) : <>
      <div className="notice small"><Mail size={16} style={{ marginTop: 2 }} /><div><b>Got an interview invite, an offer or a rejection?</b> Paste it and Remy updates your tracker, and puts an interview on your calendar with prep steps. Nothing changes until you confirm. (Remy doesn't read your inbox.)</div></div>
      <div className="row">
        <button className="btn btn-primary btn-sm" onClick={() => setPaste(true)} data-testid="button-paste-email"><Mail size={14} /> Paste an email</button>
      </div></>}
      {w.inbox.length ? w.inbox.map((msg) => {
        const s = w.suggestions.find((x) => x.messageId === msg.id && x.state !== "dismissed");
        return (
          <div key={msg.id} className={owner ? "op-card stack-sm" : "card card-pad stack-sm"} data-testid="card-email">
            <div className="row-between"><div><strong className="small">{msg.subject}</strong><div className="xs muted">{msg.from} · {fmtDate(msg.date)}</div></div><span className={"chip " + (msg.label === "Sample email" ? "chip-demo" : "chip-student")}>{msg.label}</span></div>
            <p className="small" style={{ whiteSpace: "pre-wrap" }}>{s ? highlight(msg.body, s.evidence) : msg.body}</p>
            {!s && <div><button className="btn btn-secondary btn-sm" onClick={() => classify(msg.id)} disabled={!!busy} data-testid="button-classify">{busy === msg.id ? <Spinner /> : <Wand2 size={14} />} Suggest a status</button></div>}
            {s && <SuggestionBox s={s} />}
          </div>
        );
      }) : <div className={owner ? "op-card" : "card"}><Empty title="No emails yet" body="Paste a recruiting email (an interview invite, a rejection, a “we received your application”) and Remy suggests the status. Nothing changes until you confirm." /></div>}
      {paste && (
        <Modal title="Paste the email" onClose={() => setPaste(false)}>
          <label className="field"><span>Copy the whole email (sender and subject too, if you can) and paste it here</span><textarea className="textarea" style={{ minHeight: 200 }} value={m.body} onChange={(e) => setM({ ...m, body: e.target.value })} placeholder={"From: recruiting@frostbank.com\nSubject: Interview invitation\n\nHi Chris, we'd like to invite you to…"} autoFocus data-testid="input-email-body" /></label>
          <details className="small"><summary style={{ cursor: "pointer" }}>Sender or subject didn't copy? Add them (optional)</summary>
            <div className="grid-2" style={{ marginTop: 8 }}>
              <label className="field"><span>From</span><input className="input" value={m.from} onChange={(e) => setM({ ...m, from: e.target.value })} placeholder="recruiting@company.com" /></label>
              <label className="field"><span>Subject</span><input className="input" value={m.subject} onChange={(e) => setM({ ...m, subject: e.target.value })} /></label>
            </div>
          </details>
          <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn btn-primary" disabled={reading || m.body.trim().length < 30} onClick={submitPaste} data-testid="button-submit-email">{reading ? <Spinner /> : <Wand2 size={14} />} Read it</button></div>
        </Modal>
      )}
    </div>
  );
}

function SuggestionBox({ s }: { s: Suggestion }) {
  const { ws, setWs, run } = useStore();
  const owner = useOwnerView();
  const w = ws!;
  const [status, setStatus] = useState<TrackStatus>(s.proposed);
  const [trackId, setTrackId] = useState(s.trackId || "");
  const [company, setCompany] = useState(s.company);
  const [date, setDate] = useState(s.date || "");
  // A time in another zone ("2 PM ET" for a Central student) isn't filled in as theirs: they enter it in their own time.
  const ownZone = zoneName(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const otherZone = !!s.zone && s.zone !== ownZone;
  const [time, setTime] = useState(otherZone ? "" : s.time || "");
  const moved = w.calendar.find((c) => c.kind === "Interview" && c.linkedId === (trackId || s.trackId) && c.source === "From an email you confirmed" && c.date >= new Date().toLocaleDateString("en-CA") && c.date !== date);
  const resolve = async (action: "apply" | "dismiss") => {
    const r = await run(() => api<Workspace>("POST", `/api/suggestions/${s.id}/resolve`, { action, status, trackId: trackId || undefined, company, role: s.role, ...(status === "Interview" ? { date, time } : {}) }), action === "apply" ? (status === "Interview" && date ? "Updated, and the interview is on your calendar" : "Status updated with evidence") : "Dismissed");
    if (r) setWs(r);
  };
  if (s.state === "applied") {
    const t = w.tracker.find((x) => x.id === s.trackId);
    return <div className="notice notice-good small"><Check size={16} /><div>Applied: <strong>{t?.company}</strong> marked <strong>{t?.events.find((e) => e.evidence === s.evidence)?.status || status}</strong>. The quoted sentence is saved as evidence.</div></div>;
  }
  const unclear = s.rulesSay === "Unclear" && (!s.aiSays || s.aiSays === "Unclear");
  return (
    <div className={owner ? "op-card op-accent stack-sm" : "card card-pad stack-sm"} style={owner ? undefined : { background: "var(--lav-2)", boxShadow: "none" }} data-testid="suggestion">
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
      {status === "Interview" && (
        <div className="stack-sm" data-testid="suggestion-interview-date">
          <div className="grid-3">
            <label className="field"><span className="xs">Interview date</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-interview-date" /></label>
            <label className="field"><span className="xs">Time (optional)</span><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          </div>
          <span className="xs muted">{s.dateQuote ? <>From the email: “{s.dateQuote}”. Check it before you confirm.</> : "The email didn't give one date. Add it once you've picked a time, and Remy puts it on your calendar."}</span>
          {otherZone && <span className="xs" data-testid="interview-zone-note">The email gives the time in {s.zone} time. Enter it in your own time so you're not early or late.</span>}
          {moved && date && <span className="xs" data-testid="interview-moved-note">This replaces the interview on {fmtDate(moved.date)} on your calendar.</span>}
        </div>
      )}
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
  const add = () => run(() => save("tasks", [{ id: rid("t"), title, why: "", due, category: "Prepare", done: false, source: "Added by you" } as Task, ...w.tasks]), "To-do added").then(() => { setTitle(""); setDue(""); });
  const { isFading, mark } = useCompleting();
  const [showDone, setShowDone] = useState(false);
  const doneCount = w.tasks.filter((t) => t.done && !isFading(t.id)).length;
  const sorted = [...w.tasks].filter((t) => !t.done || isFading(t.id) || showDone).sort((a, b) => Number(a.done && !isFading(a.id)) - Number(b.done && !isFading(b.id)) || (a.due || "9999").localeCompare(b.due || "9999"));
  const owner = useOwnerView();
  const today = new Date().toLocaleDateString("en-CA"), week = new Date(Date.now() + 6 * 864e5).toLocaleDateString("en-CA");
  const open = w.tasks.filter((t) => !t.done);
  const list = (
    <div className={owner ? "op-card stack" : "card card-pad stack"}>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (title.trim()) add(); }}>
        <input className="input" style={{ flex: 1, minWidth: 180 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a to-do" aria-label="New to-do" data-testid="input-new-todo" />
        <input className="input" style={{ width: 160 }} type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        <button className="btn btn-primary" disabled={!title.trim()} data-testid="button-add-todo"><Plus size={16} /> Add</button>
      </form>
      {sorted.length ? sorted.map((t) => (
        <div key={t.id} className={"item todo-row" + (t.done && isFading(t.id) ? " completing" : "")} data-testid="row-todo">
          <button className="check" role="checkbox" aria-checked={t.done} onClick={() => { if (!t.done) mark(t.id); run(() => api<Workspace>("PATCH", `/api/tasks/${t.id}`, { done: !t.done }).then(setWs)); }} aria-label="Toggle done">{t.done && <Check size={13} />}</button>
          <div className="item-main"><strong className="small" style={{ textDecoration: t.done ? "line-through" : undefined }}>{t.title}</strong><div className="why">{t.why ? <>{t.why} · </> : null}<span className="faint">{t.source}</span></div></div>
          {t.due && <span className="chip chip-plain">{fmtDate(t.due)}</span>}
          <button className="icon-btn" onClick={() => save("tasks", w.tasks.filter((x) => x.id !== t.id))} aria-label="Delete to-do"><Trash2 size={15} /></button>
        </div>
      )) : <Empty title={doneCount ? "All caught up" : "No to-dos"} body={doneCount ? "Everything on your list is done." : "Add one above, or build your path to get suggestions."} />}
      {doneCount > 0 && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setShowDone((v) => !v)} data-testid="button-show-done">{showDone ? "Hide" : "Show"} completed ({doneCount})</button>}
    </div>
  );
  if (!owner) return list;
  // Owners (Dilan Nov 22: the other Progress tabs should match Applications): count tiles above the same list.
  return (
    <div className="stack">
      <div className="op-tiles pr-tiles" data-testid="todo-tiles">
        <div className="op-tile a"><b>{open.filter((t) => t.due && t.due < today).length}</b><span>Overdue</span></div>
        <div className="op-tile d"><b>{open.filter((t) => t.due && t.due >= today && t.due <= week).length}</b><span>Due this week</span></div>
        <div className="op-tile b"><b>{open.length}</b><span>Open</span></div>
        <div className="op-tile c"><b>{w.tasks.length - open.length}</b><span>Done</span></div>
      </div>
      {list}
    </div>
  );
}

// ---------------------------------------------------------------- hours
const ACTIVITIES = ["Volunteering", "Shadowing", "Clinical hours", "Research", "Work shifts", "Club or leadership", "Tutoring", "Apprenticeship hours"];

/** A simple hours log: what pre-health, volunteer and apprenticeship students are asked to total up. */
function Hours() {
  const { ws, save, run } = useStore();
  const owner = useOwnerView();
  const card = owner ? "op-card stack-sm" : "card card-pad stack-sm";
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
      {owner && list.length > 0 && (
        <div className="op-tiles pr-tiles" data-testid="hours-tiles">
          <div className="op-tile a"><b>{fmt(list.reduce((x, h) => x + h.hours, 0))}</b><span>Hours in all</span></div>
          {totals.slice(0, 4).map(([a, t], i) => <div key={a} className={"op-tile " + "bcdb"[i]}><b>{fmt(t)}</b><span>{a}</span></div>)}
        </div>
      )}
      <div className={card}>
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
          {!owner && <div className="card card-pad stack-sm" data-testid="hours-totals">
            <h3>Totals</h3>
            {totals.map(([a, t]) => <div key={a} className="row-between small"><span>{a}</span><strong>{fmt(t)} h</strong></div>)}
          </div>}
          <div className={card}>
            <h3>Log</h3>
            {list.map((h) => (
              <div key={h.id} className="row-between small" style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <span>{fmtDate(h.date)} · {h.activity} · <strong>{fmt(h.hours)} h</strong>{h.note ? <span className="muted"> · {h.note}</span> : null}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(h.id)} aria-label={`Delete ${h.activity} on ${h.date}`}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </>
      ) : <div className={owner ? "op-card" : "card"}><Empty title="No hours yet" body="Add your first entry above. Totals per activity add up here." /></div>}
    </div>
  );
}

/** "America/New_York" → "Eastern", for comparing with the zone an email names. */
function zoneName(tz: string): string {
  if (/New_York|Detroit|Indiana|Kentucky|Toronto|Eastern/.test(tz)) return "Eastern";
  if (/Chicago|Winnipeg|Menominee|Central/.test(tz)) return "Central";
  if (/Denver|Phoenix|Boise|Edmonton|Mountain/.test(tz)) return "Mountain";
  if (/Los_Angeles|Vancouver|Pacific/.test(tz)) return "Pacific";
  return tz;
}
