import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Activity, AlertTriangle, Bot, ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check, Clock, KanbanSquare, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { api, useStore } from "../lib/store";
import { useRoute } from "../lib/router";
import { BetaBadge, CopyButton, Empty, Remy, Rich, Spinner } from "../components/common";
import { WhatsNew } from "../components/WhatsNew";
import { ThemeToggle } from "../components/ThemeToggle";

// The owners' dashboard (server/admin.ts). Numbers about use, errors students hit, and the team's
// own board, meetings, hours and activity. Never anything a student wrote.
type Overview = {
  northWeek: number; northPrev: number;
  students: number; newWeek: number; newPrev: number; activeWeek: number; activePrev: number; activeToday: number;
  daily: { day: string; n: number }[];
  funnel: { accounts: number; resume: number; prefs: number; setup_done: number; chatted: number; applied: number };
  features: { name: string; students: number; uses: number }[];
  ai: { calls: number; failed: number; cost: number; priced: number; avgMs: number }; openErrors: number; feedback: number;
};
type OpenError = { message: string; kind: string; place: string; times: number; students: number; last: string; first: string; detail: string };
type Errors = { open: OpenError[]; fixed: { message: string; kind: string; fixed_at: string; fixed_by: string; times: number }[]; feedback: { id: number; at: string; place: string; message: string; email: string }[] };
type Status = "todo" | "doing" | "done";
type TeamTask = { id: string; title: string; assignee: string; due: string; notes: string; done: boolean; status: Status; done_by: string; done_at: string | null; created_by: string };
type Answer = "yes" | "maybe" | "no";
type TeamEvent = { id: string; title: string; date: string; time: string; who: string; notes: string; created_by: string; assignees: string; rsvps: Record<string, Answer> };
type Member = { email: string; name: string; founder: boolean; addedBy: string; addedAt: string | null };
type Entry = { id: string; member: string; start_at: string; end_at: string | null; note: string };
type Team = {
  me: string; members: Member[]; tasks: TeamTask[]; events: TeamEvent[]; hours: { member: string; hours: number; week: number }[];
  entries: Entry[]; activity: { id: number; at: string; actor: string; action: string; detail: string }[]; clockedIn: string | null;
  calendar: { available: boolean; connectedBy: string; connectedAt: string | null };
};
const ANSWERS: [Answer, string][] = [["yes", "Going"], ["maybe", "Maybe"], ["no", "Can't go"]];

const TABS = [["overview", "Overview", BarChart3], ["board", "Board", KanbanSquare], ["people", "People", Users], ["calendar", "Calendar", CalendarDays], ["hours", "Hours", Clock], ["activity", "Activity", Activity], ["errors", "Errors & feedback", AlertTriangle], ["agents", "Agents", Bot]] as const;
type Tab = (typeof TABS)[number][0];
const HISTORY_AFTER = 3 * 86400_000;
const COLS: [Status, string][] = [["todo", "To do"], ["doing", "In progress"], ["done", "Done"]];
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const day = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
/** Assignees are stored as comma-separated emails. */
const list = (v: string) => (v ? v.split(",").filter(Boolean) : []);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

const GCAL_RESULT: Record<string, [string, boolean]> = {
  connected: ["Team Google Calendar connected. Meetings now appear on the “Remy team” calendar.", false],
  cancelled: ["Google Calendar wasn't connected.", true],
  failed: ["Google Calendar couldn't be connected. Please try again.", true],
};

export default function Admin() {
  const { me, toast } = useStore();
  const { query } = useRoute();
  const tab = (query.get("tab") as Tab) || "overview";
  // Back from Google's consent screen (team calendar): say how it went, then tidy the address bar.
  useEffect(() => {
    const r = GCAL_RESULT[query.get("gcal") || ""];
    if (!r) return;
    toast(...r);
    history.replaceState(null, "", "/admin?tab=calendar");
  }, []);
  if (!me?.owner) return (
    <div className="landing-screen"><div className="landing-card"><Empty title="Only for Remy's owners" body="Sign in with an owner's email to see this page." action={<a className="btn btn-primary" href="/">Back to Remy</a>} /></div></div>
  );
  return (
    <div className="adm">
      <aside className="adm-nav">
        <span className="logo"><Remy size={26} /> Remy <BetaBadge /></span>
        <span className="xs muted adm-role">Owners</span>
        <nav>
          {TABS.map(([k, l, Icon]) => <a key={k} href={`/admin?tab=${k}`} aria-current={tab === k ? "page" : undefined}><Icon size={17} /> {l}</a>)}
        </nav>
        <WhatsNew className="btn btn-ghost btn-sm adm-news" />
        <ThemeToggle className="btn btn-ghost btn-sm adm-theme" label />
        <a className="btn btn-ghost btn-sm adm-back" href="/"><ArrowLeft size={14} /> Back to Remy</a>
      </aside>
      <main className="adm-main">
        {tab === "overview" && <OverviewTab />}
        {tab === "errors" && <ErrorsTab />}
        {tab === "agents" && <AgentsTab />}
        {tab !== "overview" && tab !== "errors" && tab !== "agents" && <TeamTab tab={tab} />}
      </main>
    </div>
  );
}

function Head({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return <div className="adm-head"><div><h1>{title}</h1>{sub && <p className="small muted">{sub}</p>}</div>{action}</div>;
}

function useLoad<T>(path: string): [T | null, (ok?: string) => void, (t: T) => void] {
  const { run } = useStore();
  const [data, setData] = useState<T | null>(null);
  const load = (ok?: string) => { run(() => api<T>("GET", path), ok).then((d) => d && setData(d)); };
  useEffect(() => { load(); }, [path]);
  return [data, load, setData];
}

/** A number with its change against the week before. */
function Kpi({ n, label, prev, note }: { n: number | string; label: string; prev?: number; note?: string }) {
  const diff = typeof n === "number" && prev != null ? n - prev : null;
  return (
    <div className="adm-kpi">
      <span className="small muted">{label}</span>
      <strong>{n}</strong>
      {diff != null ? <span className={"xs " + (diff > 0 ? "pass" : diff < 0 ? "bad" : "muted")}>{diff > 0 ? "▲" : diff < 0 ? "▼" : "="} {Math.abs(diff)} vs last week</span> : <span className="xs muted">{note || " "}</span>}
    </div>
  );
}

function OverviewTab() {
  const [d, reload] = useLoad<Overview>("/api/admin/overview");
  if (!d) return <div className="row"><Spinner /> Loading…</div>;
  const f = d.funnel;
  const steps: [string, number][] = [["Signed up", f.accounts], ["Added a resume", f.resume], ["Reached preferences", f.prefs], ["Finished setup", f.setup_done], ["Asked Remy something", f.chatted], ["Started an application", f.applied]];
  // 14 days, including days with no sign-ups, so gaps read as gaps.
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 86400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }));
  const byDay = new Map(d.daily.map((x) => [x.day, x.n]));
  const max = Math.max(1, ...days.map((x) => byDay.get(x) || 0));
  return (
    <div className="stack-lg">
      <Head title="Overview" sub="Signed-in students only. Counts, never anything a student wrote." action={<button className="btn btn-ghost btn-sm" onClick={() => reload("Up to date")}><RotateCcw size={14} /> Refresh</button>} />
      <div className="adm-kpis">
        <Kpi n={d.northWeek} label="North star: students who took a career step this week" prev={d.northPrev} />
        <Kpi n={d.activeWeek} label="Active students this week" prev={d.activePrev} />
        <Kpi n={d.newWeek} label="New sign-ups this week" prev={d.newPrev} />
        <Kpi n={d.students} label="Students in total" note={`${d.activeToday} active today`} />
        <Kpi n={`$${d.ai.cost.toFixed(2)}`} label="AI spend this week" note={d.ai.priced < d.ai.calls ? `${d.ai.calls} calls, ${d.ai.calls - d.ai.priced} without a price` : `${d.ai.calls} calls`} />
        <Kpi n={d.openErrors} label="Open errors" note={d.feedback ? `${d.feedback} new feedback` : d.openErrors ? "see Errors" : "all clear"} />
      </div>
      <section className="adm-card">
        <h3>New sign-ups, last 14 days</h3>
        <div className="adm-bars" role="img" aria-label={`New sign-ups per day for the last 14 days, ${days.reduce((s, x) => s + (byDay.get(x) || 0), 0)} in total`}>
          {days.map((x) => {
            const n = byDay.get(x) || 0;
            return (
              <div key={x} className="adm-bar" tabIndex={0} aria-label={`${day(x)}: ${n}`}>
                <span className="adm-tip">{day(x)}: {n}</span>
                <div className="adm-bar-track"><div style={{ height: `${(n / max) * 100}%` }} /></div>
                <span className="xs muted">{Number(x.slice(8))}</span>
              </div>
            );
          })}
        </div>
      </section>
      <div className="adm-grid2">
        <section className="adm-card">
          <h3>Where students drop off</h3>
          {steps.map(([l, v], i) => {
            const prev = i ? steps[i - 1][1] : v;
            const lost = i && prev ? Math.round(((prev - v) / prev) * 100) : 0;
            return (
              <div key={l} className="adm-funnel">
                <span className="small">{l}</span>
                <div><div style={{ width: `${f.accounts ? (v / f.accounts) * 100 : 0}%` }} /></div>
                <b className="small">{v}</b>
                <span className="xs muted">{i && lost > 0 ? `−${lost}%` : ""}</span>
              </div>
            );
          })}
        </section>
        <section className="adm-card">
          <h3>What students used this week</h3>
          {d.features.length ? (
            <table className="table"><thead><tr><th>Feature</th><th>Students</th><th>Times</th></tr></thead>
              <tbody>{d.features.map((x) => <tr key={x.name}><td>{x.name}</td><td>{x.students}</td><td>{x.uses}</td></tr>)}</tbody></table>
          ) : <p className="small muted">Nothing yet this week.</p>}
          <p className="xs muted">AI calls: {d.ai.calls}, {d.ai.failed} failed, {(d.ai.avgMs / 1000).toFixed(1)} s on average.</p>
        </section>
      </div>
    </div>
  );
}

function ErrorsTab() {
  const { run } = useStore();
  const [d, reload, setD] = useLoad<Errors>("/api/admin/errors");
  const [open, setOpen] = useState<string | null>(null);
  if (!d) return <div className="row"><Spinner /> Loading…</div>;
  const fix = async (e: OpenError) => { const r = await run(() => api<Errors>("POST", "/api/admin/errors/fix", { message: e.message, kind: e.kind }), "Marked fixed. If it happens again, it comes back here."); if (r) setD(r); };
  return (
    <div className="stack-lg">
      <Head title="Errors & feedback" sub="What students wrote with Send feedback, and the errors they hit in the last 30 days. Mark an error fixed after the fix ships." action={<button className="btn btn-ghost btn-sm" onClick={() => reload("Up to date")}><RotateCcw size={14} /> Refresh</button>} />
      <section className="adm-card adm-list">
        <h3>Student feedback</h3>
        {d.feedback.map((f) => (
          <div key={f.id} className="adm-err">
            <div className="grow stack-sm" style={{ gap: 4 }}>
              <span className="small">{f.message}</span>
              <span className="xs muted">{f.email || "a student"} · {f.place || "somewhere in Remy"} · {ago(f.at)}</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={async () => { const r = await run(() => api<Errors>("POST", "/api/admin/errors/fix", { message: f.message, kind: "feedback" }), "Marked handled"); if (r) setD(r); }}><Check size={14} /> Handled</button>
          </div>
        ))}
        {!d.feedback.length && <p className="small muted">No new feedback.</p>}
      </section>
      <section className="adm-card adm-list">
        <h3>Errors</h3>
        {d.open.map((e) => {
          const k = e.kind + e.message;
          return (
            <div key={k} className="adm-err">
              <div className="grow stack-sm" style={{ gap: 4 }}>
                <b className="small">{e.message}</b>
                <span className="xs muted">{e.kind === "browser" ? "Browser" : "Server"} · {e.place || "unknown page"} · {e.times} time{e.times === 1 ? "" : "s"}{e.students ? `, ${e.students} student${e.students === 1 ? "" : "s"}` : ""} · last {ago(e.last)}</span>
                {e.detail && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setOpen(open === k ? null : k)}>{open === k ? "Hide details" : "Show details"}</button>}
                {open === k && <pre className="admin-pre">{e.detail}</pre>}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => fix(e)}><Check size={14} /> Mark fixed</button>
            </div>
          );
        })}
        {!d.open.length && <Empty title="No open errors" body="Nothing students hit in the last 30 days is waiting on a fix." />}
      </section>
      {d.fixed.length > 0 && (
        <section className="adm-card">
          <h3>Fixed recently</h3>
          {d.fixed.map((e) => <div key={e.kind + e.message} className="small adm-fixed"><Check size={14} className="pass" /> <span className="grow">{e.message}</span><span className="xs muted">{e.fixed_by.split("@")[0]}, {ago(e.fixed_at)}</span></div>)}
        </section>
      )}
    </div>
  );
}

type Run<T> = { at: string; run_by: string; output: T } | null;
type Agents = { ai: boolean; feedback: Run<{ themes: { title: string; count: number; severity: string; examples: string[]; todo: string }[]; reports: number; note: string }>; weekly: Run<{ lines: string[] }>;
  scout: Run<{ reached: number; tried: number; early: number; broken: { company: string; error: string }[]; quiet?: string[]; thin: { field: string; employers: number; early: number }[] }>;
  research: Run<{ question: string; answer: string; sources: { url: string; title: string }[]; web: boolean }>;
  marketing: Run<{ brief: string; linkedin: string; instagram: string; email: { subject: string; body: string } }> };

/** The team's agents: simple workflows that post results here; owners decide what becomes a board card. */
function AgentsTab() {
  const { run } = useStore();
  const [d, , setD] = useLoad<Agents>("/api/admin/agents");
  const [busy, setBusy] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [brief, setBrief] = useState("");
  const go = async (agent: string) => { setBusy(agent); const r = await run(() => api<Agents>("POST", `/api/admin/agents/${agent}/run`, { question, brief }), "Agent finished"); if (r) setD(r); setBusy(""); };
  const add = async (title: string) => { if (await run(() => api("POST", "/api/admin/agents/suggestion", { title }), "Added to the board")) setAdded([...added, title]); };
  if (!d) return <div className="row"><Spinner /> Loading…</div>;
  const card = (key: string, name: string, what: string, body: ReactNode, last: Run<unknown>, needsAi = false) => (
    <section className="adm-card stack-sm" key={key} data-testid={`agent-${key}`}>
      <div className="row-between"><div><h3>{name}</h3><p className="xs muted">{what}</p></div>
        <button className="btn btn-secondary btn-sm" disabled={!!busy || (needsAi && !d.ai)} onClick={() => go(key)}>{busy === key ? <Spinner /> : <RotateCcw size={14} />} Run now</button></div>
      {last ? <span className="xs muted">Last run {ago(last.at)} by {last.run_by.split("@")[0]}</span> : <span className="xs muted">Not run yet.</span>}
      {body}
    </section>
  );
  const fb = d.feedback?.output, wk = d.weekly?.output, sc = d.scout?.output, rs = d.research?.output, mk = d.marketing?.output;
  const draft = (label: string, text: string) => (
    <div className="stack-sm" style={{ gap: 4 }}>
      <div className="row-between"><b className="small">{label}</b><CopyButton text={text} /></div>
      <p className="small" style={{ whiteSpace: "pre-wrap" }}>{text}</p>
    </div>
  );
  return (
    <div className="stack-lg">
      <Head title="Agents" sub="Step-by-step helpers for the team. They suggest; you decide. No student personal data is sent to them." />
      {card("feedback", "Feedback & bug sorter", "Groups the last 30 days of open errors and student feedback into themes, most urgent first, each with a suggested to-do.", fb && (
        <div className="stack-sm">
          {fb.note && <p className="small muted">{fb.note}</p>}
          {fb.themes.map((t) => (
            <div key={t.title} className="adm-row" style={{ alignItems: "flex-start" }}>
              <span className={"chip " + (t.severity === "high" ? "chip-bad" : t.severity === "medium" ? "chip-setup" : "chip-plain")}>{t.severity}</span>
              <div className="grow stack-sm" style={{ gap: 2 }}><b className="small">{t.title} <span className="muted">({t.count})</span></b>{t.examples.map((e) => <span key={e} className="xs muted">“{e}”</span>)}<span className="xs">To-do: {t.todo}</span></div>
              {added.includes(t.todo) ? <span className="xs muted"><Check size={12} /> On the board</span> : <button className="btn btn-ghost btn-sm" onClick={() => add(t.todo)}><Plus size={14} /> Add to board</button>}
            </div>
          ))}
        </div>
      ), d.feedback, true)}
      {card("weekly", "Weekly analyst", "The week's numbers in plain sentences: north star, active students, setup, AI spend and open issues.", wk && <ul className="small stack-sm" style={{ paddingLeft: 18 }}>{wk.lines.map((l) => <li key={l}>{l}</li>)}</ul>, d.weekly)}
      {card("scout", "Openings scout", "Reads every employer career site Remy uses (recent copies count) and shows which ones failed and which fields have few early-career openings. Takes about a minute.", sc && (
        <div className="stack-sm">
          <p className="small">{sc.reached} of {sc.tried} employer sites answered, with {sc.early} early-career postings in all.</p>
          {sc.thin.length > 0 && <><b className="small">Fields with the fewest early-career openings</b><ul className="small" style={{ paddingLeft: 18 }}>{sc.thin.map((t) => <li key={t.field}>{t.field}: {t.early} from {t.employers} employer{t.employers === 1 ? "" : "s"}</li>)}</ul></>}
          {!!sc.quiet?.length && <p className="xs muted">No internships posted right now: {sc.quiet.join(", ")}.</p>}
          {sc.broken.length > 0 && <details><summary className="small">{sc.broken.length} site{sc.broken.length === 1 ? "" : "s"} couldn't be read</summary><ul className="xs muted" style={{ paddingLeft: 18 }}>{sc.broken.map((b) => <li key={b.company}>{b.company}: {b.error}</li>)}</ul></details>}
          {sc.broken.length > 0 && !added.includes("Fix the job readers the scout flagged") && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => add("Fix the job readers the scout flagged")}><Plus size={14} /> Add to board</button>}
        </div>
      ), d.scout)}
      {card("research", "Researcher", "Answers a team question from live web sources (Perplexity), with links. Don't paste student information.", (
        <div className="stack-sm">
          <textarea className="textarea" style={{ minHeight: 60 }} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. What do Handshake and Teal charge colleges, and what do students say about them?" aria-label="Research question" data-testid="input-research" />
          {rs && (
            <div className="stack-sm">
              <b className="small">{rs.question}</b>
              {!rs.web && <span className="chip chip-setup" style={{ alignSelf: "flex-start" }}>No web sources: check before using</span>}
              <div className="small stack-sm"><Rich text={rs.answer} /></div>
              {rs.sources.length > 0 && <div className="xs stack-sm" style={{ gap: 2 }}>{rs.sources.map((s, i) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer">[{i + 1}] {s.title || new URL(s.url).hostname}</a>)}</div>}
            </div>
          )}
        </div>
      ), d.research, true)}
      {card("marketing", "Marketing drafter", "Drafts a LinkedIn post, an Instagram caption and an email to professors from the latest updates. You edit and send; it never posts anything.", (
        <div className="stack-sm">
          <input className="input" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Optional brief, e.g. invite Neeley students to try the beta before finals" aria-label="Marketing brief" data-testid="input-marketing" />
          {mk && <>{draft("LinkedIn", mk.linkedin)}{draft("Instagram", mk.instagram)}{draft(`Email: ${mk.email.subject}`, mk.email.body)}</>}
        </div>
      ), d.marketing, true)}
    </div>
  );
}

function Avatar({ m, size = 26 }: { m?: Member; size?: number }) {
  const text = m ? m.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase() : "?";
  return <span className="adm-av" style={{ width: size, height: size, fontSize: size * 0.4 }} title={m ? `${m.name} (${m.email})` : "Nobody yet"} aria-hidden>{text}</span>;
}

/** Pick any number of teammates; shows their avatars, opens a checklist. */
function People({ members, value, onChange, label }: { members: Member[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  const chosen = members.filter((m) => value.includes(m.email));
  const ref = useRef<HTMLDetailsElement>(null);
  // Close on a click anywhere else, like a menu.
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false; };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  return (
    <details className="adm-people-pick" ref={ref}>
      <summary aria-label={label}>
        {chosen.length ? <span className="adm-stack">{chosen.slice(0, 4).map((m) => <Avatar key={m.email} m={m} size={22} />)}</span> : <Avatar size={22} />}
        <span className="xs">{chosen.length === 0 ? "Unassigned" : chosen.length === 1 ? chosen[0].name : `${chosen.length} people`}</span>
      </summary>
      <div className="adm-people-menu" role="group" aria-label={label}>
        {members.map((m) => (
          <label key={m.email} className="row small" style={{ gap: 8, flexWrap: "nowrap" }}>
            <input type="checkbox" checked={value.includes(m.email)} onChange={(e) => onChange(e.target.checked ? [...value, m.email] : value.filter((x) => x !== m.email))} />
            <Avatar m={m} size={20} /> {m.name}
          </label>
        ))}
      </div>
    </details>
  );
}

function TeamTab({ tab }: { tab: "board" | "people" | "calendar" | "hours" | "activity" }) {
  const { run } = useStore();
  const { query } = useRoute();
  const [d, , setD] = useLoad<Team>("/api/admin/team");
  const [task, setTask] = useState({ title: "", assignee: [] as string[], due: "" });
  const [ev, setEv] = useState({ title: "", date: "", time: "", who: "", assignees: [] as string[] });
  const [over, setOver] = useState<Status | null>(null);
  const [member, setMember] = useState({ name: "", email: "" });
  const [note, setNote] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const send = async (method: "POST" | "DELETE", path: string, body?: unknown, done?: string) => {
    const r = await run(() => api<Team>(method, path, body), done);
    if (r) setD(r);
    return !!r;
  };
  if (!d) return <div className="row"><Spinner /> Loading…</div>;
  const who = (email: string) => d.members.find((m) => m.email === email);
  const nameOf = (email: string) => who(email)?.name || email.split("@")[0];
  // Activity details are stored with emails and ISO dates; show names and readable dates.
  const pretty = (t: string) => t.replace(/[^\s()]+@[^\s()]+\.[a-z]+/gi, (e) => nameOf(e.toLowerCase())).replace(/\b\d{4}-\d{2}-\d{2}\b/g, (x) => day(x));
  // Show the change right away; the server's answer (or a reload on failure) settles it.
  const patchTask = async (t: TeamTask, patch: Partial<TeamTask>, body: Record<string, unknown>) => {
    setD({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, ...patch, ...(patch.status ? { done: patch.status === "done", done_by: patch.status === "done" ? d.me : "", done_at: patch.status === "done" ? new Date().toISOString() : null } : {}) } : x)) });
    const r = await api<Team>("POST", "/api/admin/tasks", { id: t.id, ...body }).catch(() => null);
    if (r) setD(r); else run(() => api<Team>("GET", "/api/admin/team")).then((x) => x && setD(x));
  };
  const move = (t: TeamTask, status: Status) => { if (t.status !== status) patchTask(t, { status }, { status }); };
  const person = query.get("person") || "";

  const card = (t: TeamTask) => {
    const i = COLS.findIndex(([s]) => s === t.status);
    const late = t.due && t.status !== "done" && t.due < today();
    return (
      <div key={t.id} className={"adm-task" + (drag === t.id ? " dragging" : "")} draggable onDragStart={(e: DragEvent) => { e.dataTransfer.setData("text/plain", t.id); setDrag(t.id); }} onDragEnd={() => { setDrag(null); setOver(null); }}>
        <b className="small">{t.title}</b>
        {t.notes && <span className="xs muted">{t.notes}</span>}
        <div className="row-between" style={{ gap: 6 }}>
          <People members={d.members} value={list(t.assignee)} label={`Who does: ${t.title}`} onChange={(v) => patchTask(t, { assignee: v.join(",") }, { assignee: v })} />
          {t.due && <span className={"xs " + (late ? "bad" : "muted")}>{late ? "Late, " : "Due "}{day(t.due)}</span>}
        </div>
        {t.status === "done" && t.done_by && <span className="xs pass adm-inline"><Check size={12} /> Done by {nameOf(t.done_by)}{t.done_at ? `, ${ago(t.done_at)}` : ""}</span>}
        <div className="adm-task-actions">
          <button className="icon-btn" disabled={i === 0} onClick={() => move(t, COLS[i - 1][0])} aria-label={`Move "${t.title}" left`}><ArrowLeft size={14} /></button>
          <button className="icon-btn" disabled={i === COLS.length - 1} onClick={() => move(t, COLS[i + 1][0])} aria-label={`Move "${t.title}" right`}><ArrowRight size={14} /></button>
          <button className="icon-btn" onClick={() => send("DELETE", `/api/admin/tasks/${t.id}`)} aria-label={`Delete "${t.title}"`}><Trash2 size={14} /></button>
        </div>
      </div>
    );
  };

  if (tab === "board") {
    const mine = person ? d.tasks.filter((t) => list(t.assignee).includes(person)) : d.tasks;
    // Finished to-dos stay in Done for 3 days, then move to History so the board stays short.
    const old = (t: TeamTask) => t.status === "done" && !!t.done_at && Date.now() - new Date(t.done_at).getTime() > HISTORY_AFTER;
    const shown = mine.filter((t) => !old(t));
    const history = mine.filter(old).sort((a, b) => (b.done_at! > a.done_at! ? 1 : -1));
    return (
      <div className="stack-lg">
        <Head title="Board" sub="Drag a card to another column, or use its arrows. Everyone on the team sees the same board." />
        <form className="adm-card adm-form" onSubmit={async (e) => { e.preventDefault(); if (await send("POST", "/api/admin/tasks", task, "To-do added")) setTask({ title: "", assignee: [], due: "" }); }}>
          <input className="input" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="What needs doing?" aria-label="To-do" />
          <People members={d.members} value={task.assignee} onChange={(v) => setTask({ ...task, assignee: v })} label="Who does it" />
          <input className="input" type="date" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} aria-label="Due date" />
          <button className="btn btn-primary btn-sm" disabled={!task.title.trim()}><Plus size={15} /> Add</button>
        </form>
        <div className="row" style={{ gap: 6 }}>
          <a className="pref-chip" aria-pressed={!person} href="/admin?tab=board">Everyone</a>
          {d.members.map((m) => <a key={m.email} className="pref-chip" aria-pressed={person === m.email} href={`/admin?tab=board&person=${encodeURIComponent(m.email)}`}>{m.name}</a>)}
        </div>
        <div className="adm-board">
          {COLS.map(([s, label]) => {
            const list = shown.filter((t) => t.status === s);
            return (
              <section key={s} className={"adm-col" + (over === s && drag ? " adm-col-over" : "")} onDragOver={(e) => { e.preventDefault(); if (over !== s) setOver(s); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }} onDrop={(e) => { e.preventDefault(); const t = d.tasks.find((x) => x.id === e.dataTransfer.getData("text/plain")); if (t) move(t, s); setDrag(null); setOver(null); }} aria-label={label}>
                <h3>{label} <span className="muted small">{list.length}</span></h3>
                {list.map(card)}
                {!list.length && <p className="xs muted adm-drop">{s === "done" ? "Finished to-dos land here." : "Drop a card here."}</p>}
              </section>
            );
          })}
        </div>
        {history.length > 0 && (
          <details className="adm-card" data-testid="task-history">
            <summary className="row-between" style={{ cursor: "pointer" }}><h3>History</h3><span className="xs muted">{history.length} finished more than 3 days ago</span></summary>
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {history.map((t) => (
                <div key={t.id} className="adm-row small" style={{ alignItems: "center" }}>
                  <Check size={14} className="pass" />
                  <span className="grow">{t.title}</span>
                  <span className="xs muted">Done by {nameOf(t.done_by)}, {day(t.done_at!.slice(0, 10))}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => move(t, "todo")}>Reopen</button>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  if (tab === "people") {
    const weekAgo = Date.now() - 7 * 86400_000;
    return (
      <div className="stack-lg">
        <Head title="People" sub="Everyone here can open this dashboard and sees the same board, calendar, hours and activity." />
        <div className="adm-people">
          {d.members.map((m) => {
            const open = d.tasks.filter((t) => list(t.assignee).includes(m.email) && t.status !== "done");
            const doneWeek = d.tasks.filter((t) => t.done_by === m.email && t.done_at && new Date(t.done_at).getTime() > weekAgo).length;
            const h = d.hours.find((x) => x.member === m.email);
            const working = d.entries.some((e) => e.member === m.email && !e.end_at);
            const last = d.activity.find((a) => a.actor === m.email);
            return (
              <section key={m.email} className="adm-card adm-person">
                <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                  <Avatar m={m} size={40} />
                  <div className="grow stack-sm" style={{ gap: 2, minWidth: 0 }}>
                    <b className="adm-ellipsis">{m.name}{m.email === d.me && <span className="xs muted"> (you)</span>}</b>
                    <span className="xs muted adm-ellipsis">{m.email}</span>
                    {working && <span className="chip chip-live" style={{ justifySelf: "start" }}>Working now</span>}
                  </div>
                </div>
                <div className="adm-person-stats" aria-label="This week">
                  <div><strong>{open.length}</strong><span className="xs muted">open</span></div>
                  <div><strong>{doneWeek}</strong><span className="xs muted">done, 7 days</span></div>
                  <div><strong>{h?.week ?? 0} h</strong><span className="xs muted">worked, 7 days</span></div>
                </div>
                {open.slice(0, 3).map((t) => <span key={t.id} className="small adm-ellipsis">• {t.title}</span>)}
                {(() => { const next = d.events.find((e) => e.date >= today()); if (!next) return null; const a = ANSWERS.find(([k]) => k === next.rsvps[m.email]);
                  return <span className="xs muted adm-ellipsis">Next meeting ({next.title}): {a ? a[1].toLowerCase() : "hasn't answered"}</span>; })()}
                <span className="xs muted">{last ? `Last: ${last.action.toLowerCase()}, ${ago(last.at)}` : "No activity yet"}</span>
                <div className="row-between">
                  <a className="btn btn-ghost btn-sm" href={`/admin?tab=board&person=${encodeURIComponent(m.email)}`}>See their to-dos</a>
                  {!m.founder && m.email !== d.me && <button className="btn btn-ghost btn-sm" onClick={() => confirm(`Remove ${m.name} from the owners' dashboard?`) && send("DELETE", `/api/admin/members/${encodeURIComponent(m.email)}`, undefined, "Removed")}>Remove</button>}
                </div>
              </section>
            );
          })}
        </div>
        <form className="adm-card adm-form" onSubmit={async (e) => { e.preventDefault(); if (await send("POST", "/api/admin/members", member, "Teammate added. They see this page next time they sign in.")) setMember({ name: "", email: "" }); }}>
          <input className="input" value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} placeholder="Name" aria-label="Teammate name" />
          <input className="input" type="email" value={member.email} onChange={(e) => setMember({ ...member, email: e.target.value })} placeholder="Email they sign in with" aria-label="Teammate email" />
          <button className="btn btn-primary btn-sm" disabled={!member.email.includes("@")}><Plus size={15} /> Add teammate</button>
        </form>
      </div>
    );
  }

  if (tab === "calendar") {
    const t0 = today(), upcoming = d.events.filter((e) => e.date >= t0), past = d.events.filter((e) => e.date < t0).reverse();
    const row = (e: TeamEvent, upcoming: boolean) => {
      const count = (a: Answer) => Object.values(e.rsvps).filter((x) => x === a).length;
      const said = (a: Answer) => d.members.filter((m) => e.rsvps[m.email] === a);
      const waiting = d.members.filter((m) => !e.rsvps[m.email]);
      return (
        <div key={e.id} className="adm-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <div className="adm-date"><b>{new Date(e.date + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</b><span className="xs muted">{e.time}</span></div>
          <div className="grow stack-sm" style={{ gap: 4, minWidth: 200 }}>
            <b className="small">{e.title}</b>
            <span className="xs muted">{[e.who && `With ${e.who}`, `added by ${nameOf(e.created_by)}`].filter(Boolean).join(", ")}</span>
            <People members={d.members} value={list(e.assignees)} label={`Teammates on ${e.title}`} onChange={(v) => { setD({ ...d, events: d.events.map((x) => (x.id === e.id ? { ...x, assignees: v.join(",") } : x)) }); send("POST", `/api/admin/events/${e.id}/people`, { assignees: v }); }} />
            <span className="xs" data-testid="rsvp-headcount">
              <b>{count("yes")} going</b>{count("maybe") ? `, ${count("maybe")} maybe` : ""}{count("no") ? `, ${count("no")} can't go` : ""}{waiting.length ? <span className="muted">, {waiting.length} haven't answered</span> : ""}
            </span>
            <div className="row" style={{ gap: 4 }}>
              {ANSWERS.map(([a, label]) => said(a).map((m) => <span key={m.email + a} title={`${m.name}: ${label}`} style={{ opacity: a === "yes" ? 1 : a === "maybe" ? 0.7 : 0.35 }}><Avatar m={m} size={22} /></span>))}
            </div>
            {upcoming && (
              <div className="row" style={{ gap: 6 }} role="group" aria-label={`Your answer for ${e.title}`}>
                {ANSWERS.map(([a, label]) => (
                  <button key={a} className="pref-chip" aria-pressed={e.rsvps[d.me] === a} data-testid={`rsvp-${a}`}
                    onClick={() => {
                      const answer = e.rsvps[d.me] === a ? "" : a;
                      const rsvps = { ...e.rsvps }; if (answer) rsvps[d.me] = answer; else delete rsvps[d.me];
                      setD({ ...d, events: d.events.map((x) => (x.id === e.id ? { ...x, rsvps } : x)) });
                      send("POST", `/api/admin/events/${e.id}/rsvp`, { answer });
                    }}>{label}</button>
                ))}
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={() => send("DELETE", `/api/admin/events/${e.id}`)} aria-label="Delete meeting"><Trash2 size={15} /></button>
        </div>
      );
    };
    const cal = d.calendar;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return (
      <div className="stack-lg">
        <Head title="Calendar" sub="Meetings with professors, the career center, partners and each other. Tap Going, Maybe or Can't go so everyone sees the headcount." />
        {cal.available && (
          <div className="adm-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }} data-testid="team-gcal">
            {cal.connectedBy
              ? <span className="small"><Check size={14} /> Meetings go to the <b>Remy team</b> Google Calendar automatically, with who's going. Connected by {nameOf(cal.connectedBy)}.</span>
              : <span className="small">Connect the team's shared Google account and every meeting here appears on its <b>Remy team</b> calendar, with the headcount.</span>}
            {cal.connectedBy
              ? <button className="btn btn-ghost btn-sm" onClick={async () => { if (!confirm("Disconnect the team Google Calendar? The Remy team calendar will be deleted from that Google account.")) return; const r = await run(() => api<{ team: Team }>("DELETE", "/api/admin/calendar"), "Disconnected"); if (r) setD(r.team); }}>Disconnect</button>
              : <a className="btn btn-primary btn-sm" href={`/api/calendar/connect?team=1&tz=${encodeURIComponent(tz)}`} data-testid="button-team-gcal">Connect Google Calendar</a>}
          </div>
        )}
        <form className="adm-card adm-form adm-form-5" onSubmit={async (e) => { e.preventDefault(); if (await send("POST", "/api/admin/events", ev, "Meeting added")) setEv({ title: "", date: "", time: "", who: "", assignees: [] }); }}>
          <input className="input" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} placeholder="Meeting, e.g. Career Center partnership" aria-label="Meeting" />
          <input className="input" value={ev.who} onChange={(e) => setEv({ ...ev, who: e.target.value })} placeholder="With whom (outside the team)" aria-label="With whom" />
          <People members={d.members} value={ev.assignees} onChange={(v) => setEv({ ...ev, assignees: v })} label="Teammates on this meeting" />
          <input className="input" type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} aria-label="Date" />
          <input className="input" type="time" value={ev.time} onChange={(e) => setEv({ ...ev, time: e.target.value })} aria-label="Time" />
          <button className="btn btn-primary btn-sm" disabled={!ev.title.trim() || !ev.date}><Plus size={15} /> Add</button>
        </form>
        <section className="adm-card adm-list"><h3>Coming up</h3>{upcoming.map((e) => row(e, true))}{!upcoming.length && <p className="small muted">Nothing scheduled.</p>}</section>
        {past.length > 0 && <section className="adm-card adm-list"><h3>Last 30 days</h3>{past.map((e) => row(e, false))}</section>}
      </div>
    );
  }

  if (tab === "activity") {
    return (
      <div className="stack-lg">
        <Head title="Activity" sub="Who did what on the team, newest first." />
        <section className="adm-card adm-list">
          {d.activity.map((a) => (
            <div key={a.id} className="adm-row">
              <Avatar m={who(a.actor)} size={30} />
              <div className="grow stack-sm" style={{ gap: 2 }}><span className="small"><b>{nameOf(a.actor)}</b> {a.action.toLowerCase()}{a.detail ? <>: <span className="muted">{pretty(a.detail)}</span></> : null}</span><span className="xs muted">{ago(a.at)}</span></div>
            </div>
          ))}
          {!d.activity.length && <Empty title="No activity yet" body="Adding to-dos, finishing them, meetings and hours all show up here." />}
        </section>
      </div>
    );
  }

  return (
    <div className="stack-lg">
      <Head title="Hours" sub="Clock in when you start working on Remy and out when you stop. Each person clocks only themselves." />
      <section className="adm-card stack-sm">
        <h3 className="row"><Clock size={18} /> {d.clockedIn ? `You're clocked in since ${when(d.clockedIn)}` : "You're clocked out"}</h3>
        <div className="row">
          <input className="input grow" value={note} onChange={(e) => setNote(e.target.value)} placeholder={d.clockedIn ? "What did you work on? (optional)" : "What are you working on? (optional)"} aria-label="Note" />
          <button className={"btn btn-sm " + (d.clockedIn ? "btn-secondary" : "btn-primary")} onClick={async () => { if (await send("POST", "/api/admin/clock", { action: d.clockedIn ? "out" : "in", note }, d.clockedIn ? "Clocked out" : "Clocked in")) setNote(""); }} data-testid="button-clock">{d.clockedIn ? "Clock out" : "Clock in"}</button>
        </div>
      </section>
      <section className="adm-card">
        <table className="table"><thead><tr><th>Who</th><th>This week</th><th>All time</th></tr></thead>
          <tbody>{d.hours.map((h) => <tr key={h.member}><td><span className="row" style={{ gap: 8 }}><Avatar m={who(h.member)} size={24} /> {nameOf(h.member)}</span></td><td>{h.week} h</td><td>{h.hours} h</td></tr>)}</tbody></table>
        {!d.hours.length && <p className="small muted">No hours logged yet.</p>}
      </section>
      <section className="adm-card adm-list">
        <h3>Recent entries</h3>
        {d.entries.map((e) => (
          <div key={e.id} className="adm-row">
            <Avatar m={who(e.member)} size={26} />
            <div className="grow stack-sm" style={{ gap: 2 }}>
              <span className="small"><b>{nameOf(e.member)}</b>: {when(e.start_at)} to {e.end_at ? when(e.end_at) : <span className="pass">still working</span>}</span>
              {e.note && <span className="xs muted">{e.note}</span>}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
