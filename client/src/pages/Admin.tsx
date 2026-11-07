import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Activity, AlertTriangle, Bot, ArrowLeft, ArrowRight, BarChart3, Briefcase, CalendarDays, Check, Clock, Database, KanbanSquare, Server, Plus, RotateCcw, Trash2, TrendingUp, UserCheck, Users } from "lucide-react";
import { api, useStore } from "../lib/store";
import { useRoute } from "../lib/router";
import { BetaBadge, CopyButton, Empty, Modal, Remy, Rich, Spinner } from "../components/common";
import { acceptDraft, acceptHtml } from "@shared/acceptEmail";
import { WhatsNew } from "../components/WhatsNew";
import { ThemeToggle } from "../components/ThemeToggle";

// The owners' dashboard (server/admin.ts). Numbers about use, errors students hit, and the team's
// own board, meetings, hours and activity. Never anything a student wrote.
type Overview = {
  northWeek: number; northPrev: number;
  road?: { label: string; n: number }[];
  returnWeek1?: { cohort: number; back: number }; returnWeek4?: { cohort: number; back: number };
  students: number; newWeek: number; newPrev: number; activeWeek: number; activePrev: number; activeToday: number;
  daily: { day: string; n: number }[];
  funnel: { accounts: number; goal: number; resume: number; prefs: number; questions: number; plan: number; setup_done: number; chatted: number; applied: number };
  features: { name: string; students: number; uses: number }[];
  ai: { calls: number; failed: number; cost: number; priced: number; avgMs: number }; openErrors: number; feedback: number;
  emails?: { ready: boolean; reminders: number; digest: number; digestsWeek: number };
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

const TABS = [["overview", "Overview", BarChart3], ["beta", "Beta", UserCheck], ["outcomes", "Outcomes", TrendingUp], ["services", "Services", Server], ["database", "Database", Database], ["openings", "Openings", Briefcase], ["errors", "Errors & feedback", AlertTriangle], ["agents", "Agents", Bot], ["board", "Board", KanbanSquare], ["people", "People", Users], ["calendar", "Calendar", CalendarDays], ["hours", "Hours", Clock], ["activity", "Activity", Activity]] as const;
type Tab = (typeof TABS)[number][0];
// The menu in three groups (Nov 7): students first, then data, then the team's own work.
const NAV_GROUPS: [string, Tab[]][] = [["Students", ["overview", "beta", "outcomes"]], ["Data", ["services", "database", "openings", "errors", "agents"]], ["Team", ["board", "people", "calendar", "hours", "activity"]]];
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
  // Phone: the tabs are one sideways-scrolling row, so bring the open tab into view.
  useEffect(() => { document.querySelector(".adm-nav a[aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [tab]);
  if (!me?.owner) return (
    <div className="landing-screen"><div className="landing-card"><Empty title="Only for Remy's owners" body="Sign in with an owner's email to see this page." action={<a className="btn btn-primary" href="/">Back to Remy</a>} /></div></div>
  );
  return (
    <div className="adm">
      <aside className="adm-nav">
        <span className="logo"><Remy size={26} /> Remy <BetaBadge /></span>
        <span className="xs muted adm-role">Owners</span>
        <nav>
          {NAV_GROUPS.map(([group, keys]) => (
            <div key={group} className="adm-nav-group">
              <span className="adm-nav-label">{group}</span>
              {TABS.filter(([k]) => keys.includes(k)).map(([k, l, Icon]) => <a key={k} href={`/admin?tab=${k}`} aria-current={tab === k ? "page" : undefined}><Icon size={17} /> {l}</a>)}
            </div>
          ))}
        </nav>
        <WhatsNew className="btn btn-ghost btn-sm adm-news" />
        <ThemeToggle className="btn btn-ghost btn-sm adm-theme" label />
        <a className="btn btn-ghost btn-sm adm-back" href="/"><ArrowLeft size={14} /> Back to Remy</a>
      </aside>
      <main className="adm-main">
        {tab === "overview" && <OverviewTab />}
        {tab === "errors" && <ErrorsTab />}
        {tab === "agents" && <AgentsTab />}
        {tab === "beta" && <><FunnelCard /><BetaTab /></>}
        {tab === "outcomes" && <OutcomesTab />}
        {tab === "services" && <ServicesTab />}
        {tab === "database" && <DatabaseTab />}
        {tab === "openings" && <OpeningsTab />}
        {(tab === "board" || tab === "people" || tab === "calendar" || tab === "hours" || tab === "activity") && <TeamTab tab={tab} />}
      </main>
    </div>
  );
}

type AppStatus = "new" | "accepted" | "next" | "declined";
type Application = { email: string; name: string; school: string; major: string; classYear: string; goal: string; stuck: string; tools: string; feedback: string; source: string; terms: string; status: AppStatus; cohort: string; decidedBy: string; decidedAt: string | null; receivedAt: string };
const APP_TABS: [AppStatus, string][] = [["new", "New"], ["accepted", "Accepted"], ["next", "Next cohort"], ["declined", "Declined"]];

/** Applications from the Founding Cohort form, live (checks every 20 seconds while this page is open). */
function Applications({ emailReady, onList }: { emailReady: boolean; onList: (list: BetaRow[]) => void }) {
  const { run, toast } = useStore();
  const [data, setData] = useState<{ applications: Application[]; hookReady: boolean } | null>(null);
  const [show, setShow] = useState<AppStatus>("new");
  const [cohort, setCohort] = useState("Cohort 1");
  const [draft, setDraft] = useState<{ a: Application; subject: string; message: string } | null>(null);
  const [filter, setFilter] = useState<{ school: string; year: string; feedback: boolean }>({ school: "", year: "", feedback: false });
  const [busy, setBusy] = useState("");
  useEffect(() => {
    let on = true;
    const load = () => api<{ applications: Application[]; hookReady: boolean }>("GET", "/api/admin/beta/applications").then((r) => on && setData(r)).catch(() => {});
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 20_000);
    return () => { on = false; clearInterval(t); };
  }, []);
  if (!data) return <Spinner />;
  const decide = async (a: Application, status: AppStatus, mail?: { subject: string; message: string }) => {
    setBusy(a.email);
    const r = await run(() => api<{ applications: Application[]; list: BetaRow[]; invited: boolean; emailError: string }>("POST", `/api/admin/beta/applications/${encodeURIComponent(a.email)}`, { status, cohort: status === "accepted" ? (a.status === "accepted" && a.cohort ? a.cohort : cohort) : "", ...(mail ? { notify: true, ...mail } : {}) }));
    setBusy("");
    if (!r) return;
    setData({ ...data, applications: r.applications });
    onList(r.list);
    setDraft(null);
    if (r.emailError) return toast(r.emailError, true);
    toast(status === "accepted" ? `${a.name || a.email} accepted${r.invited ? " and emailed" : ""}: they can sign in now` : status === "next" ? "Moved to next cohort" : status === "declined" ? "Declined" : "Moved back to New");
  };
  // Accept opens the drafted "You're in" email: edit it, see exactly what they'll get, then send.
  const openDraft = (a: Application) => setDraft({ a, ...acceptDraft({ name: a.name, email: a.email, cohort: a.status === "accepted" && a.cohort ? a.cohort : cohort }) });
  const clearDeclined = async () => {
    if (!confirm("Delete every declined application? Do this once the cohort has closed. It can't be undone.")) return;
    const r = await run(() => api<{ deleted: number; applications: Application[] }>("DELETE", "/api/admin/beta/applications"));
    if (r) { setData({ ...data, applications: r.applications }); toast(`${r.deleted} declined application${r.deleted === 1 ? "" : "s"} deleted`); }
  };
  const all = data.applications;
  const schools = [...new Set(all.map((a) => a.school).filter(Boolean))].sort();
  const years = [...new Set(all.map((a) => a.classYear).filter(Boolean))].sort();
  const rows = all.filter((a) => a.status === show && (!filter.school || a.school === filter.school) && (!filter.year || a.classYear === filter.year) && (!filter.feedback || /^yes/i.test(a.feedback)));
  const tally = (key: "stuck" | "source" | "goal") => Object.entries(all.reduce<Record<string, number>>((m, a) => { const k = a[key] || "—"; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((x, y) => y[1] - x[1]).slice(0, 5);
  return (
    <section className="adm-card stack-sm" data-testid="beta-applications">
      <div className="row-between"><h3>Applications from the form ({all.length})</h3><span className="xs muted">Updates every 20 seconds</span></div>
      {!data.hookReady && <p className="small notice notice-warn">The form isn't connected yet: set OR_BETA_HOOK_SECRET on Render and add the script from docs/beta-form-hook.gs to the form.</p>}
      {all.length > 0 && (
        <div className="small muted stack-sm">
          {(["stuck", "goal", "source"] as const).map((k) => <span key={k}><b>{k === "stuck" ? "Stuck on" : k === "goal" ? "Wants" : "Heard from"}:</b> {tally(k).map(([v, n]) => `${v} (${n})`).join(" · ")}</span>)}
        </div>
      )}
      <div className="seg" role="group" aria-label="Status">
        {APP_TABS.map(([k, l]) => <button key={k} aria-pressed={show === k} onClick={() => setShow(k)} data-testid={`apps-tab-${k}`}>{l} ({all.filter((a) => a.status === k).length})</button>)}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select className="select" style={{ width: 170 }} value={filter.school} onChange={(e) => setFilter({ ...filter, school: e.target.value })} aria-label="School"><option value="">Every school</option>{schools.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="select" style={{ width: 150 }} value={filter.year} onChange={(e) => setFilter({ ...filter, year: e.target.value })} aria-label="Class year"><option value="">Every year</option>{years.map((s) => <option key={s}>{s}</option>)}</select>
        <label className="row small"><input type="checkbox" checked={filter.feedback} onChange={(e) => setFilter({ ...filter, feedback: e.target.checked })} /> Will give feedback</label>
        <span className="row small" style={{ marginLeft: "auto", gap: 6 }}>Accept into <input className="input" style={{ width: 120 }} value={cohort} onChange={(e) => setCohort(e.target.value)} aria-label="Cohort name" /></span>
      </div>
      {draft && (
        <Modal title={`Accept ${draft.a.name || draft.a.email}`} onClose={() => setDraft(null)} wide>
          <div className="stack-sm" data-testid="accept-email">
            <span className="small muted">To: <b>{draft.a.email}</b> · from the Remy email. Edit anything; the preview shows exactly what they'll get.</span>
            <input className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} aria-label="Subject" maxLength={150} />
            <textarea className="textarea" style={{ minHeight: 200 }} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} aria-label="Message" maxLength={5000} data-testid="input-accept-message" />
            <iframe title="Email preview" sandbox="" style={{ width: "100%", height: 460, border: "1px solid var(--line)", borderRadius: 12, background: "#f5f1ec" }} srcDoc={acceptHtml(draft.message, location.host)} />
            {!emailReady && <p className="small notice notice-warn">Email isn't set up on this server, so this can't be sent from here. Accept without email and send it from the Remy inbox instead.</p>}
            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
              {draft.a.status !== "accepted" && <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => decide(draft.a, "accepted")}>Accept without email</button>}
              <button className="btn btn-primary btn-sm" disabled={!!busy || !emailReady || !draft.message.trim()} onClick={() => decide(draft.a, "accepted", { subject: draft.subject, message: draft.message })} data-testid="button-accept-send">{busy ? <Spinner /> : null} {draft.a.status === "accepted" ? "Send email" : "Accept & send email"}</button>
            </div>
          </div>
        </Modal>
      )}
      {rows.map((a) => (
        <div key={a.email} className="adm-person stack-sm" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }} data-testid="row-application">
          <div className="row-between" style={{ gap: 8 }}>
            <div><b>{a.name || "(no name)"}</b> <span className="small muted">· {a.email}</span><div className="small">{[a.school, a.classYear, a.major].filter(Boolean).join(" · ")}</div></div>
            <div className="row" style={{ gap: 6 }}>
              {a.status !== "accepted" ? <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => openDraft(a)} data-testid="button-app-accept">Accept</button>
                : <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => openDraft(a)}>Email them</button>}
              {a.status !== "next" && <button className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => decide(a, "next")}>Next cohort</button>}
              {a.status !== "declined" && <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => decide(a, "declined")}>Decline</button>}
              {a.status !== "new" && <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => decide(a, "new")}>Back to New</button>}
            </div>
          </div>
          <span className="small"><b>Wants:</b> {a.goal || "—"} · <b>Stuck on:</b> {a.stuck || "—"} · <b>Uses:</b> {a.tools || "—"}</span>
          <span className="xs muted">Feedback each week: {a.feedback || "—"} · Heard from: {a.source || "—"} · Applied {ago(a.receivedAt)}{a.decidedAt ? ` · ${a.status}${a.cohort ? ` (${a.cohort})` : ""} by ${a.decidedBy} ${ago(a.decidedAt)}` : ""}{/18|parent/i.test(a.terms) ? "" : " · ⚠ age/terms box not confirmed"}</span>
        </div>
      ))}
      {!rows.length && <p className="small muted">{all.length ? "Nothing here with these filters." : "No applications yet. They appear here seconds after someone submits the form."}</p>}
      {show === "declined" && all.some((a) => a.status === "declined") && <div><button className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={clearDeclined}><Trash2 size={14} /> Delete declined (after the cohort closes)</button></div>}
    </section>
  );
}

type BetaRow = { email: string; note: string; addedBy: string; addedAt: string; invitedAt: string | null };
type BetaData = { on: boolean; formUrl: string; emailReady: boolean; list: BetaRow[] };
/** Founding Cohort: owners paste accepted emails (one per line or comma-separated); Remy can email them "You're in". */
function BetaTab() {
  const { run, toast } = useStore();
  const [d, , setD] = useLoad<BetaData>("/api/admin/beta");
  const [emails, setEmails] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!d) return <Spinner />;
  const add = async () => {
    setBusy(true);
    const r = await run(() => api<BetaData & { added: string[]; already: string[]; wrong: string[]; invited: string[] }>("POST", "/api/admin/beta", { emails, note, notify: notify && d.emailReady }));
    setBusy(false);
    if (!r) return;
    setD({ ...d, list: r.list });
    setEmails("");
    toast([`${r.added.length} accepted`, r.invited.length ? `${r.invited.length} emailed` : "", r.already.length ? `${r.already.length} already on the list` : "", r.wrong.length ? `not emails: ${r.wrong.join(", ")}` : ""].filter(Boolean).join(" · "), r.wrong.length > 0);
  };
  const remove = async (e: string) => {
    if (!confirm(`Remove ${e} from the Founding Cohort? They won't be able to sign in while beta-only mode is on (their saved work stays).`)) return;
    const r = await run(() => api<{ list: BetaRow[] }>("DELETE", `/api/admin/beta/${encodeURIComponent(e)}`), "Removed");
    if (r) setD({ ...d, list: r.list });
  };
  return (
    <div className="stack">
      <Head title="Beta list" sub="Founding Cohort: while beta-only mode is on, only these emails (and the team) can sign in. Students must sign in with the same email they put on the form." />
      <section className="adm-card stack-sm" data-testid="beta-status">
        <span><b>Beta-only mode is {d.on ? "ON" : "OFF"}</b> on this server{d.on ? "" : ": anyone can sign in right now. Turn it on with OR_BETA_ONLY=true in Render's environment settings"}.</span>
        <span className="small muted">Application form: {d.formUrl ? <a href={d.formUrl} target="_blank" rel="noreferrer">{d.formUrl}</a> : "not set (set OR_BETA_FORM_URL; until then students are pointed to remy.careercoach@gmail.com)"}</span>
      </section>
      <Applications emailReady={d.emailReady} onList={(list) => setD({ ...d, list })} />
      <form className="adm-card stack-sm" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <h3>Accept by email (without the form)</h3>
        <textarea className="textarea" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={"Paste emails from the form, one per line or separated by commas"} aria-label="Emails to accept" data-testid="input-beta-emails" />
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. Cohort 1 · tcu-table (optional)" aria-label="Note" maxLength={200} />
        <label className="row small"><input type="checkbox" checked={notify && d.emailReady} disabled={!d.emailReady} onChange={(e) => setNotify(e.target.checked)} /> Email them “You're in” with the sign-in link{d.emailReady ? "" : " (email isn't set up on this server)"}</label>
        <div><button className="btn btn-primary btn-sm" disabled={!emails.trim() || busy} data-testid="button-beta-add">{busy ? <Spinner /> : <Plus size={14} />} Accept</button></div>
      </form>
      <section className="adm-card adm-list">
        <h3>Accepted ({d.list.length})</h3>
        {d.list.map((r) => (
          <div key={r.email} className="row-between" style={{ gap: 8 }} data-testid="row-beta">
            <div className="stack-sm"><b className="small">{r.email}</b><span className="xs muted">{[r.note, `added ${ago(r.addedAt)} by ${r.addedBy}`, r.invitedAt ? `emailed ${ago(r.invitedAt)}` : ""].filter(Boolean).join(" · ")}</span></div>
            <button className="btn btn-ghost btn-sm" onClick={() => remove(r.email)} aria-label={`Remove ${r.email}`}><Trash2 size={14} /> Remove</button>
          </div>
        ))}
        {!d.list.length && <p className="small muted">Nobody yet. Paste emails above once you accept them.</p>}
      </section>
    </div>
  );
}

type Split = { label: string; applied: number; accepted: number };
type Funnel = { applied: number; accepted: number; next: number; declined: number; waiting: number; feedback: number; on_list: number; signed_in: number; set_up: number; active_week: number; bySchool: Split[]; byYear: Split[]; bySource: Split[]; byStuck: Split[] };
const pctOf = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");

/** Founding Cohort funnel: from the form to students actually using Remy this week. */
function FunnelCard() {
  const [d] = useLoad<Funnel>("/api/admin/funnel");
  if (!d) return <Spinner />;
  const steps: [string, number, string][] = [
    ["Applied", d.applied, `${d.waiting} waiting · ${d.next} next cohort · ${d.declined} declined`],
    ["Accepted", d.on_list, `${d.accepted} from the form`],
    ["Signed in", d.signed_in, pctOf(d.signed_in, d.on_list) + " of accepted"],
    ["Finished setup", d.set_up, pctOf(d.set_up, d.signed_in) + " of signed in"],
    ["Active this week", d.active_week, pctOf(d.active_week, d.set_up) + " of set up"],
  ];
  const table = (title: string, rows: Split[]) => (
    <div className="stack-sm"><b className="small">{title}</b>
      {rows.map((r) => <div key={r.label} className="row-between small"><span>{r.label}</span><span className="muted">{r.applied} applied · {r.accepted} in</span></div>)}
      {!rows.length && <span className="small muted">No applications yet.</span>}
    </div>
  );
  return (
    <section className="adm-card stack" data-testid="beta-funnel" style={{ marginBottom: 16 }}>
      <Head title="Founding Cohort" sub="From the form to students using Remy this week. Counts only." />
      <div className="adm-kpis">{steps.map(([l, n, note]) => <Kpi key={l} n={n} label={l} note={note} />)}</div>
      <div className="grid-3" style={{ alignItems: "start" }}>{table("By school", d.bySchool)}{table("By class year", d.byYear)}{table("Heard about Remy from", d.bySource)}</div>
      {table("Where they're stuck", d.byStuck)}
      <span className="xs muted">{d.feedback} of {d.applied} said they'll give feedback each week.</span>
    </section>
  );
}

type Outcomes = { applied: number; answered: number; interviews: number; offers: number; applied_tailored: number; answered_tailored: number; students_applying: number; students_rating: number; ratings: number; students: number };
/** What Remy is for: applications that got answers, interviews and offers, across real students (team left out). */
function OutcomesTab() {
  const [d, reload] = useLoad<Outcomes>("/api/admin/outcomes");
  if (!d) return <Spinner />;
  const plain = d.applied - d.applied_tailored, plainAnswered = d.answered - d.answered_tailored;
  return (
    <div className="stack">
      <Head title="Outcomes" sub="Across real students (the team and its “+” test addresses are left out), from each application's history." action={<button className="btn btn-ghost btn-sm" onClick={() => reload("Up to date")}><RotateCcw size={14} /> Refresh</button>} />
      <div className="adm-kpis">
        <Kpi n={d.applied} label="Applications sent" note={`by ${d.students_applying} of ${d.students} students`} />
        <Kpi n={pctOf(d.answered, d.applied)} label="Got an answer" note={`${d.answered} of ${d.applied}`} />
        <Kpi n={d.interviews} label="Interviews" />
        <Kpi n={d.offers} label="Offers" />
      </div>
      <section className="adm-card stack-sm">
        <h3>Tailored with Remy vs not</h3>
        <span className="small">Materials approved in Remy: <b>{pctOf(d.answered_tailored, d.applied_tailored)}</b> got an answer ({d.answered_tailored} of {d.applied_tailored})</span>
        <span className="small">Not tailored in Remy: <b>{pctOf(plainAnswered, plain)}</b> got an answer ({plainAnswered} of {plain})</span>
        <span className="xs muted">Small numbers swing a lot: wait for 20+ applications on each side before reading anything into it.</span>
      </section>
      <section className="adm-card stack-sm">
        <h3>More like this / Not for me</h3>
        <span className="small"><b>{d.students_rating}</b> of {d.students} students have rated openings ({d.ratings} ratings in all).</span>
      </section>
    </div>
  );
}

type Storage = { usedMb: number; limitMb: number; percent: number; tables: { name: string; mb: number; rows: number }[]; workspaces: { n: number; avg_kb: number; max_kb: number; p90_kb: number }; transfer: { monthMb: number; limitGb: number; days: { day: string; mb: number }[] } };
/** How full the database is against the plan's limit, and what takes the space (Demetre's space watch). */
function DatabaseTab() {
  const [d, reload] = useLoad<Storage>("/api/admin/storage");
  if (!d) return <Spinner />;
  return (
    <div className="stack">
      <Head title="Database" sub={`Supabase Postgres. Limit set to ${d.limitMb} MB (the free plan); past 80% a warning appears on Errors.`} action={<button className="btn btn-ghost btn-sm" onClick={() => reload("Up to date")}><RotateCcw size={14} /> Refresh</button>} />
      <div className="adm-kpis">
        <Kpi n={`${d.percent}%`} label="Space used" note={`${d.usedMb} of ${d.limitMb} MB`} />
        <Kpi n={`${d.workspaces.avg_kb} KB`} label="Average student account" note={`90% under ${d.workspaces.p90_kb} KB · largest ${d.workspaces.max_kb} KB`} />
        <Kpi n={d.workspaces.n} label="Accounts stored" />
        <Kpi n={`${(d.transfer.monthMb / 1024).toFixed(2)} GB`} label="Data transfer this month (estimate)" note={`of ${d.transfer.limitGb} GB on the free plan · ${Math.round((100 * d.transfer.monthMb) / 1024 / d.transfer.limitGb)}%`} />
      </div>
      <section className="adm-card stack-sm">
        <span className="small">Every page a student opens reads their whole account, so account size drives speed and data transfer. The transfer number is Remy's own count of what it read from the database (counting started when this was added); Supabase's bill can differ a little, so check Supabase → Usage → Egress now and then.</span>
        {d.transfer.days.length > 0 && <span className="xs muted">Last days: {d.transfer.days.map((x) => `${x.day.slice(5)} ${x.mb} MB`).join(" · ")}</span>}
      </section>
      <section className="adm-card adm-list">
        <h3>Tables</h3>
        {d.tables.map((t) => <div key={t.name} className="row-between small"><span>{t.name}</span><span className="muted">{t.mb} MB · {t.rows.toLocaleString()} rows</span></div>)}
      </section>
    </div>
  );
}

type Opening = { url: string; title: string; company: string; kind: string; location: string; industry: string; career_path: string; source_name: string; deadline: string; first_seen: string; last_seen: string; times_seen: number; last_checked: string | null; check_result: string | null };
type OpeningsData = { summary: { total: number; closed: number; unchecked: number; companies: number; keepDays: number; byIndustry: { industry: string; n: number }[]; byPath: { career_path: string; n: number }[] }; openings: Opening[] };
/** Every public posting Remy found or re-checked (Demetre's checked-openings record). No student data. */
function OpeningsTab() {
  const [f, setF] = useState({ industry: "", path: "", status: "", company: "" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const [d] = useLoad<OpeningsData>(`/api/admin/openings${qs ? "?" + qs : ""}`);
  if (!d) return <Spinner />;
  const s = d.summary;
  return (
    <div className="stack">
      <Head title="Openings Remy knows" sub={`Public postings Remy found or re-checked, shared across students; kept ${s.keepDays} days after last seen. No student data.`} />
      <div className="adm-kpis">
        <Kpi n={s.total} label="Openings" note={`${s.companies} employers`} />
        <Kpi n={s.closed} label="Look closed" />
        <Kpi n={s.unchecked} label="Not re-checked yet" />
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select className="select" style={{ width: 190 }} value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} aria-label="Industry"><option value="">Every industry</option>{s.byIndustry.map((r) => <option key={r.industry} value={r.industry}>{r.industry || "(none)"} ({r.n})</option>)}</select>
        <select className="select" style={{ width: 190 }} value={f.path} onChange={(e) => setF({ ...f, path: e.target.value })} aria-label="Career path"><option value="">Every career path</option>{s.byPath.map((r) => <option key={r.career_path} value={r.career_path}>{r.career_path || "(none)"} ({r.n})</option>)}</select>
        <select className="select" style={{ width: 150 }} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status"><option value="">Any status</option><option value="open">Open</option><option value="closed">Closed</option><option value="unchecked">Not checked</option></select>
        <input className="input" style={{ width: 180 }} placeholder="Company, then Enter" defaultValue={f.company} onKeyDown={(e) => { if (e.key === "Enter") setF({ ...f, company: (e.target as HTMLInputElement).value.trim() }); }} aria-label="Company (press Enter)" />
      </div>
      <section className="adm-card adm-list">
        {d.openings.map((o) => (
          <div key={o.url} className="row-between small" style={{ gap: 10 }}>
            <span><a href={o.url} target="_blank" rel="noreferrer"><b>{o.title}</b></a> · {o.company}{o.location ? ` · ${o.location}` : ""}<span className="xs muted"> · {[o.industry, o.career_path].filter(Boolean).join(" / ") || "untagged"}</span></span>
            <span className="xs muted" style={{ whiteSpace: "nowrap" }}>{o.check_result === "closed-signal" ? "looks closed" : o.check_result === "reachable" ? "open" : o.check_result || "not checked"} · seen {o.times_seen}× · {ago(o.last_seen)}</span>
          </div>
        ))}
        {!d.openings.length && <p className="small muted">Nothing matches.</p>}
      </section>
    </div>
  );
}

type Services = {
  server: { commit: string; branch: string; instance: string; startedAt: string; uptimeMin: number; memoryMb: number; memoryLimitMb: number; node: string };
  errors: { server: number; browser: number };
  deploys: { available: false } | { available: true; error?: string; deploys?: { status: string; createdAt: string | null; finishedAt: string | null; message: string; commit: string }[] };
  ai: { available: false } | { available: true; error?: string; label?: string; freeTier?: boolean; usage?: number | null; limit?: number | null; remaining?: number | null; usageDaily?: number | null; usageWeekly?: number | null; usageMonthly?: number | null };
  aiChain: { available: boolean; model: string; via: string };
};
const money = (n?: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
/** Is the site healthy, which version is live, recent deploys, and how much AI money is left. Read-only. */
function ServicesTab() {
  const [d, reload] = useLoad<Services>("/api/admin/services");
  if (!d) return <Spinner />;
  const up = d.server.uptimeMin < 90 ? `${d.server.uptimeMin} min` : d.server.uptimeMin < 2880 ? `${Math.round(d.server.uptimeMin / 60)} h` : `${Math.round(d.server.uptimeMin / 1440)} days`;
  const ai = d.ai.available ? d.ai : null;
  const dep = d.deploys.available ? d.deploys : null;
  return (
    <div className="stack">
      <Head title="Services" sub="Render (the server), OpenRouter (AI) and Supabase (database). Read-only." action={<button className="btn btn-ghost btn-sm" onClick={() => reload("Up to date")}><RotateCcw size={14} /> Refresh</button>} />
      <div className="adm-kpis">
        <Kpi n="Up" label="Server" note={`version ${d.server.commit || "local"} · running ${up}`} />
        <Kpi n={`${d.server.memoryMb} MB`} label="Memory in use" note={`of ${d.server.memoryLimitMb} MB on the Render plan`} />
        <Kpi n={d.errors.server + d.errors.browser} label="Errors, last 24 hours" note={`${d.errors.server} server · ${d.errors.browser} from browsers`} />
        <Kpi n={ai && !ai.error ? (ai.remaining != null ? money(ai.remaining) : "No cap") : "—"} label="AI money left on Remy's key" note={ai && !ai.error ? (ai.limit != null ? `${money(ai.usage)} used of ${money(ai.limit)}` : `${money(ai.usage)} used so far; this key has no spending cap`) : ai?.error || "OPENROUTER_API_KEY isn't set"} />
      </div>
      <section className="adm-card stack-sm">
        <h3>Render (server)</h3>
        <span className="small">Live version <b>{d.server.commit || "local build"}</b>{d.server.branch ? ` from ${d.server.branch}` : ""}, started {new Date(d.server.startedAt).toLocaleString()}. A new start time means a deploy or restart happened then.</span>
        {dep?.deploys ? (
          <div className="stack-sm">{dep.deploys.map((x, i) => <div key={i} className="row-between small"><span><b>{x.status}</b> · {x.message || x.commit}</span><span className="xs muted">{x.createdAt ? ago(x.createdAt) : ""}{x.finishedAt && x.createdAt ? ` · took ${Math.max(1, Math.round((Date.parse(x.finishedAt) - Date.parse(x.createdAt)) / 60000))} min` : ""}</span></div>)}</div>
        ) : <span className="xs muted">{dep?.error || "Deploy history and live deploy status need a Render API key (RENDER_API_KEY). Render keys can change the whole account, so it's off; check dashboard.render.com for deploys."}</span>}
      </section>
      <section className="adm-card stack-sm">
        <h3>OpenRouter (AI)</h3>
        <span className="small">AI is {d.aiChain.available ? "on" : "off"}: {d.aiChain.via} · {d.aiChain.model}</span>
        {ai && !ai.error && <span className="small">Spent on this key: today {money(ai.usageDaily)} · this week {money(ai.usageWeekly)} · this month {money(ai.usageMonthly)} · all time {money(ai.usage)}{ai.freeTier ? " · free tier" : ""}</span>}
        <span className="xs muted">The whole account's balance (credits bought minus used) needs an OpenRouter management key, which can create and delete keys, so Remy doesn't hold one: see openrouter.ai/settings/credits. Overview also shows AI spend this week from Remy's own log.</span>
      </section>
      <section className="adm-card stack-sm">
        <h3>Supabase (database)</h3>
        <span className="small">Space, account sizes and Remy's data-transfer estimate are on the <a href="/admin?tab=database">Database</a> page.</span>
      </section>
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
  // Setup step by step (where friend testers stop), then what they did after.
  const steps: [string, number][] = [["Signed up", f.accounts], ["Answered the goal question", f.goal], ["Added a resume", f.resume], ["Reached preferences", f.prefs], ["Reached the questions", f.questions], ["Saw their plan", f.plan], ["Finished setup", f.setup_done], ["Asked Remy something", f.chatted], ["Started an application", f.applied]];
  // 14 days, including days with no sign-ups, so gaps read as gaps.
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 86400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }));
  const byDay = new Map(d.daily.map((x) => [x.day, x.n]));
  const max = Math.max(1, ...days.map((x) => byDay.get(x) || 0));
  return (
    <div className="stack-lg">
      <Head title="Overview" sub="Real students only: team members and their “+” test addresses are left out. Counts, never anything a student wrote." action={<button className="btn btn-ghost btn-sm" onClick={() => reload("Up to date")}><RotateCcw size={14} /> Refresh</button>} />
      <div className="adm-kpis">
        <Kpi n={d.northWeek} label="North star: students who took a career step this week" prev={d.northPrev} />
        {(() => { const r = (x?: { cohort: number; back: number }) => (x && x.cohort ? `${Math.round((100 * x.back) / x.cohort)}%` : "–"); return <>
          <Kpi n={r(d.returnWeek1)} label="Came back in their first week" note={d.returnWeek1?.cohort ? `${d.returnWeek1.back} of ${d.returnWeek1.cohort} who signed up 8–35 days ago` : "Counting visits since Oct 31"} />
          <Kpi n={r(d.returnWeek4)} label="Came back in week 4" note={d.returnWeek4?.cohort ? `${d.returnWeek4.back} of ${d.returnWeek4.cohort} who signed up 29–56 days ago` : "Counting visits since Oct 31"} />
        </>; })()}
        <Kpi n={d.activeWeek} label="Active students this week" prev={d.activePrev} />
        <Kpi n={d.newWeek} label="New sign-ups this week" prev={d.newPrev} />
        <Kpi n={d.students} label="Students in total" note={`${d.activeToday} active today`} />
        <Kpi n={`$${d.ai.cost.toFixed(2)}`} label="AI spend this week" note={d.ai.priced < d.ai.calls ? `${d.ai.calls} calls, ${d.ai.calls - d.ai.priced} without a price` : `${d.ai.calls} calls`} />
        {d.emails && <Kpi n={d.emails.ready ? d.emails.digestsWeek : "Off"} label={d.emails.ready ? "Weekly digests sent this week" : "Emails aren't set up on the server"}
          note={d.emails.ready ? `${d.emails.digest} get the digest, ${d.emails.reminders} get deadline reminders` : "Set SMTP_URL on Render to send reminders and digests"} />}
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
          <h3>Road to an offer: students at each milestone</h3>
          {(d.road || []).map((m) => (
            <div key={m.label} className="adm-funnel">
              <span className="small">{m.label}</span>
              <div><div style={{ width: `${d.students ? (m.n / d.students) * 100 : 0}%` }} /></div>
              <b className="small">{m.n}</b>
              <span className="xs muted">{d.students ? `${Math.round((100 * m.n) / d.students)}%` : ""}</span>
            </div>
          ))}
          <p className="xs muted">The lowest bar is where students get stuck; make that step easier next.</p>
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

type Signals = { days: number; pages: { name: string; n: number }[]; rage: { name: string; n: number }[]; ratings: { place: string; up: number; down: number }[] };
/** What students' browsers reported on their own this week: where they go, what they rage-click, 👍/👎 per feature. */
function SignalsCard() {
  const [d] = useLoad<Signals>("/api/admin/signals");
  if (!d) return null;
  const list = (rows: { name: string; n: number }[], empty: string) => rows.length ? rows.map((r) => <div key={r.name} className="row-between small"><span>{r.name}</span><b>{r.n}</b></div>) : <span className="small muted">{empty}</span>;
  return (
    <section className="adm-card stack-sm" data-testid="signals-card">
      <h3>What students did this week (automatic)</h3>
      <p className="xs muted">Counted by students' browsers: no names and nothing they typed. A rage click is 3+ quick clicks on the same thing; it usually means something looks clickable but doesn't work.</p>
      <div className="grid-3" style={{ alignItems: "start" }}>
        <div className="stack-sm"><b className="small">Pages opened</b>{list(d.pages, "No visits counted yet.")}</div>
        <div className="stack-sm"><b className="small">Rage clicks</b>{list(d.rage, "None. Good sign.")}</div>
        <div className="stack-sm"><b className="small">Was it useful? 👍 / 👎</b>{d.ratings.length ? d.ratings.map((r) => <div key={r.place} className="row-between small"><span>{r.place}</span><span><b>{r.up}</b> 👍 · <b>{r.down}</b> 👎</span></div>) : <span className="small muted">No ratings yet.</span>}</div>
      </div>
    </section>
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
      <Head title="Errors & feedback" sub="What students wrote (Send feedback or a 👎 note), and the errors they hit in the last 30 days, including ones their browsers reported automatically. Mark an error fixed after the fix ships." action={<button className="btn btn-ghost btn-sm" onClick={() => reload("Up to date")}><RotateCcw size={14} /> Refresh</button>} />
      <SignalsCard />
      <section className="adm-card adm-list">
        <h3>Student feedback</h3>
        {d.feedback.length > 1 && (() => {
          const by = new Map<string, number>();
          for (const f of d.feedback) by.set(f.place || "somewhere in Remy", (by.get(f.place || "somewhere in Remy") || 0) + 1);
          return <p className="xs muted">By page: {[...by].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n}`).join(" · ")}</p>;
        })()}
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
  marketing: Run<{ brief: string; linkedin: string; instagram: string; email: { subject: string; body: string } }>;
  retention?: Run<{ quiet: number; noSetup: number; stoppedAt: { step: string; n: number }[] }> };

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
  const fb = d.feedback?.output, wk = d.weekly?.output, sc = d.scout?.output, rs = d.research?.output, mk = d.marketing?.output, rt = d.retention?.output;
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
      {card("retention", "Retention watcher", "Counts students who went quiet (last opened Remy 8–21 days ago) and the step most of them stopped before. Counts only, no names.", rt && (
        <div className="stack-sm">
          <p className="small">{rt.quiet} student{rt.quiet === 1 ? "" : "s"} went quiet; {rt.noSetup} never finished setup.</p>
          {rt.stoppedAt.length > 0 && <ul className="small" style={{ paddingLeft: 18 }}>{rt.stoppedAt.map((x) => <li key={x.step}>Stopped before “{x.step}”: {x.n}</li>)}</ul>}
          {rt.stoppedAt[0] && !added.includes(`Make “${rt.stoppedAt[0].step}” easier`) && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => add(`Make “${rt.stoppedAt[0].step}” easier`)}><Plus size={14} /> Add to board</button>}
        </div>
      ), d.retention ?? null)}
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
