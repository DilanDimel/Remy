import { useEffect, useState } from "react";
import { ArrowLeft, Check, Clock, Plus, RotateCcw, Trash2 } from "lucide-react";
import { api, useStore } from "../lib/store";
import { go, useRoute } from "../lib/router";
import { Empty, Remy, Spinner } from "../components/common";

// The owners' dashboard (server/admin.ts). Numbers about use, errors students hit, and the team's
// own to-dos, meetings and hours. Never anything a student wrote.
type Overview = {
  users: Record<string, number>; daily: { day: string; signed_in: number; guests: number }[];
  active: { day: number; week: number; month: number };
  funnel: { accounts: number; started: number; resume: number; setup_done: number; applied: number; chatted: number };
  ai: { purpose: string; calls: number; failed: number; avg_ms: number }[]; errorsThisWeek: number;
};
type ErrorRow = { id: number; at: string; kind: string; place: string; message: string; detail: string };
type Errors = { recent: ErrorRow[]; top: { message: string; kind: string; place: string; times: number; students: number; last: string }[] };
type TeamTask = { id: string; title: string; owner: string; due: string; notes: string; done: boolean; created_by: string };
type TeamEvent = { id: string; title: string; date: string; time: string; who: string; notes: string; created_by: string };
type Team = { tasks: TeamTask[]; events: TeamEvent[]; hours: { member: string; hours: number; week: number | null }[]; entries: { id: string; member: string; start_at: string; end_at: string | null; note: string }[]; clockedIn: string | null };

const TABS = [["overview", "Overview"], ["errors", "Errors"], ["tasks", "Team to-dos"], ["calendar", "Team calendar"], ["hours", "Hours"]] as const;
type Tab = (typeof TABS)[number][0];
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function Admin() {
  const { me } = useStore();
  const { query } = useRoute();
  const tab = (query.get("tab") as Tab) || "overview";
  if (!me?.owner) return (
    <div className="landing-screen"><div className="landing-card"><Empty title="Only for Remy's owners" body="Sign in with an owner's email to see this page." action={<a className="btn btn-primary" href="#/">Back to Remy</a>} /></div></div>
  );
  return (
    <div className="admin">
      <header className="row-between" style={{ gap: 12 }}>
        <span className="logo"><Remy size={28} /> Remy owners</span>
        <button className="btn btn-ghost btn-sm" onClick={() => go("/")}><ArrowLeft size={15} /> Back to Remy</button>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(`/admin?tab=${k}`)}>{l}</button>)}
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "errors" && <ErrorsTab />}
      {(tab === "tasks" || tab === "calendar" || tab === "hours") && <TeamTab tab={tab} />}
    </div>
  );
}

function useLoad<T>(path: string): [T | null, () => void, (t: T) => void] {
  const { run } = useStore();
  const [data, setData] = useState<T | null>(null);
  const load = () => { run(() => api<T>("GET", path)).then((d) => d && setData(d)); };
  useEffect(load, [path]);
  return [data, load, setData];
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return <div className="admin-stat"><strong>{n}</strong><span className="small muted">{label}</span></div>;
}

function OverviewTab() {
  const [d] = useLoad<Overview>("/api/admin/overview");
  if (!d) return <div className="row"><Spinner /> Loading…</div>;
  const f = d.funnel;
  const signedIn = (d.users.supabase || 0) + (d.users.google || 0);
  const steps: [string, number][] = [["Signed up", f.accounts], ["Started setup", f.started], ["Added a resume", f.resume], ["Finished setup", f.setup_done], ["Asked Remy something", f.chatted], ["Started an application", f.applied]];
  const max = Math.max(1, ...d.daily.map((x) => x.signed_in + x.guests));
  return (
    <div className="stack-lg">
      <div className="admin-stats">
        <Stat n={signedIn} label="students signed up" />
        <Stat n={d.users.guest || 0} label="guest workspaces (demo)" />
        <Stat n={d.active.week} label="students active this week" />
        <Stat n={d.active.day} label="active today" />
        <Stat n={d.errorsThisWeek} label="errors this week" />
      </div>
      <section className="card card-pad stack-sm">
        <h3>New accounts, last 14 days</h3>
        {d.daily.length ? (
          <div className="admin-bars" role="img" aria-label="New accounts per day">
            {d.daily.map((x) => (
              <div key={x.day} className="admin-bar" title={`${x.day}: ${x.signed_in} signed in, ${x.guests} guests`}>
                <div style={{ height: `${(x.guests / max) * 100}%`, background: "var(--line)" }} />
                <div style={{ height: `${(x.signed_in / max) * 100}%`, background: "var(--fox)" }} />
                <span className="xs muted">{x.day.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : <p className="small muted">No new accounts in the last 14 days.</p>}
        <span className="xs muted">Orange: signed-in students. Grey: guests trying the demo.</span>
      </section>
      <section className="card card-pad stack-sm">
        <h3>How far signed-in students get</h3>
        {steps.map(([l, v]) => (
          <div key={l} className="admin-funnel"><span className="small">{l}</span><div><div style={{ width: `${f.accounts ? (v / f.accounts) * 100 : 0}%` }} /></div><b className="small">{v}</b></div>
        ))}
      </section>
      <section className="card card-pad stack-sm">
        <h3>AI use, last 7 days</h3>
        {d.ai.length ? (
          <table className="table"><thead><tr><th>What for</th><th>Calls</th><th>Failed</th><th>Average time</th></tr></thead>
            <tbody>{d.ai.map((a) => <tr key={a.purpose}><td>{a.purpose}</td><td>{a.calls}</td><td>{a.failed ? <span className="bad">{a.failed}</span> : 0}</td><td>{(a.avg_ms / 1000).toFixed(1)} s</td></tr>)}</tbody></table>
        ) : <p className="small muted">No AI calls this week.</p>}
      </section>
      <p className="xs muted">Counts only. This page never shows a student's resume, chats or files.</p>
    </div>
  );
}

function ErrorsTab() {
  const [d, reload] = useLoad<Errors>("/api/admin/errors");
  const [open, setOpen] = useState<number | null>(null);
  if (!d) return <div className="row"><Spinner /> Loading…</div>;
  return (
    <div className="stack-lg">
      <div className="row-between"><p className="small muted">Errors students hit in their browser, and server errors, kept for 60 days.</p><button className="btn btn-ghost btn-sm" onClick={reload}><RotateCcw size={14} /> Refresh</button></div>
      <section className="card card-pad stack-sm">
        <h3>Most common, last 30 days</h3>
        {d.top.length ? (
          <table className="table"><thead><tr><th>Error</th><th>Where</th><th>Times</th><th>Students</th><th>Last</th></tr></thead>
            <tbody>{d.top.map((t, i) => <tr key={i}><td>{t.message}<div className="xs muted">{t.kind === "browser" ? "In the browser" : "On the server"}</div></td><td className="small">{t.place}</td><td>{t.times}</td><td>{t.students}</td><td className="small">{when(t.last)}</td></tr>)}</tbody></table>
        ) : <p className="small muted">No errors in the last 30 days.</p>}
      </section>
      <section className="card card-pad stack-sm">
        <h3>Latest</h3>
        {d.recent.map((e) => (
          <div key={e.id} className="admin-err">
            <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start", textAlign: "left", height: "auto", whiteSpace: "normal" }} onClick={() => setOpen(open === e.id ? null : e.id)}>
              <span className="small"><b>{e.message}</b><br /><span className="xs muted">{when(e.at)}, {e.kind === "browser" ? "browser" : "server"}, {e.place}</span></span>
            </button>
            {open === e.id && e.detail && <pre className="admin-pre">{e.detail}</pre>}
          </div>
        ))}
        {!d.recent.length && <p className="small muted">Nothing yet.</p>}
      </section>
    </div>
  );
}

function TeamTab({ tab }: { tab: "tasks" | "calendar" | "hours" }) {
  const { run, me } = useStore();
  const [d, , setD] = useLoad<Team>("/api/admin/team");
  const [task, setTask] = useState({ title: "", owner: "", due: "" });
  const [ev, setEv] = useState({ title: "", date: "", time: "", who: "" });
  const [note, setNote] = useState("");
  const send = async (method: "POST" | "DELETE", path: string, body?: unknown, done?: string) => {
    const r = await run(() => api<Team>(method, path, body), done);
    if (r) setD(r);
    return !!r;
  };
  if (!d) return <div className="row"><Spinner /> Loading…</div>;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  if (tab === "tasks") return (
    <div className="stack">
      <form className="card card-pad admin-form" onSubmit={async (e) => { e.preventDefault(); if (await send("POST", "/api/admin/tasks", task, "To-do added")) setTask({ title: "", owner: "", due: "" }); }}>
        <input className="input" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="What needs doing?" aria-label="To-do" />
        <input className="input" value={task.owner} onChange={(e) => setTask({ ...task, owner: e.target.value })} placeholder="Who (name)" aria-label="Who" />
        <input className="input" type="date" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} aria-label="Due date" />
        <button className="btn btn-primary btn-sm" disabled={!task.title.trim()}><Plus size={15} /> Add to-do</button>
      </form>
      <div className="card">
        {d.tasks.map((t) => (
          <div key={t.id} className="admin-row" style={t.done ? { opacity: 0.55 } : undefined}>
            <input type="checkbox" checked={t.done} onChange={() => send("POST", "/api/admin/tasks", { id: t.id, done: !t.done })} aria-label={`Done: ${t.title}`} />
            <div className="grow stack-sm" style={{ gap: 2 }}>
              <span className="small" style={t.done ? { textDecoration: "line-through" } : undefined}><b>{t.title}</b></span>
              <span className="xs muted">{[t.owner && `For ${t.owner}`, t.due && `due ${t.due}`, t.due && !t.done && t.due < today && "overdue"].filter(Boolean).join(", ") || "No owner or date yet"}</span>
              {t.notes && <span className="xs muted">{t.notes}</span>}
            </div>
            <button className="icon-btn" onClick={() => send("DELETE", `/api/admin/tasks/${t.id}`)} aria-label="Delete to-do"><Trash2 size={15} /></button>
          </div>
        ))}
        {!d.tasks.length && <Empty title="No team to-dos" body="Add the first one above." />}
      </div>
    </div>
  );
  if (tab === "calendar") {
    const upcoming = d.events.filter((e) => e.date >= today), past = d.events.filter((e) => e.date < today).reverse();
    const row = (e: TeamEvent) => (
      <div key={e.id} className="admin-row">
        <div className="admin-date"><b>{new Date(e.date + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</b><span className="xs muted">{e.time}</span></div>
        <div className="grow stack-sm" style={{ gap: 2 }}><b className="small">{e.title}</b>{e.who && <span className="xs muted">With {e.who}</span>}</div>
        <button className="icon-btn" onClick={() => send("DELETE", `/api/admin/events/${e.id}`)} aria-label="Delete meeting"><Trash2 size={15} /></button>
      </div>
    );
    return (
      <div className="stack">
        <form className="card card-pad admin-form" onSubmit={async (e) => { e.preventDefault(); if (await send("POST", "/api/admin/events", ev, "Meeting added")) setEv({ title: "", date: "", time: "", who: "" }); }}>
          <input className="input" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} placeholder="Meeting, e.g. Career Center partnership" aria-label="Meeting" />
          <input className="input" value={ev.who} onChange={(e) => setEv({ ...ev, who: e.target.value })} placeholder="With whom" aria-label="With whom" />
          <input className="input" type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} aria-label="Date" />
          <input className="input" type="time" value={ev.time} onChange={(e) => setEv({ ...ev, time: e.target.value })} aria-label="Time" />
          <button className="btn btn-primary btn-sm" disabled={!ev.title.trim() || !ev.date}><Plus size={15} /> Add meeting</button>
        </form>
        <div className="card"><div className="card-pad"><h3>Coming up</h3></div>{upcoming.map(row)}{!upcoming.length && <p className="small muted card-pad">Nothing scheduled.</p>}</div>
        {past.length > 0 && <div className="card"><div className="card-pad"><h3>Last 30 days</h3></div>{past.map(row)}</div>}
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="card card-pad stack-sm">
        <h3 className="row"><Clock size={18} /> {d.clockedIn ? `Clocked in since ${when(d.clockedIn)}` : "You're clocked out"}</h3>
        <div className="row">
          <input className="input grow" value={note} onChange={(e) => setNote(e.target.value)} placeholder={d.clockedIn ? "What did you work on? (optional)" : "What are you working on? (optional)"} aria-label="Note" />
          <button className={"btn btn-sm " + (d.clockedIn ? "btn-secondary" : "btn-primary")} onClick={async () => { if (await send("POST", "/api/admin/clock", { action: d.clockedIn ? "out" : "in", note }, d.clockedIn ? "Clocked out" : "Clocked in")) setNote(""); }} data-testid="button-clock">{d.clockedIn ? "Clock out" : "Clock in"}</button>
        </div>
        <span className="xs muted">Signed in as {me?.email}. Each person clocks only themselves.</span>
      </div>
      <div className="card">
        <table className="table"><thead><tr><th>Who</th><th>This week</th><th>All time</th></tr></thead>
          <tbody>{d.hours.map((h) => <tr key={h.member}><td>{h.member}</td><td>{h.week ?? 0} h</td><td>{h.hours} h</td></tr>)}</tbody></table>
        {!d.hours.length && <p className="small muted card-pad">No hours logged yet.</p>}
      </div>
      <div className="card">
        <div className="card-pad"><h3>Recent entries</h3></div>
        {d.entries.map((e) => (
          <div key={e.id} className="admin-row">
            <div className="grow stack-sm" style={{ gap: 2 }}>
              <span className="small"><b>{e.member}</b>: {when(e.start_at)} to {e.end_at ? when(e.end_at) : <span className="pass"><Check size={12} /> still working</span>}</span>
              {e.note && <span className="xs muted">{e.note}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
