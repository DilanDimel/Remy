import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { FEATURES, RELEASES, releasesOf, type Release } from "@shared/features";
import { AlertTriangle, ArrowLeft, ArrowRight, BarChart3, Briefcase, Check, KanbanSquare, Server, Plus, RotateCcw, Trash2, UserCheck, Users } from "lucide-react";
import { api, fmtDate, useStore } from "../lib/store";
import { useRoute } from "../lib/router";
import { BetaBadge, CopyButton, Empty, Modal, Remy, Rich, Spinner } from "../components/common";
import { acceptDraft, acceptHtml } from "@shared/acceptEmail";
import { WhatsNew } from "../components/WhatsNew";
import { ThemeToggle } from "../components/ThemeToggle";

// The owners' dashboard (server/platform/admin.ts). Numbers about use, errors students hit, and the team's
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
  texts?: { mode: "twilio" | "test"; recent: { at: string; to: string; body: string; mode: string }[] };
  emails?: { ready: boolean; reminders: number; digest: number; digestsWeek: number; nudges?: { sent: number; yes: number; later: number } };
};
type OpenError = { message: string; kind: string; place: string; places?: number; times: number; students: number; last: string; first: string; detail: string };
type Errors = { open: OpenError[]; fixed: { message: string; kind: string; fixed_at: string; fixed_by: string; times: number }[]; feedback: { id: number; at: string; place: string; message: string; email: string; shot?: boolean }[] };
type Status = "todo" | "doing" | "done";
type TeamTask = { id: string; title: string; assignee: string; due: string; notes: string; done: boolean; status: Status; done_by: string; done_at: string | null; created_by: string };
type Answer = "yes" | "maybe" | "no";
type TeamEvent = { id: string; title: string; date: string; time: string; who: string; notes: string; created_by: string; assignees: string; rsvps: Record<string, Answer> };
type Member = { email: string; name: string; founder: boolean; addedBy: string; addedAt: string | null };
type Entry = { id: string; member: string; start_at: string; end_at: string | null; note: string; source?: "clock" | "pr"; ref?: string; ai_cost?: number };
/** docs/ai/ status files and requests between AIs (server/platform/contrib.ts). */
type AiTeam = { people: { name: string; updated: string; workingOn: string[]; claims: { paths: string[]; branch: string; until: string }[] }[]; requests: { id: string; from: string; to: string; date: string; text: string; state: string; pr: string; overdue: boolean; noProof: boolean }[] };
type Team = {
  me: string; members: Member[]; tasks: TeamTask[]; events: TeamEvent[]; hours: { member: string; hours: number; week: number }[]; weeks: { member: string; week: string; hours: number }[];
  entries: Entry[]; ai?: AiTeam; activity: { id: number; at: string; actor: string; action: string; detail: string }[]; clockedIn: string | null;
  calendar: { available: boolean; connectedBy: string; connectedAt: string | null };
};
const ANSWERS: [Answer, string][] = [["yes", "Going"], ["maybe", "Maybe"], ["no", "Can't go"]];

const TABS = [["overview", "Overview", BarChart3], ["beta", "Beta", UserCheck], ["system", "System", Server], ["openings", "Openings", Briefcase], ["errors", "Errors & feedback", AlertTriangle], ["board", "Board & calendar", KanbanSquare], ["team", "Team & hours", Users]] as const;
type Tab = (typeof TABS)[number][0];
// The menu in three groups: students first, then data, then the team's own work (Hours first: the one the team checks).
const NAV_GROUPS: [string, Tab[]][] = [["Students", ["overview", "beta"]], ["Data", ["system", "openings", "errors"]], ["Team", ["team", "board"]]];
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
  // Old links (Services and Database are now System) still open the right tab.
  const raw = query.get("tab") || "overview";
  const tab = ((({ services: "system", database: "system", hours: "team", people: "team", activity: "team", calendar: "board" }) as Record<string, Tab>)[raw] || raw) as Tab;
  // Back from Google's consent screen (team calendar): say how it went, then tidy the address bar.
  useEffect(() => {
    const r = GCAL_RESULT[query.get("gcal") || ""];
    if (!r) return;
    toast(...r);
    history.replaceState(null, "", "/admin?tab=board");
  }, []);
  // Phone: the tabs are one sideways-scrolling row, so bring the open tab into view.
  useEffect(() => { document.querySelector(".adm-nav a[aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [tab]);
  if (!me?.owner) return (
    <div className="landing-screen"><div className="landing-card"><Empty title="Only for Remy's owners" body="Sign in with an owner's email to see this page." action={<a className="btn btn-primary" href="/">Back to Remy</a>} /></div></div>
  );
  return (
    <div className="adm">
      <aside className="adm-nav">
        <span className="logo"><Remy size={26} /><span className="logo-text">Remy<b>.</b></span><BetaBadge /></span>
        <span className="xs muted adm-role">Owners</span>
        <nav>
          {NAV_GROUPS.map(([group, keys]) => (
            <div key={group} className="adm-nav-group">
              <span className="adm-nav-label">{group}</span>
              {keys.map((key) => TABS.find(([k]) => k === key)!).map(([k, l, Icon]) => <a key={k} href={`/admin?tab=${k}`} aria-current={tab === k ? "page" : undefined}><Icon size={17} /> {l}</a>)}
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
        {tab === "beta" && <><FunnelCard /><BetaTab /><UsedCard /></>}
        {tab === "system" && <SystemTab />}
        {tab === "openings" && <OpeningsTab />}
        {(tab === "board" || tab === "team") && <TeamTab tab={tab} />}
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

const RELEASE_NAME: Record<Release, string> = { owners: "Owners only", locked: "Locked: coming soon", released: "Released to everyone" };
/** Feature releases (shared/features.ts): every new feature starts owners-only; one change here releases it, no deploy. */
function Releases() {
  const { config, run, refresh } = useStore();
  const r = releasesOf(config?.features);
  const set = async (key: string, state: Release) => {
    const f = FEATURES.find((x) => x.key === key)!;
    const ask = f.path ? `Release ${f.label} to every student? They get the full working page right away.`
      : f.key === "app" ? `Release the phone app to every student? Students who sign in to the app get in right away instead of seeing "The new app is almost here".`
      : `Release ${f.label} to every student? Everyone gets the new design and features right away. Owners-only features below stay with owners.`;
    if (state === "released" && !confirm(ask)) return;
    if (await run(() => api("POST", "/api/admin/features", { key, state }), `${f.label}: ${RELEASE_NAME[state]}`)) await refresh();
  };
  return (
    <section className="adm-card stack-sm" data-testid="feature-releases">
      <h3>Feature releases</h3>
      <span className="small muted">New features are built for owners first. Lock one to show students it's coming, or release it to everyone. Changes reach students within a minute, with no deploy. Switch to student view to preview.</span>
      {FEATURES.filter((f) => !f.follows).map((f) => ( // Rewards rides with The Big Upgrade
        <div key={f.key} className="feat-row">
          <div><b>{f.label}</b> <span className="small muted">{f.path || (f.key === "app" ? "iPhone and Android" : "every page")}</span></div>
          <select className="select" style={{ width: 260, maxWidth: "100%" }} value={r[f.key]} onChange={(e) => set(f.key, e.target.value as Release)} aria-label={`${f.label} release`} data-testid={`select-release-${f.key}`}>
            {RELEASES.filter((st) => f.path || st !== "locked").map((st) => <option key={st} value={st}>{RELEASE_NAME[st]}</option>)}
          </select>
        </div>
      ))}
    </section>
  );
}

type BetaRow = { email: string; note: string; addedBy: string; addedAt: string; invitedAt: string | null };
type BetaData = { on: boolean; inviteOnly: boolean; open: boolean; formUrl: string; emailReady: boolean; list: BetaRow[] };
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
  // The instant-access switch (Nov 24): one click opens Remy to everyone, one click goes back to apply-first.
  const flip = async () => {
    const open = !d.open;
    if (!confirm(open
      ? "Let everyone sign in right away? Anyone can create an account without applying. Tailoring is capped at 5 a day, Beta Insider invites and the Feedback button turn on for students, and everyone agrees to the updated beta terms once."
      : "Go back to invite-only? Only accepted emails and the team can sign in again; everyone else sees the apply link. Their saved work stays.")) return;
    const r = await run(() => api<BetaData>("POST", "/api/admin/beta/open", { open }), open ? "Remy is open to everyone" : "Back to invite-only");
    if (r) setD(r);
  };
  const remove = async (e: string) => {
    if (!confirm(`Remove ${e} from the Founding Cohort? They won't be able to sign in while beta-only mode is on (their saved work stays).`)) return;
    const r = await run(() => api<{ list: BetaRow[] }>("DELETE", `/api/admin/beta/${encodeURIComponent(e)}`), "Removed");
    if (r) setD({ ...d, list: r.list });
  };
  return (
    <div className="stack">
      <Head title="Beta list" sub="Who can sign in. While Remy is invite-only, only these emails (and the team) can sign in, with the same email they put on the form. Once it is open to everyone, this list and the applications are kept but no longer needed to get in." />
      <section className="adm-card stack-sm" data-testid="beta-status">
        <div className="row-between" style={{ gap: 12, flexWrap: "wrap" }}>
          <span className="stack-sm" style={{ flex: "1 1 260px" }}>
            <b>{d.open ? "Open to everyone: anyone can sign in right away" : d.on ? "Invite-only: students apply, then sign in" : "Anyone can sign in (beta-only mode is off on this server)"}</b>
            <span className="small muted">{d.open
              ? "No application needed. Tailoring is capped at 5 a day per student, Beta Insider invites go out after 3 days of use, and every page has a Feedback button. The Free during beta label stays."
              : "Open Remy to let anyone sign in without applying (with a daily cap on tailoring and Beta Insider invites). You can switch back to invite-only at any time."}</span>
          </span>
          <button className={"btn btn-sm " + (d.open ? "btn-secondary" : "btn-primary")} onClick={flip} data-testid="button-beta-open-toggle">{d.open ? "Back to invite-only" : "Let everyone in"}</button>
        </div>
        {!d.inviteOnly && !d.open && <span className="small muted">Beta-only mode is off on this server (OR_BETA_ONLY isn't true), so anyone can already sign in.</span>}
        <span className="small muted">Application form: {d.formUrl ? <a href={d.formUrl} target="_blank" rel="noreferrer" style={{ overflowWrap: "anywhere" }}>{d.formUrl}</a> : "not set (set OR_BETA_FORM_URL; until then students are pointed to hello@remyai.org)"}</span>
      </section>
      <Releases />
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
type Storage = { usedMb: number; limitMb: number; percent: number; tables: { name: string; mb: number; rows: number }[]; workspaces: { n: number; avg_kb: number; max_kb: number; p90_kb: number }; transfer: { monthMb: number; limitGb: number; days: { day: string; mb: number }[] } };
type Opening = { url: string; title: string; company: string; kind: string; location: string; industry: string; career_path: string; source_name: string; deadline: string; first_seen: string; last_seen: string; times_seen: number; last_checked: string | null; check_result: string | null };
type OpeningsData = { summary: { total: number; closed: number; unchecked: number; companies: number; keepDays: number; byIndustry: { industry: string; n: number }[]; byPath: { career_path: string; n: number }[] }; openings: Opening[] };
/** Every public posting Remy found or re-checked (Demetre's checked-openings record). No student data. */
function OpeningsTab() {
  const [f, setF] = useState({ industry: "", path: "", status: "", company: "" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const [d] = useLoad<OpeningsData>(`/api/admin/openings${qs ? "?" + qs : ""}`);
  if (!d) return <div className="row"><Spinner /> Loading…</div>;
  const s = d.summary;
  const open = Math.max(0, s.total - s.closed - s.unchecked);
  const filtered = Object.values(f).some(Boolean);
  const bars = (rows: { name: string; n: number }[], on: string, pick: (v: string) => void, id: string, top = 6) => {
    const max = Math.max(1, ...rows.map((r) => r.n));
    return <div className="adm2-bars">{rows.slice(0, top).map((r) => <button key={r.name} className={"adm2-bar" + (on === r.name ? " drop" : "")} onClick={() => pick(on === r.name ? "" : r.name)} aria-pressed={on === r.name} data-testid={`${id}-${r.name || "none"}`}><span className="adm-ellipsis" title={r.name || "(none)"}>{r.name || "(none)"}</span><div><i style={{ width: `${(r.n / max) * 100}%` }} /></div><b>{r.n}</b></button>)}</div>;
  };
  return (
    <div className="adm2 adm2-full adm2-fixed">
      <div className="adm-head">
        <div><h1 className="adm-hello">Openings</h1><p className="adm2-say"><b>{plural(s.total, "opening")} from {plural(s.companies, "employer")}.</b> Public postings only, kept {s.keepDays} days after last seen.</p></div>
      </div>
      <div className="adm2-tiles">
        <div className="adm2-tile"><strong>{s.total}</strong><span className="adm2-tl">Openings</span><span className="adm2-ts">shared across students</span></div>
        <div className="adm2-tile"><strong>{open}</strong><span className="adm2-tl">Checked, not closed</span><span className="adm2-ts">re-checked at least once</span></div>
        <div className="adm2-tile"><strong>{s.unchecked}</strong><span className="adm2-tl">Not re-checked yet</span><span className="adm2-ts">link not opened since found</span></div>
        <div className="adm2-tile"><strong>{s.closed}</strong><span className="adm2-tl">Look closed</span><span className="adm2-ts">posting seems taken down</span></div>
      </div>
      <div className="adm2-row adm2-row-sys">
        <section className="adm2-card" data-testid="openings-list">
          <div className="adm2-h"><h3>{filtered ? `${plural(d.openings.length, "match", "matches")}` : "Latest openings"}</h3>
            <div className="adm2-seg" role="group" aria-label="Status">
              {([["", "All"], ["open", "Open"], ["unchecked", "Not checked"], ["closed", "Closed"]] as const).map(([k, l]) => <button key={k} aria-pressed={f.status === k} onClick={() => setF({ ...f, status: k })} data-testid={`openings-status-${k || "all"}`}>{l}</button>)}
            </div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input className="input grow" placeholder="Search a company, then Enter" defaultValue={f.company} onKeyDown={(e) => { if (e.key === "Enter") setF({ ...f, company: (e.target as HTMLInputElement).value.trim() }); }} aria-label="Company (press Enter)" data-testid="input-openings-company" />
            {filtered && <button className="btn btn-ghost btn-sm" onClick={() => setF({ industry: "", path: "", status: "", company: "" })} data-testid="button-openings-clear">Clear</button>}
          </div>
          <div className="adm2-scroll adm-list">
            {d.openings.map((o) => (
              <div key={o.url} className="adm2-open">
                <div className="grow" style={{ minWidth: 0 }}>
                  <a href={o.url} target="_blank" rel="noreferrer" className="adm-ellipsis"><b>{o.title}</b></a>
                  <span className="xs muted adm-ellipsis">{o.company}{o.location ? ` · ${o.location}` : ""} · {[o.industry, o.career_path].filter(Boolean).join(" / ") || "untagged"}</span>
                </div>
                <span className="xs muted" style={{ whiteSpace: "nowrap", textAlign: "right" }}>{o.check_result === "closed-signal" ? "looks closed" : o.check_result === "reachable" ? "open" : o.check_result || "not checked"}<br />seen {o.times_seen}× · {ago(o.last_seen)}</span>
              </div>
            ))}
            {!d.openings.length && <Empty title="Nothing matches" body="Try another filter, or Clear." />}
          </div>
        </section>
        <div className="adm2-col">
          <section className="adm2-card">
            <div className="adm2-h"><h3>By industry</h3><span className="xs muted">tap to filter</span></div>
            {s.byIndustry.length ? bars(s.byIndustry.map((r) => ({ name: r.industry, n: r.n })), f.industry, (v) => setF({ ...f, industry: v }), "openings-industry") : <span className="small muted">No openings yet.</span>}
          </section>
          <section className="adm2-card grow">
            <div className="adm2-h"><h3>By career path</h3><span className="xs muted">tap to filter</span></div>
            {s.byPath.length ? bars(s.byPath.map((r) => ({ name: r.career_path, n: r.n })), f.path, (v) => setF({ ...f, path: v }), "openings-path", 5) : <span className="small muted">No openings yet.</span>}
          </section>
        </div>
      </div>
    </div>
  );
}

type Services = {
  server: { commit: string; branch: string; instance: string; startedAt: string; uptimeMin: number; memoryMb: number; memoryLimitMb: number; node: string };
  errors: { server: number; browser: number };
  deploys: { available: false } | { available: true; error?: string; deploys?: { status: string; createdAt: string | null; finishedAt: string | null; message: string; commit: string }[] };
  ai: { available: false } | { available: true; error?: string; label?: string; freeTier?: boolean; usage?: number | null; limit?: number | null; remaining?: number | null; usageDaily?: number | null; usageWeekly?: number | null; usageMonthly?: number | null };
  aiChain: { available: boolean; model: string; via: string; ownerTrial?: string };
};
const money = (n?: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
/** Services and Database in one place (Nov 24): is everything up, what does it cost, and is the database within its plan. Read-only. */
function SystemTab() {
  const [d, reload] = useLoad<Services>("/api/admin/services");
  const [s, reloadS] = useLoad<Storage>("/api/admin/storage");
  const [o] = useLoad<Overview>("/api/admin/overview");
  const [tables, setTables] = useState(false);
  if (!d || !s) return <div className="row"><Spinner /> Loading…</div>;
  const up = d.server.uptimeMin < 90 ? `${d.server.uptimeMin} min` : d.server.uptimeMin < 2880 ? `${Math.round(d.server.uptimeMin / 60)} h` : `${Math.round(d.server.uptimeMin / 1440)} days`;
  const ai = d.ai.available && !d.ai.error ? d.ai : null;
  const dep = d.deploys.available ? d.deploys : null;
  const tp = Math.round((100 * s.transfer.monthMb) / 1024 / s.transfer.limitGb);
  const memP = d.server.memoryLimitMb ? d.server.memoryMb / d.server.memoryLimitMb : 0;
  const aiLow = ai && ai.limit != null && ai.remaining != null && ai.remaining < ai.limit * 0.2;
  const dot = (warn: boolean) => <span className={"adm2-dot" + (warn ? " warn" : "")} aria-label={warn ? "needs a look" : "fine"} />;
  const watch = [tp >= 80 && "database transfer is over the free plan", s.percent >= 80 && "the database is almost full", memP >= 0.8 && "memory is almost full", aiLow && "AI money is running low"].filter(Boolean) as string[];
  const maxDay = Math.max(1, ...s.transfer.days.map((x) => x.mb));
  const dayLimit = (s.transfer.limitGb * 1024) / 30;
  const refresh = () => { reload("Up to date"); reloadS(); };
  return (
    <div className="adm2 adm2-full">
      <div className="adm-head">
        <div><h1 className="adm-hello">System</h1><p className="adm2-say"><b>{watch.length ? "Everything is up." : "Everything is up and within its plan."}</b>{watch.length ? ` To watch: ${watch.join(", ")}.` : ""}</p></div>
        <button className="btn btn-ghost btn-sm" onClick={refresh} data-testid="button-system-refresh"><RotateCcw size={14} /> Refresh</button>
      </div>
      <div className="adm2-tiles">
        <div className="adm2-tile"><strong>Up</strong>{dot(false)}<span className="adm2-tl">Server (Render)</span><span className="adm2-ts">version {d.server.commit || "local"} · running {up}</span></div>
        <div className="adm2-tile"><strong>{d.server.memoryMb} MB</strong>{dot(memP >= 0.8)}<span className="adm2-tl">Memory in use</span><span className="adm2-ts">of {d.server.memoryLimitMb} MB on the plan</span></div>
        <div className="adm2-tile"><strong>{ai ? (ai.remaining != null ? money(ai.remaining) : "No cap") : "—"}</strong>{dot(!!aiLow)}<span className="adm2-tl">AI money left</span><span className="adm2-ts">{ai ? (ai.limit != null ? `${money(ai.usage)} used of ${money(ai.limit)}` : `${money(ai.usage)} used so far`) : (d.ai.available && d.ai.error) || "OPENROUTER_API_KEY isn't set"}</span></div>
        <div className="adm2-tile"><strong>{s.percent}%</strong>{dot(s.percent >= 80)}<span className="adm2-tl">Database space</span><span className="adm2-ts">{s.usedMb} of {s.limitMb} MB · avg account {s.workspaces.avg_kb} KB</span></div>
      </div>
      <div className="adm2-row adm2-row-sys">
        <section className="adm2-card" data-testid="system-transfer">
          <div className="adm2-h"><h3>{dot(tp >= 80)} Data transfer this month</h3><span className="xs muted">{(s.transfer.monthMb / 1024).toFixed(1)} GB of {s.transfer.limitGb} GB · {tp}%</span></div>
          {s.transfer.days.length > 0 && (
            <div className="adm2-cols" role="img" aria-label={`Data read per day: ${s.transfer.days.map((x) => `${x.day.slice(5)} ${x.mb} MB`).join(", ")}`}>
              {s.transfer.days.map((x) => <div key={x.day} title={`${x.day.slice(5)}: ${x.mb} MB`}><i className={x.mb > dayLimit ? "over" : ""} style={{ height: `${Math.max(2, (x.mb / maxDay) * 80)}px` }} /><small>{Number(x.day.slice(8))}</small></div>)}
            </div>
          )}
          <p className="adm2-note"><b>Orange days read more than the free plan allows per day ({Math.round(dayLimit)} MB).</b> Every page a student opens reads their account, so account size drives this. It's Remy's own count; Supabase → Usage → Egress has the billed number.</p>
          <div className="adm2-h"><h3>Biggest tables</h3><button className="btn btn-ghost btn-sm" onClick={() => setTables(true)} data-testid="button-all-tables">All {s.tables.length} <ArrowRight size={14} /></button></div>
          <div className="adm2-list">{s.tables.slice(0, 5).map((t) => <div key={t.name}><code>{t.name}</code><b>{t.mb} MB</b><span>{t.rows.toLocaleString()} rows</span></div>)}</div>
        </section>
        <div className="adm2-col">
          <section className="adm2-card" data-testid="system-ai">
            <div className="adm2-h"><h3>AI</h3><span className="xs muted">{d.aiChain.available ? "on" : "off"}</span></div>
            <span className="small muted">{d.aiChain.via} · {d.aiChain.model}{d.aiChain.ownerTrial ? ` · owners are trying ${d.aiChain.ownerTrial}` : ""}</span>
            <div className="adm2-nums">
              <div><b>{o ? o.ai.calls : "…"}</b><span>calls this week{o ? `, ${o.ai.failed} failed` : ""}</span></div>
              <div><b>{ai ? money(ai.usageWeekly) : "—"}</b><span>{ai ? `this week · today ${money(ai.usageDaily)} · month ${money(ai.usageMonthly)}` : "spend"}</span></div>
            </div>
          </section>
          <section className="adm2-card grow" data-testid="admin-texts">
            <div className="adm2-h"><h3>Emails &amp; texts</h3><span className="xs muted">errors last 24 h: {d.errors.server + d.errors.browser}</span></div>
            {o?.emails && (
              <div className="adm2-list">
                <div><span>Deadline reminders</span><b>{o.emails.ready ? `${o.emails.reminders} students` : "off"}</b></div>
                <div><span>Weekly digest</span><b>{o.emails.ready ? `${o.emails.digestsWeek} this week · ${o.emails.digest} get it` : "off"}</b></div>
                {o.emails.nudges && <div><span>Match emails (owners)</span><b>{o.emails.nudges.sent} sent · {o.emails.nudges.yes} Yes</b></div>}
              </div>
            )}
            {o?.emails && !o.emails.ready && <span className="xs muted">Set SMTP_URL on Render to send reminders and digests.</span>}
            {o?.texts && <div className="adm2-list"><div><span>Urgent texts</span><b>{o.texts.mode === "test" ? "test mode: nothing is sent" : `Twilio · ${o.texts.recent.length} recent`}</b></div></div>}
            <div className="adm2-links">
              <a className="btn btn-ghost btn-sm" href="https://dashboard.render.com" target="_blank" rel="noreferrer">Render ↗</a>
              <a className="btn btn-ghost btn-sm" href="https://openrouter.ai/settings/credits" target="_blank" rel="noreferrer">OpenRouter credits ↗</a>
              <a className="btn btn-ghost btn-sm" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Supabase usage ↗</a>
            </div>
          </section>
        </div>
      </div>
      {tables && (
        <Modal title="Tables, server and messages" onClose={() => setTables(false)}>
          <div className="adm2-list">{s.tables.map((t) => <div key={t.name}><code>{t.name}</code><b>{t.mb} MB</b><span>{t.rows.toLocaleString()} rows</span></div>)}</div>
          <p className="xs muted">{s.workspaces.n} accounts stored · 90% under {s.workspaces.p90_kb} KB · largest {s.workspaces.max_kb} KB. Live version {d.server.commit || "local build"}{d.server.branch ? ` from ${d.server.branch}` : ""}, started {new Date(d.server.startedAt).toLocaleString()}.</p>
          {dep?.deploys ? dep.deploys.map((x, i) => <div key={i} className="row-between small"><span><b>{x.status}</b> · {x.message || x.commit}</span><span className="xs muted">{x.createdAt ? ago(x.createdAt) : ""}</span></div>) : <p className="xs muted">{dep?.error || "Deploy history needs a Render API key (RENDER_API_KEY), which is off on purpose; check dashboard.render.com for deploys."}</p>}
          {o?.texts?.recent.length ? <ul className="stack-sm small">{o.texts.recent.map((x) => <li key={x.at + x.to}><span className="muted">{fmtDate(x.at.slice(0, 10))} to {x.to}{x.mode === "test" ? " (test)" : ""}:</span> {x.body}</li>)}</ul> : null}
        </Modal>
      )}
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

const greeting = () => {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Chicago" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
const pct = (x?: { cohort: number; back: number }) => (x && x.cohort ? `${Math.round((100 * x.back) / x.cohort)}%` : "–");
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

type Waiting = { applications: { status: string }[] };
/** Remy's one thing for the owner right now: the first rule that fires, most urgent first. */
function oneThing(d: Overview, s: Storage | null, steps: [string, number][]): { key: string; title: string; body: string; big?: string; sub?: string; href: string; cta: string } | null {
  const tp = s ? Math.round((100 * s.transfer.monthMb) / 1024 / s.transfer.limitGb) : 0;
  if (s && tp >= 80) return { key: `transfer-${tp >= 100 ? "over" : "near"}`, title: `Database transfer is at ${tp}% of the free plan.`, body: `Students read ${(s.transfer.monthMb / 1024).toFixed(1)} GB this month against Supabase's ${s.transfer.limitGb} GB. Check Supabase → Usage before it gets billed or slowed down.`, big: `${tp}%`, sub: `of ${s.transfer.limitGb} GB`, href: "/admin?tab=system", cta: "Open System" };
  if (s && s.percent >= 80) return { key: "space", title: `The database is ${s.percent}% full.`, body: `${s.usedMb} of ${s.limitMb} MB used. The biggest table is ${s.tables[0]?.name || "workspaces"}.`, big: `${s.percent}%`, sub: "full", href: "/admin?tab=system", cta: "Open System" };
  if (d.openErrors) return { key: `errors-${d.openErrors}`, title: `${plural(d.openErrors, "error")} students hit ${d.openErrors === 1 ? "is" : "are"} open.`, body: "Look at what happened, fix it, then mark it fixed so the count stays honest.", big: String(d.openErrors), sub: "open", href: "/admin?tab=errors", cta: "Open errors" };
  if (d.feedback) return { key: `feedback-${d.feedback}`, title: `${plural(d.feedback, "student")} sent feedback.`, body: "Read it while it's fresh; it's the clearest signal of what to fix next.", big: String(d.feedback), sub: "new", href: "/admin?tab=errors", cta: "Read feedback" };
  // The biggest drop between two setup steps, when at least two students were lost there.
  let drop: [string, number, number] | null = null;
  for (let i = 1; i < steps.length; i++) { const lost = steps[i - 1][1] - steps[i][1]; if (lost >= 2 && (!drop || lost > drop[1] - drop[2])) drop = [steps[i][0], steps[i - 1][1], steps[i][1]]; }
  if (drop) return { key: `drop-${drop[0]}-${drop[2]}`, title: `Most students stop before "${drop[0].toLowerCase()}".`, body: `${drop[1]} reached the step before it, ${drop[2]} got past it. Making this step easier helps the most students.`, big: `${drop[1]} → ${drop[2]}`, href: "/admin?tab=overview", cta: "" };
  return null;
}

function OverviewTab() {
  const { me } = useStore();
  const [d, reload] = useLoad<Overview>("/api/admin/overview");
  const [t] = useLoad<Team>("/api/admin/team");
  const [o] = useLoad<Outcomes>("/api/admin/outcomes");
  const [s] = useLoad<Storage>("/api/admin/storage");
  const [w] = useLoad<Waiting>("/api/admin/beta/applications");
  const [allSteps, setAllSteps] = useState(false);
  const [hidden, setHidden] = useState(() => { try { return JSON.parse(localStorage.getItem("adm-one-hidden") || "{}") as Record<string, number>; } catch { return {}; } });
  if (!d) return <div className="row"><Spinner /> Loading…</div>;
  const f = d.funnel;
  // Setup step by step (where friend testers stop), then what they did after.
  const steps: [string, number][] = [["Signed up", f.accounts], ["Answered the goal question", f.goal], ["Added a resume", f.resume], ["Reached preferences", f.prefs], ["Reached the questions", f.questions], ["Saw their plan", f.plan], ["Finished setup", f.setup_done], ["Asked Remy something", f.chatted], ["Started an application", f.applied]];
  const days = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 86400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }));
  const byDay = new Map(d.daily.map((x) => [x.day, x.n]));
  const signups = days.map((x) => byDay.get(x) || 0);
  const first = (me?.name || "").split(" ")[0];
  const myTodos = t ? t.tasks.filter((x) => x.status !== "done" && list(x.assignee).includes(t.me)).length : 0;
  const waiting = w ? w.applications.filter((a) => a.status === "new").length : 0;
  const needs: [string, string, number, string, string][] = [
    ["Open errors", "/admin?tab=errors", d.openErrors, "students hit these", "errors"],
    ["New feedback", "/admin?tab=errors", d.feedback, "from the feedback button", "feedback"],
    ["Applications waiting", "/admin?tab=beta", waiting, "to accept or decline", "applications"],
    ["Your to-dos", "/admin?tab=board", myTodos, "on the team board", "todos"],
  ];
  const open = needs.filter((n) => n[2]).length;
  const one = oneThing(d, s, steps);
  const showOne = one && !(hidden[one.key] > Date.now());
  const hide = () => { if (!one) return; const next = { ...hidden, [one.key]: Date.now() + 86400_000 }; setHidden(next); try { localStorage.setItem("adm-one-hidden", JSON.stringify(next)); } catch {} };
  const step = d.northWeek - d.northPrev;
  const line = d.activeWeek === 0 ? "Quiet week so far: no student has opened Remy yet."
    : `${plural(d.activeWeek, "student")} opened Remy this week${d.newWeek ? `, ${d.newWeek} of them new` : ""}.`;
  const after = open ? ` ${open === 1 ? "One thing needs" : `${open} things need`} you.` : " Nothing needs you right now.";
  // The steps that tell the story; "All steps" shows the rest.
  const short = steps.filter(([l]) => ["Signed up", "Finished setup", "Asked Remy something", "Started an application"].includes(l));
  const road = d.road || [];
  const interviewing = road.find((m) => /interview/i.test(m.label) && !/stor/i.test(m.label));
  const story: [string, number][] = interviewing ? [...short, ["Interviewing", interviewing.n]] : short;
  const dropAt = (rows: [string, number][]) => { let at = -1, most = 0; rows.forEach(([, v], i) => { const lost = i ? rows[i - 1][1] - v : 0; if (lost > most) { most = lost; at = i; } }); return at; };
  const di = dropAt(story);
  const hours = t ? t.hours.reduce((x, y) => x + y.week, 0) : 0;
  const Spark = ({ v, on }: { v: number[]; on: number }) => { const m = Math.max(1, ...v); return <span className="adm2-spark" aria-hidden>{v.map((n, i) => <i key={i} className={i >= on ? "on" : ""} style={{ height: `${Math.max(2, (n / m) * 30)}px` }} />)}</span>; };
  const Bars = ({ rows, max, at }: { rows: [string, number][]; max: number; at: number }) => (
    <div className="adm2-bars">{rows.map(([l, v], i) => <div key={l} className={"adm2-bar" + (i === at ? " drop" : "")}><span>{l}</span><div><i style={{ width: `${max ? (v / max) * 100 : 0}%` }} /></div><b>{v}</b></div>)}</div>
  );
  return (
    <div className="adm2">
      <div className="adm-head">
        <div><h1 className="adm-hello">{greeting()}{first ? `, ${first}` : ""}.</h1><p className="adm2-say"><b>{line}</b>{after}</p></div>
        <button className="btn btn-ghost btn-sm" onClick={() => reload("Up to date")} data-testid="button-overview-refresh"><RotateCcw size={14} /> Refresh</button>
      </div>
      <div className="adm2-top">
        {showOne && one ? (
          <section className="adm2-one" data-testid="admin-hero">
            <div className="grow">
              <span className="adm2-who"><Remy size={22} /> Remy says: one thing right now</span>
              <h2>{one.title}</h2>
              <p>{one.body}</p>
              <div className="row">
                {one.cta && <a className="btn btn-primary btn-sm" href={one.href} data-testid="button-one-thing">{one.cta}</a>}
                <button className="btn btn-ghost btn-sm" onClick={hide} data-testid="button-one-thing-hide">Got it, hide for a day</button>
              </div>
            </div>
            {one.big && <div className="adm2-big"><b>{one.big}</b>{one.sub && <span className="xs muted">{one.sub}</span>}</div>}
          </section>
        ) : (
          <section className="adm2-one" data-testid="admin-hero">
            <div className="grow">
              <span className="adm2-who"><Remy size={22} /> North star this week</span>
              <h2>{plural(d.northWeek, "student")} took a career step.</h2>
              <p>{step > 0 ? `${step} more than last week` : step < 0 ? `${-step} fewer than last week` : "Same as last week"}. Real students only; counts, never anything a student wrote.</p>
            </div>
            <div className="adm2-big"><b>{d.northWeek}</b></div>
          </section>
        )}
        <section className="adm2-card">
          <div className="adm2-h"><h3>Needs you</h3><span className="xs muted">{open ? `${open} of ${needs.length}` : "all clear"}</span></div>
          <div className="adm2-needs">
            {needs.map(([label, href, n, why, id]) => (
              <a key={label} href={href} className={n ? "hot" : ""} data-testid={`need-${id}`}><b>{n}</b><span>{label}</span><small>{n ? why : "all clear"}</small><ArrowRight size={14} /></a>
            ))}
          </div>
        </section>
      </div>
      <div className="adm2-tiles">
        <div className="adm2-tile"><strong>{d.activeWeek}</strong><span className="adm2-tl">Active students</span><span className="adm2-ts"><Delta n={d.activeWeek - d.activePrev} /> · {d.students} in total, {d.activeToday} today</span></div>
        <div className="adm2-tile"><strong>{d.newWeek}</strong><Spark v={signups} on={7} /><span className="adm2-tl">New sign-ups</span><span className="adm2-ts"><Delta n={d.newWeek - d.newPrev} /> · last 14 days</span></div>
        <div className="adm2-tile"><strong>{d.northWeek}</strong><span className="adm2-tl">Took a career step</span><span className="adm2-ts">North star · <Delta n={step} /></span></div>
        <div className="adm2-tile"><strong>{pct(d.returnWeek1)}</strong><span className="adm2-tl">Came back in week 1</span><span className="adm2-ts">{d.returnWeek1?.cohort ? `${d.returnWeek1.back} of ${d.returnWeek1.cohort}` : "counting"} · week 4: {pct(d.returnWeek4)}</span></div>
      </div>
      <div className="adm2-row">
        <section className="adm2-card">
          <div className="adm2-h"><h3>Where students get stuck</h3><button className="btn btn-ghost btn-sm" onClick={() => setAllSteps(true)} data-testid="button-all-steps">All steps <ArrowRight size={14} /></button></div>
          <Bars rows={story} max={f.accounts} at={di} />
          {di > 0 && <p className="adm2-note"><b>Biggest drop: {story[di][0].toLowerCase()} ({story[di - 1][1]} → {story[di][1]}).</b> Making that step easier helps the most students.</p>}
        </section>
        <section className="adm2-card" data-testid="admin-outcomes">
          <div className="adm2-h"><h3>Do students get jobs?</h3><span className="xs muted">all time</span></div>
          {o ? (
            <div className="adm2-nums">
              <div><b>{o.applied}</b><span>{o.applied === 1 ? "application" : "applications"} sent, by {o.students_applying} of {o.students}</span></div>
              <div><b>{pctOf(o.answered, o.applied)}</b><span>got an answer · tailored in Remy {pctOf(o.answered_tailored, o.applied_tailored)}</span></div>
              <div><b>{o.interviews}</b><span>{o.interviews === 1 ? "interview" : "interviews"}</span></div>
              <div><b>{o.offers}</b><span>{o.offers === 1 ? "offer" : "offers"}</span></div>
            </div>
          ) : <Spinner />}
          <a className="adm2-foot" href="/admin?tab=team" data-testid="admin-team-band"><span><b>{hours.toFixed(1)} h</b> team hours this week · AI ${d.ai.cost.toFixed(2)}, {d.ai.calls} calls</span><ArrowRight size={14} /></a>
        </section>
      </div>
      {allSteps && (
        <Modal title="Every step students take" onClose={() => setAllSteps(false)} wide>
          <div className="adm2-cols2">
            <div className="stack-sm"><h3>Setup, step by step</h3><Bars rows={steps} max={f.accounts} at={dropAt(steps)} /></div>
            <div className="stack-sm"><h3>Road to an offer</h3><Bars rows={road.map((m) => [m.label, m.n] as [string, number])} max={d.students} at={-1} /><p className="xs muted">The lowest bar is where students get stuck; make that step easier next.</p></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
const Delta = ({ n }: { n: number }) => <span className={n > 0 ? "pass" : n < 0 ? "bad" : ""}>{n > 0 ? "▲" : n < 0 ? "▼" : "="} {Math.abs(n)}</span>;

/** Moved from Overview: what students used this week (shown under Beta). */
function UsedCard() {
  const [d] = useLoad<Overview>("/api/admin/overview");
  if (!d) return null;
  return (
    <section className="adm-card" data-testid="admin-features">
      <h3>What students used this week</h3>
      {d.features.length ? (
        <table className="table"><thead><tr><th>Feature</th><th>Students</th><th>Times</th></tr></thead>
          <tbody>{d.features.map((x) => <tr key={x.name}><td>{x.name}</td><td>{x.students}</td><td>{x.uses}</td></tr>)}</tbody></table>
      ) : <p className="small muted">Nothing yet this week.</p>}
      <p className="xs muted">AI calls: {d.ai.calls}, {d.ai.failed} failed, {(d.ai.avgMs / 1000).toFixed(1)} s on average.</p>
    </section>
  );
}

type Signals = { days: number; pages: { name: string; n: number }[]; rage: { name: string; n: number }[]; ratings: { place: string; up: number; down: number }[] };
function ErrorsTab() {
  const { run } = useStore();
  const [d, reload, setD] = useLoad<Errors>("/api/admin/errors");
  const [sig] = useLoad<Signals>("/api/admin/signals");
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<"" | "errors" | "feedback" | "fixed">("");
  const [all, setAll] = useState(false);
  if (!d) return <div className="row"><Spinner /> Loading…</div>;
  const fix = async (e: OpenError) => { const r = await run(() => api<Errors>("POST", "/api/admin/errors/fix", { message: e.message, kind: e.kind }), "Marked fixed. If it happens again, it comes back here."); if (r) setD(r); };
  const shown = view || (d.open.length || !d.feedback.length ? "errors" : "feedback");
  const worst = [...d.open].sort((a, b) => b.students - a.students || b.times - a.times)[0];
  const line = `${plural(d.open.length, "open error")}, ${d.feedback.length ? plural(d.feedback.length, "new note") : "no new feedback"}.`;
  const after = worst ? ` "${worst.message.slice(0, 60)}" hit ${plural(worst.students || 1, "student")}; start there.` : " Nothing is waiting on a fix.";
  const bars = (rows: { name: string; n: number }[], hot: boolean) => { const max = Math.max(1, ...rows.map((r) => r.n)); return <div className="adm2-bars">{rows.slice(0, 6).map((r, i) => <div key={r.name} className={"adm2-bar" + (hot && i === 0 ? " drop" : "")}><span className="adm-ellipsis" title={r.name}>{r.name}</span><div><i style={{ width: `${(r.n / max) * 100}%` }} /></div><b>{r.n}</b></div>)}</div>; };
  const ups = sig ? sig.ratings.reduce((x, r) => x + r.up, 0) : 0, downs = sig ? sig.ratings.reduce((x, r) => x + r.down, 0) : 0;
  return (
    <div className="adm2 adm2-full adm2-fixed">
      <div className="adm-head">
        <div><h1 className="adm-hello">Errors &amp; feedback</h1><p className="adm2-say"><b>{line}</b>{after}</p></div>
        <button className="btn btn-ghost btn-sm" onClick={() => reload("Up to date")} data-testid="button-errors-refresh"><RotateCcw size={14} /> Refresh</button>
      </div>
      <div className="adm2-row adm2-row-sys">
        <section className="adm2-card" data-testid="errors-inbox">
          <div className="adm2-h"><h3>To look at</h3>
            <div className="adm2-seg" role="group" aria-label="Show">
              {([["errors", `Errors ${d.open.length}`], ["feedback", `Feedback ${d.feedback.length}`], ["fixed", `Fixed ${d.fixed.length}`]] as const).map(([k, l]) => <button key={k} aria-pressed={shown === k} onClick={() => setView(k)} data-testid={`errors-view-${k}`}>{l}</button>)}
            </div>
          </div>
          <div className="adm2-scroll adm-list">
            {shown === "errors" && <>
              {d.open.map((e) => {
                const k = e.kind + e.message;
                return (
                  <div key={k} className="adm-err">
                    <div className="grow stack-sm" style={{ gap: 4 }}>
                      <b className="small">{e.message}</b>
                      <span className="xs muted">{e.kind === "browser" ? "Browser" : "Server"} · {e.place || "unknown page"}{(e.places || 1) > 1 ? ` and ${e.places! - 1} other page${e.places! - 1 === 1 ? "" : "s"}` : ""} · {e.times} time{e.times === 1 ? "" : "s"}{e.students ? `, ${e.students} student${e.students === 1 ? "" : "s"}` : ""} · last {ago(e.last)}</span>
                      {e.detail && <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", padding: 0 }} onClick={() => setOpen(open === k ? null : k)}>{open === k ? "Hide details" : "Show details"}</button>}
                      {open === k && <pre className="admin-pre">{e.detail}</pre>}
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => fix(e)}><Check size={14} /> Mark fixed</button>
                  </div>
                );
              })}
              {!d.open.length && <Empty title="No open errors" body="Nothing students hit in the last 30 days is waiting on a fix." />}
              {d.fixed.length > 0 && <><span className="adm2-day">Fixed recently</span>{d.fixed.slice(0, 5).map((e) => <div key={e.kind + e.message} className="small adm-fixed"><Check size={14} className="pass" /> <span className="grow">{e.message}</span><span className="xs muted">{e.fixed_by.split("@")[0]}, {ago(e.fixed_at)}</span></div>)}</>}
            </>}
            {shown === "feedback" && <>
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
                    {/* The student's screenshot (owners only); opens full size. */}
                    {f.shot && <a href={`/api/admin/feedback/${f.id}/screenshot`} target="_blank" rel="noreferrer" style={{ alignSelf: "flex-start" }} data-testid="feedback-shot-link"><img src={`/api/admin/feedback/${f.id}/screenshot`} alt="Screenshot from the student" loading="lazy" style={{ maxWidth: 220, maxHeight: 140, borderRadius: 8, border: "1px solid var(--line)", objectFit: "cover", display: "block" }} /></a>}
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={async () => { const r = await run(() => api<Errors>("POST", "/api/admin/errors/fix", { message: f.message, kind: "feedback" }), "Marked handled"); if (r) setD(r); }}><Check size={14} /> Handled</button>
                </div>
              ))}
              {!d.feedback.length && <Empty title="No new feedback" body="Notes from Send feedback and 👎 reasons land here." />}
            </>}
            {shown === "fixed" && <>
              {d.fixed.map((e) => <div key={e.kind + e.message} className="small adm-fixed"><Check size={14} className="pass" /> <span className="grow">{e.message}</span><span className="xs muted">{e.fixed_by.split("@")[0]}, {ago(e.fixed_at)}</span></div>)}
              {!d.fixed.length && <p className="small muted">Nothing marked fixed recently.</p>}
            </>}
          </div>
        </section>
        <div className="adm2-col" data-testid="signals-card">
          <section className="adm2-card">
            <div className="adm2-h"><h3>Rage clicks this week</h3>{sig && <button className="btn btn-ghost btn-sm" onClick={() => setAll(true)} data-testid="button-all-signals">All <ArrowRight size={14} /></button>}</div>
            {sig ? (sig.rage.length ? bars(sig.rage, true) : <span className="small muted">None. Good sign.</span>) : <Spinner />}
            {sig?.rage[0] && <p className="adm2-note"><b>{sig.rage[0].name} got {sig.rage[0].n} rage clicks.</b> 3+ quick clicks on one thing usually means it looks clickable but doesn't do anything.</p>}
          </section>
          <section className="adm2-card grow">
            <div className="adm2-h"><h3>Pages opened</h3><span className="xs muted">this week · {ups} 👍 · {downs} 👎</span></div>
            {sig ? (sig.pages.length ? bars(sig.pages, false) : <span className="small muted">No visits counted yet.</span>) : <Spinner />}
            <span className="xs muted" style={{ marginTop: "auto" }}>Counted by students' browsers: no names and nothing they typed.</span>
          </section>
        </div>
      </div>
      {all && sig && (
        <Modal title="What students did this week" onClose={() => setAll(false)} wide>
          <div className="grid-3" style={{ alignItems: "start" }}>
            <div className="stack-sm"><b className="small">Pages opened</b>{sig.pages.map((r) => <div key={r.name} className="row-between small"><span>{r.name}</span><b>{r.n}</b></div>)}</div>
            <div className="stack-sm"><b className="small">Rage clicks</b>{sig.rage.map((r) => <div key={r.name} className="row-between small"><span>{r.name}</span><b>{r.n}</b></div>)}</div>
            <div className="stack-sm"><b className="small">Was it useful? 👍 / 👎</b>{sig.ratings.length ? sig.ratings.map((r) => <div key={r.place} className="row-between small"><span>{r.place}</span><span><b>{r.up}</b> 👍 · <b>{r.down}</b> 👎</span></div>) : <span className="small muted">No ratings yet.</span>}</div>
          </div>
        </Modal>
      )}
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

function TeamTab({ tab }: { tab: "board" | "team" }) {
  const { run } = useStore();
  const { query } = useRoute();
  const [d, , setD] = useLoad<Team>("/api/admin/team");
  const [task, setTask] = useState({ title: "", assignee: [] as string[], due: "" });
  const [ev, setEv] = useState({ title: "", date: "", time: "", who: "", assignees: [] as string[] });
  const [over, setOver] = useState<Status | null>(null);
  const [member, setMember] = useState({ name: "", email: "" });
  const [note, setNote] = useState("");
  const [past, setPast] = useState({ date: today(), from: "", to: "", note: "" });
  const [drag, setDrag] = useState<string | null>(null);
  const [panel, setPanel] = useState<"" | "past" | "member" | "entries" | "activity" | "meeting" | "pastMeetings">("");
  const send = async (method: "POST" | "DELETE", path: string, body?: unknown, done?: string) => {
    const r = await run(() => api<Team>(method, path, body), done);
    if (r) setD(r);
    return !!r;
  };
  if (!d) return <div className="row"><Spinner /> Loading…</div>;
  const who = (email: string) => d.members.find((m) => m.email === email);
  const nameOf = (email: string) => who(email)?.name || email.split("@")[0];
  // The person's AI status file (docs/ai/status/), matched by first name: what it's on, and requests it hasn't finished.
  const aiLine = (m: Member) => {
    const first = (m.name || "").trim().toLowerCase().split(/\s+/)[0];
    const p = d.ai?.people.find((x) => x.name.toLowerCase() === first);
    if (!p) return "";
    const mine = (d.ai?.requests || []).filter((r) => r.to.toLowerCase() === first);
    const open = mine.filter((r) => r.state !== "done" && r.state !== "declined").length, late = mine.filter((r) => r.overdue).length, done = mine.filter((r) => r.state === "done").length;
    const asks = mine.length ? ` · requests: ${open} open${late ? `, ${late} overdue` : ""}, ${done} done` : "";
    return `Working on: ${(p.workingOn[0] || "nothing listed").replace(/`/g, "")}${asks}`;
  };
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
    // Board and Calendar in one tab (Nov 24): the team's to-dos beside what's coming up.
    const mine = person ? d.tasks.filter((t) => list(t.assignee).includes(person)) : d.tasks;
    // Finished to-dos stay in Done for 3 days, then move to History so the board stays short.
    const old = (t: TeamTask) => t.status === "done" && !!t.done_at && Date.now() - new Date(t.done_at).getTime() > HISTORY_AFTER;
    const shown = mine.filter((t) => !old(t));
    const history = mine.filter(old).sort((a, b) => (b.done_at! > a.done_at! ? 1 : -1));
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
    const openTasks = mine.filter((t) => t.status !== "done");
    const dueNow = openTasks.filter((t) => t.due && t.due <= t0).length;
    const next = upcoming[0];
    const line = `${plural(openTasks.length, "to-do")} open${dueNow ? `, ${dueNow} due today or late` : ""}.`;
    const after = next ? ` Next meeting: ${next.title}, ${day(next.date)}.` : " No meetings coming up.";
    // This month, Monday first, with a dot on days that have a meeting.
    const [yy, mm] = t0.split("-").map(Number);
    const lead = (new Date(yy, mm - 1, 1).getDay() + 6) % 7, days = new Date(yy, mm, 0).getDate();
    const has = new Set(d.events.map((e) => e.date));
    const ymd = (n: number) => `${yy}-${String(mm).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
    return (
      <div className="adm2 adm2-full adm2-fixed">
        <div className="adm-head">
          <div><h1 className="adm-hello">Board &amp; calendar</h1><p className="adm2-say"><b>{line}</b>{after}</p></div>
          <div className="row adm2-chips">
            <a className="pref-chip" aria-pressed={!person} href="/admin?tab=board" data-testid="filter-person-all">Everyone</a>
            {d.members.map((m) => <a key={m.email} className="pref-chip" aria-pressed={person === m.email} href={`/admin?tab=board&person=${encodeURIComponent(m.email)}`}>{m.name.split(" ")[0]}</a>)}
          </div>
        </div>
        <form className="adm2-add" onSubmit={async (e) => { e.preventDefault(); if (await send("POST", "/api/admin/tasks", task, "To-do added")) setTask({ title: "", assignee: [], due: "" }); }}>
          <input className="input" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="Add a to-do for the team…" aria-label="To-do" data-testid="input-task-title" />
          <People members={d.members} value={task.assignee} onChange={(v) => setTask({ ...task, assignee: v })} label="Who does it" />
          <input className="input" type="date" value={task.due} onChange={(e) => setTask({ ...task, due: e.target.value })} aria-label="Due date" data-testid="input-task-due" />
          <button className="btn btn-primary btn-sm" disabled={!task.title.trim()} data-testid="button-add-task"><Plus size={15} /> Add</button>
        </form>
        <div className="adm2-row adm2-row-board">
          <div className="adm2-col">
            <div className="adm-board adm2-board">
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
          <details className="adm2-card" data-testid="task-history">
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
          <section className="adm2-card" data-testid="team-calendar">
            <div className="adm2-h"><h3>{new Date(t0 + "T12:00").toLocaleDateString("en-US", { month: "long" })}</h3><button className="btn btn-ghost btn-sm" onClick={() => setPanel("meeting")} data-testid="button-open-meeting"><Plus size={14} /> Meeting</button></div>
            <div className="adm2-cal" aria-hidden>
              {["M", "T", "W", "T", "F", "S", "S"].map((x, i) => <span key={i} className="dn">{x}</span>)}
              {Array.from({ length: lead }, (_, i) => <span key={"e" + i} />)}
              {Array.from({ length: days }, (_, i) => { const k = ymd(i + 1); return <span key={k} className={(k === t0 ? "today" : k < t0 ? "past" : "") + (has.has(k) ? " has" : "")}>{i + 1}</span>; })}
            </div>
            <div className="adm2-h"><h3>Coming up</h3>{past.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setPanel("pastMeetings")} data-testid="button-past-meetings">Last 30 days</button>}</div>
            <div className="adm-list adm2-meets">{upcoming.map((e) => row(e, true))}{!upcoming.length && <p className="small muted">Nothing scheduled. Add a meeting with a professor, the career center or the team, and everyone can say if they're going.</p>}</div>
            {cal.available && (
          <div className="adm2-gcal" data-testid="team-gcal">
            {cal.connectedBy
              ? <span className="xs muted"><Check size={12} /> Meetings go to the <b>Remy team</b> Google Calendar automatically, with who's going. Connected by {nameOf(cal.connectedBy)}.</span>
              : <span className="xs muted">Connect the team's shared Google account and every meeting here appears on its <b>Remy team</b> calendar, with the headcount.</span>}
            {cal.connectedBy
              ? <button className="btn btn-ghost btn-sm" onClick={async () => { if (!confirm("Disconnect the team Google Calendar? The Remy team calendar will be deleted from that Google account.")) return; const r = await run(() => api<{ team: Team }>("DELETE", "/api/admin/calendar"), "Disconnected"); if (r) setD(r.team); }}>Disconnect</button>
              : <a className="btn btn-primary btn-sm" href={`/api/calendar/connect?team=1&tz=${encodeURIComponent(tz)}`} data-testid="button-team-gcal">Connect Google Calendar</a>}
          </div>
        )}
          </section>
        </div>
        {panel === "meeting" && (
          <Modal title="Add a meeting" onClose={() => setPanel("")}>
        <form className="stack-sm" onSubmit={async (e) => { e.preventDefault(); if (await send("POST", "/api/admin/events", ev, "Meeting added")) { setEv({ title: "", date: "", time: "", who: "", assignees: [] }); setPanel(""); } }}>
          <input className="input" value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} placeholder="Meeting, e.g. Career Center partnership" aria-label="Meeting" />
          <input className="input" value={ev.who} onChange={(e) => setEv({ ...ev, who: e.target.value })} placeholder="With whom (outside the team)" aria-label="With whom" />
          <People members={d.members} value={ev.assignees} onChange={(v) => setEv({ ...ev, assignees: v })} label="Teammates on this meeting" />
          <input className="input" type="date" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} aria-label="Date" />
          <input className="input" type="time" value={ev.time} onChange={(e) => setEv({ ...ev, time: e.target.value })} aria-label="Time" />
          <button className="btn btn-primary btn-sm" disabled={!ev.title.trim() || !ev.date} data-testid="button-add-meeting"><Plus size={15} /> Add</button>
        </form>
          </Modal>
        )}
        {panel === "pastMeetings" && (
          <Modal title="Meetings, last 30 days" onClose={() => setPanel("")} wide>
            <div className="adm-list">{past.map((e) => row(e, false))}</div>
          </Modal>
        )}
      </div>
    );
  }

  // Hours, People and Activity in one tab (Nov 24): who's working, how much, and what happened.
  // Monday of each of the last 8 weeks (Chicago time), oldest first, to match the server's weekly totals.
  const mondays = Array.from({ length: 8 }, (_, i) => {
    const x = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }));
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7) - 7 * (7 - i));
    return x.toLocaleDateString("en-CA");
  });
  const top = Math.max(1, ...d.weeks.map((w) => w.hours));
  const people = d.members.map((m) => ({ m, h: d.hours.find((x) => x.member === m.email) })).sort((a, b) => (b.h?.week || 0) - (a.h?.week || 0) || (b.h?.hours || 0) - (a.h?.hours || 0));
  const addPast = async () => {
    const at = (t: string) => new Date(`${past.date}T${t}`).toISOString();
    if (!past.date || !past.from || !past.to) return;
    if (await send("POST", "/api/admin/hours", { start: at(past.from), end: at(past.to), note: past.note }, "Time logged")) setPast({ ...past, from: "", to: "", note: "" });
  };
  const weekTotal = people.reduce((x, y) => x + (y.h?.week || 0), 0);
  const workers = people.filter((p) => (p.h?.week || 0) > 0);
  const line = !weekTotal ? "No hours logged this week yet." : workers.length === 1 ? `${weekTotal.toFixed(1)} hours this week, all ${workers[0].m.name.split(" ")[0]}'s.` : `${weekTotal.toFixed(1)} hours this week from ${workers.length} people.`;
  const working = d.members.filter((m) => d.entries.some((e) => e.member === m.email && !e.end_at));
  // Activity grouped by day, with runs of the same thing by the same person folded into one line.
  const dayLabel = (iso: string) => { const k = new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); const t = today(); const y = new Date(Date.now() - 86400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); return k === t ? "Today" : k === y ? "Yesterday" : day(k); };
  const runs: { label: string; items: Team["activity"] }[] = [];
  for (const a of d.activity) {
    const label = dayLabel(a.at); const last = runs[runs.length - 1];
    if (last && last.label === label && last.items[0].actor === a.actor && last.items[0].action === a.action) last.items.push(a); else runs.push({ label, items: [a] });
  }
  const row = (r: (typeof runs)[number], i: number, all: typeof runs) => {
    const a = r.items[0];
    return (
      <div key={a.id} className="adm2-act">
        {(i === 0 || all[i - 1].label !== r.label) && <span className="adm2-day">{r.label}</span>}
        <div><Avatar m={who(a.actor)} size={28} /><span className="small"><b>{nameOf(a.actor).split(" ")[0]}</b> {a.action.toLowerCase()}{r.items.length > 1 ? <b> ×{r.items.length}</b> : a.detail ? <span className="muted">: {pretty(a.detail)}</span> : null}</span><span className="xs muted">{ago(a.at)}</span></div>
      </div>
    );
  };
  const [first8, rest] = [runs.slice(0, 9), runs.length > 9];
  // Team hours per day for the last 7 days (Chicago, like the server's weekly total), from each entry's start; an open entry counts up to now.
  const chi = (iso: string | number) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const week = Array.from({ length: 7 }, (_, i) => chi(Date.now() - (6 - i) * 86400_000));
  const perDay = week.map((k) => d.entries.filter((e) => chi(e.start_at) === k).reduce((x, e) => x + ((e.end_at ? +new Date(e.end_at) : Date.now()) - +new Date(e.start_at)) / 3600_000, 0));
  const dayTop = Math.max(1, ...perDay);
  return (
    <div className="adm2 adm2-full">
      <div className="adm-head">
        <div><h1 className="adm-hello">Team &amp; hours</h1><p className="adm2-say"><b>{line}</b>{working.length ? ` ${working.map((m) => m.name.split(" ")[0]).join(" and ")} ${working.length === 1 ? "is" : "are"} working now.` : ""}</p></div>
        <div className="row adm2-clock">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={d.clockedIn ? `Working since ${when(d.clockedIn)}: what on?` : "What are you working on? (optional)"} aria-label="Note" data-testid="input-clock-note" />
          <button className="btn btn-ghost btn-sm" onClick={() => setPanel("past")} data-testid="button-open-past">Add time you forgot</button>
          <button className={"btn btn-sm " + (d.clockedIn ? "btn-secondary" : "btn-primary")} onClick={async () => { if (await send("POST", "/api/admin/clock", { action: d.clockedIn ? "out" : "in", note }, d.clockedIn ? "Clocked out" : "Clocked in")) setNote(""); }} data-testid="button-clock">{d.clockedIn ? "Clock out" : "Clock in"}</button>
        </div>
      </div>
      <div className="adm2-row adm2-row-sys">
        <section className="adm2-card" data-testid="team-everyone">
          <div className="adm2-h"><h3>Everyone</h3><span className="xs muted">this week · total · last 8 weeks · open to-dos</span></div>
          <div className="adm2-people">
            {people.map(({ m, h }) => {
              const open = d.tasks.filter((t) => list(t.assignee).includes(m.email) && t.status !== "done").length;
              const last = d.activity.find((a) => a.actor === m.email);
              const now = working.includes(m);
              return (
                <div key={m.email} className="adm2-person" data-testid={`hours-${m.email.split("@")[0]}`}>
                  <Avatar m={m} size={32} />
                  <span className="adm2-pn"><b>{m.name}{m.email === d.me && <span className="xs muted"> (you)</span>}{now && <span className="chip chip-live">Working now</span>}</b><small>{last ? `${last.action.toLowerCase()}, ${ago(last.at)}` : "no activity yet"}</small>{aiLine(m) && <small className="adm-ellipsis" title={aiLine(m)} data-testid={`ai-status-${m.email.split("@")[0]}`}>{aiLine(m)}</small>}</span>
                  <b className="adm2-num">{h?.week || 0} h</b>
                  <span className="adm2-num muted">{h?.hours || 0} h</span>
                  <span className="adm2-mini" role="img" aria-label={`${m.name}: hours per week for the last 8 weeks`}>
                    {mondays.map((w) => { const n = d.weeks.find((x) => x.member === m.email && x.week === w)?.hours || 0; return <i key={w} title={`Week of ${day(w)}: ${n} h`} className={n ? "" : "z"} style={{ height: `${Math.max(2, (n / top) * 22)}px` }} />; })}
                  </span>
                  <a className="adm2-num" href={`/admin?tab=board&person=${encodeURIComponent(m.email)}`} title="See their to-dos">{open}</a>
                  {!m.founder && m.email !== d.me ? <button className="icon-btn" onClick={() => confirm(`Remove ${m.name} from the owners' dashboard?`) && send("DELETE", `/api/admin/members/${encodeURIComponent(m.email)}`, undefined, "Removed")} aria-label={`Remove ${m.name}`} data-testid={`button-remove-${m.email.split("@")[0]}`}><Trash2 size={14} /></button> : <span />}
                </div>
              );
            })}
          </div>
          <div className="adm2-h adm2-push"><h3>Last 7 days, by day</h3><span className="xs muted">team hours</span></div>
          <div className="adm2-cols" role="img" aria-label={`Team hours this week: ${week.map((k, i) => `${day(k)} ${perDay[i].toFixed(1)} h`).join(", ")}`}>
            {week.map((k, i) => <div key={k}><small className="adm2-colv">{perDay[i] >= 0.05 ? perDay[i].toFixed(1) : ""}</small><i style={{ height: `${Math.max(2, (perDay[i] / dayTop) * 64)}px` }} /><small>{day(k).split(",")[0]}</small></div>)}
          </div>
          <div className="adm2-foot"><button className="btn btn-ghost btn-sm" onClick={() => setPanel("member")} data-testid="button-open-add-teammate"><Plus size={14} /> Add teammate</button><button className="btn btn-ghost btn-sm" onClick={() => setPanel("entries")} data-testid="button-open-entries">Time entries <ArrowRight size={14} /></button></div>
        </section>
        <section className="adm2-card" data-testid="team-activity">
          <div className="adm2-h"><h3>Activity</h3>{rest && <button className="btn btn-ghost btn-sm" onClick={() => setPanel("activity")} data-testid="button-all-activity">All <ArrowRight size={14} /></button>}</div>
          {first8.length ? <div className="adm2-acts">{first8.map(row)}</div> : <Empty title="No activity yet" body="Adding to-dos, finishing them, meetings and hours all show up here." />}
        </section>
      </div>
      {panel === "past" && (
        <Modal title="Add time you forgot to clock" onClose={() => setPanel("")}>
          <div className="adm-past">
            <input className="input" type="date" max={today()} value={past.date} onChange={(e) => setPast({ ...past, date: e.target.value })} aria-label="Day" data-testid="input-past-date" />
            <input className="input" type="time" value={past.from} onChange={(e) => setPast({ ...past, from: e.target.value })} aria-label="From" data-testid="input-past-from" />
            <input className="input" type="time" value={past.to} onChange={(e) => setPast({ ...past, to: e.target.value })} aria-label="To" data-testid="input-past-to" />
          </div>
          <div className="row">
            <input className="input grow" value={past.note} onChange={(e) => setPast({ ...past, note: e.target.value })} placeholder="What you worked on (optional)" aria-label="What you worked on" data-testid="input-past-note" />
            <button className="btn btn-primary btn-sm" disabled={!past.date || !past.from || !past.to} onClick={addPast} data-testid="button-add-past"><Plus size={14} /> Add</button>
          </div>
          <p className="xs muted">Each person logs only their own time, up to 16 hours at once.</p>
        </Modal>
      )}
      {panel === "member" && (
        <Modal title="Add a teammate" onClose={() => setPanel("")}>
          <form className="stack-sm" onSubmit={async (e) => { e.preventDefault(); if (await send("POST", "/api/admin/members", member, "Teammate added. They see this page next time they sign in.")) { setMember({ name: "", email: "" }); setPanel(""); } }}>
            <input className="input" value={member.name} onChange={(e) => setMember({ ...member, name: e.target.value })} placeholder="Name" aria-label="Teammate name" data-testid="input-member-name" />
            <input className="input" type="email" value={member.email} onChange={(e) => setMember({ ...member, email: e.target.value })} placeholder="Email they sign in with" aria-label="Teammate email" data-testid="input-member-email" />
            <button className="btn btn-primary btn-sm" disabled={!member.email.includes("@")} data-testid="button-add-teammate"><Plus size={15} /> Add teammate</button>
            <p className="xs muted">Everyone here can open this dashboard and sees the same board, calendar, hours and activity.</p>
          </form>
        </Modal>
      )}
      {panel === "entries" && (
        <Modal title="Time entries" onClose={() => setPanel("")} wide>
          <div className="adm-list">
            <More items={d.entries} render={(e) => (
              <div key={e.id} className="adm-row">
                <Avatar m={who(e.member)} size={26} />
                <div className="grow stack-sm" style={{ gap: 2 }}>
                  <span className="small"><b>{nameOf(e.member)}</b>: {when(e.start_at)} to {e.end_at ? when(e.end_at) : <span className="pass">still working</span>}{e.end_at && <span className="muted"> · {((+new Date(e.end_at) - +new Date(e.start_at)) / 3600_000).toFixed(1)} h</span>}</span>
                  {e.note && <span className="xs muted">{e.source === "pr" ? <a href={`https://github.com/DilanDimel/Remy/pull/${e.ref?.replace("pr:", "")}`} target="_blank" rel="noreferrer">{e.note}</a> : e.note}{e.source === "pr" && <> (from PR{e.ai_cost ? `, $${e.ai_cost.toFixed(2)} AI` : ""})</>}</span>}
                </div>
                {e.member === d.me && e.end_at && <button className="icon-btn" onClick={() => send("DELETE", `/api/admin/hours/${e.id}`, undefined, "Entry removed")} aria-label="Remove this entry" data-testid={`button-remove-entry-${e.id}`}><Trash2 size={14} /></button>}
              </div>
            )} />
            {!d.entries.length && <p className="small muted">No hours logged yet.</p>}
          </div>
        </Modal>
      )}
      {panel === "activity" && (
        <Modal title="All activity" onClose={() => setPanel("")} wide>
          <div className="adm-list">
            <More items={d.activity} render={(a) => (
              <div key={a.id} className="adm-row">
                <Avatar m={who(a.actor)} size={30} />
                <div className="grow stack-sm" style={{ gap: 2 }}><span className="small"><b>{nameOf(a.actor)}</b> {a.action.toLowerCase()}{a.detail ? <>: <span className="muted">{pretty(a.detail)}</span></> : null}</span><span className="xs muted">{ago(a.at)}</span></div>
              </div>
            )} />
          </div>
        </Modal>
      )}
    </div>
  );
}
/** Long dashboard lists show 20 at a time (Nov 23 PM review: Activity ran 5,300 px). */
function More<T>({ items, render, step = 20 }: { items: T[]; render: (x: T) => ReactNode; step?: number }) {
  const [n, setN] = useState(step);
  return <>{items.slice(0, n).map(render)}{items.length > n && <button className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setN(n + step)} data-testid="button-show-more">Show {Math.min(step, items.length - n)} more</button>}</>;
}
