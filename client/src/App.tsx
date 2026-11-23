import { uiFlags } from "./lib/router";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3, Briefcase, CalendarDays, ChevronsLeft, ChevronsRight, Compass, FileText, Home as HomeIcon, Menu, Send,
  Check, Gauge, Info, Mic, Minus, ShieldCheck, UserCog, Users,
  ImagePlus, MessageCircle, Search, ArrowRight, ChevronDown, Square,
} from "lucide-react";
import { ThemeToggle } from "./components/ThemeToggle";
import { canListen, speak, useVoice } from "./lib/voice";
import { StoreProvider, api, daysUntil, fmtDate, rid, useDraft, useOwnerView, useStore, type Theme } from "./lib/store";
import { CAREER_QUEST_ON } from "@shared/game";
import { resumeDiff } from "@shared/resumeDiff";
import { activityDays, dayOf, todayBrief } from "@shared/activity";
import { useJobs } from "./lib/jobs";
import { go, replaceRoute, useRoute } from "./lib/router";
const PUBLIC = new Set(["/", "/signin", "/welcome", "/about", "/policies", "/privacy", "/terms"]);
import { BetaBadge, Modal, Remy, Rich, Spinner, StatusChip } from "./components/common";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { QuickRate } from "./components/QuickRate";
import { WhatsNew } from "./components/WhatsNew";
import { GameSidebar, useGameRecord } from "./components/Game";
import { Avatar } from "./components/ProfilePhoto";
import { useRemyDoes, useRemyReachOut } from "./lib/remyDoes";
import { RemyDid } from "./components/RemyDid";
import { OfferSlot, RemyOffer } from "./components/RemyOffer";
import { RemyAway } from "./components/RemyAway";
import { answer as answerTailor, endSession as endTailor, isAsking, onOpenRequest, useTailorSession } from "./lib/tailorChat";
import Welcome from "./pages/Welcome";
import { Careers } from "./pages/Landing2";
import { count as countSignal, startSignals, tidyPath } from "./lib/signals";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import PathPage from "./pages/Path";
import Resume from "./pages/Resume";
import Opportunities from "./pages/Opportunities";
import Community from "./pages/Community";
import CalendarPage from "./pages/Calendar";
import Progress from "./pages/Progress";
import Interview from "./pages/Interview";
import Accounts from "./pages/Accounts";
import { About, Policies } from "./pages/Info";
import Admin from "./pages/Admin";
import type { ChatAction, Workspace } from "@shared/types";
import { Celebrate } from "./components/Celebrate";
import { RemyTour, tourAgain } from "./components/Tour";
import { BETA_TERM_HEADS, BETA_TERMS, BETA_TERMS_LEAD, BETA_TERMS_VERSION } from "@shared/beta";
import { firstName, knownName } from "@shared/names";
import { isNativeApp } from "./lib/native";

const NAV = [
  { path: "/", label: "Home", icon: HomeIcon },
  { path: "/path", label: "My Path", icon: Compass },
  { path: "/resume", label: "Resume/CV", icon: FileText },
  { path: "/opportunities", label: "Opportunities", icon: Briefcase },
  { path: "/interview", label: "Interview", icon: Mic },
  { path: "/community", label: "Community", icon: Users },
  { path: "/calendar", label: "Calendar", icon: CalendarDays },
  { path: "/progress", label: "Progress", icon: BarChart3 },
];
const ACCOUNTS = { path: "/accounts", label: "Account", icon: UserCog };
const THEME_NAME: Record<Theme, string> = { dark: "Dark mode", light: "Light mode", system: "Matching your device" };
const NOTIFY_NAME: Record<string, string> = { "notify.deadlines": "Deadline reminders", "notify.statusChanges": "Status-change alerts", "notify.weeklyPlan": "Weekly plan emails" };
const settingLabel = (a: Extract<ChatAction, { kind: "setting" }>) =>
  a.key === "theme" ? (a.value === "system" ? "Match my device's theme" : `Turn on ${String(a.value)} mode`) : `Turn ${NOTIFY_NAME[a.key].toLowerCase()} ${a.value ? "on" : "off"}`;

export default function App() {
  return (
    <StoreProvider>
      <ErrorBoundary where="app">
        <Root />
      </ErrorBoundary>
    </StoreProvider>
  );
}

function Root() {
  const { loading, ws, me } = useStore();
  const { path } = useRoute();
  // Keep the address honest: signed out, only the front page and sign-in page exist (so deleting an account or
  // signing out doesn't leave /accounts in the bar for the next account); signed in, /signin goes home.
  const signedOut = !me || !ws || !ws.started;
  useEffect(() => {
    if (loading) return;
    if (signedOut && !PUBLIC.has(path) && !(path === "/admin" && me)) replaceRoute("/");
    if (!signedOut && path === "/signin") replaceRoute("/");
  }, [loading, signedOut, path]);
  // Signed-in students: automatic signals for the owners (page visits, rage clicks, errors). Counts only.
  useEffect(() => { if (!loading && !signedOut) { startSignals(); countSignal("page:" + tidyPath(path)); } }, [loading, signedOut, path]);
  // Owner styling has to live here, not in Shell: /about and /admin render outside Shell, so they'd otherwise
  // keep the student look. Shell still owns the favicon swap.
  const ownerView = useOwnerView();
  useEffect(() => { document.documentElement.classList.toggle("redesign-2", ownerView); }, [ownerView]);
  // Public pages: readable without signing in.
  if (path === "/about") return <About />;
  if (path === "/policies" || path === "/privacy" || path === "/terms") return <Policies />;
  if (loading)
    return <SlowLoading />;
  if (path === "/admin" && me) return <Admin />;
  // The public homepage stays reachable while signed in (its buttons then open the student's Remy).
  // (The phone app has no homepage, so signed in it goes straight to the student's Remy.)
  if (path === "/careers" && !signedOut) return <Careers />;
  if (signedOut || (path === "/welcome" && !isNativeApp)) return <Welcome />;
  if (ws.betaAgreed?.version !== BETA_TERMS_VERSION) return <BetaAgreement />;
  if (!ws.onboarding.done) return <Onboarding />;
  return <Shell />;
}

/** Every student agrees to the beta terms once (and again when they change) before using Remy. */
function BetaAgreement() {
  const { setWs, run } = useStore();
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  // Shows "scroll to read them all" until the last term is in view (or when the list fits without scrolling).
  const list = useRef<HTMLOListElement>(null);
  const [atEnd, setAtEnd] = useState(true);
  const checkEnd = () => { const l = list.current; if (l) setAtEnd(l.scrollTop + l.clientHeight >= l.scrollHeight - 4); };
  useEffect(() => { checkEnd(); addEventListener("resize", checkEnd); return () => removeEventListener("resize", checkEnd); }, []);
  const agree = async () => {
    setBusy(true);
    const r = await run(() => api<Workspace>("POST", "/api/beta/agree", { version: BETA_TERMS_VERSION }));
    if (r) setWs(r);
    setBusy(false);
  };
  return (
    <div className="landing-screen auth-stage">
      <div className="lp-beam" aria-hidden><span className="lp-beam-floor" /></div>
      <div className="landing-card fade-up terms-card" data-testid="beta-agreement">
        <div className="terms-head"><Remy size={44} mood="wave" /><div><h1>Before you start <BetaBadge /></h1><p className="small muted">{BETA_TERMS_LEAD}</p></div></div>
        <ol className="terms-list" tabIndex={0} aria-label="Beta terms" ref={list} onScroll={checkEnd}>
          {BETA_TERMS.map((t, i) => <li key={t}><b>{BETA_TERM_HEADS[i] || `Point ${i + 1}`}</b><span>{t}</span></li>)}
        </ol>
        {!atEnd && <p className="xs terms-more" aria-hidden>{BETA_TERMS.length} points · scroll to read them all ↓</p>}
        <div className="terms-foot">
          <label className="terms-check">
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} data-testid="checkbox-beta-agree" />
            <span>I'm 16 or older (with a parent or guardian's OK if I'm under 18), I understand Remy is in beta, and I agree to these terms.</span>
          </label>
          <button className="btn btn-primary btn-lg terms-go" disabled={!ok || busy} onClick={agree} data-testid="button-beta-agree">{busy ? <Spinner /> : null} Agree and continue</button>
          <p className="xs muted">Read the full <a className="auth-link" href="/policies" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>privacy policy and terms</a>.</p>
        </div>
      </div>
    </div>
  );
}

// A reload checks the session in well under a second; showing Remy's loading screen for that long reads as a
// different page flashing by, so the screen stays blank unless loading is actually slow.
function SlowLoading() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 800); return () => clearTimeout(t); }, []);
  if (!slow) return null;
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div className="stack" style={{ alignItems: "center" }}><Remy size={64} mood="think" /><span className="muted small">Remy is getting things ready…</span></div>
    </div>
  );
}

function isMobileNow() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1020px)").matches;
}

function Shell() {
  const { ws, save, me } = useStore();
  const ownerView = useOwnerView();
  useRemyReachOut(ownerView);
  useRemyDoes(ownerView); // owners: what Remy does from chat shows on screen right away (lib/remyDoes.ts)
  useGameRecord(ws, CAREER_QUEST_ON && ownerView); // Career quest (paused Nov 21; owners only when on): keeps the week on every page
  // Demetre's redesign (plain titles, phone layout, less "AI template" look): checked by owners on Nov 21 and released
  // to everyone the same day. The styles still live under .design-preview in index.css, to fold in later.
  useEffect(() => {
    document.documentElement.classList.add("design-preview");
  }, []);
  // Redesign stage 2 (owners first, Nov 21): one Remy, the Home "one thing now" card, moving sidebar icons.
  useEffect(() => {
    document.documentElement.classList.toggle("redesign-2", ownerView);
    // Owners see the Scholar fox in the browser tab too.
    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((l) => {
      l.dataset.base ||= l.getAttribute("href") || "";
      l.href = ownerView ? "/remy-scholar.svg" : l.dataset.base;
      if (l.type === "image/png") l.disabled = ownerView;
    });
  }, [ownerView]);
  // Owners: the phone browser's bar (Android Chrome, iPhone Safari) matches the page instead of staying near-black over a light app.
  const { theme } = useStore();
  useEffect(() => {
    const m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!m || !ownerView) return;
    const base = m.content;
    // next frame: the store sets the theme on <html> after this effect runs
    const f = requestAnimationFrame(() => { m.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || base; });
    return () => { cancelAnimationFrame(f); m.content = base; };
  }, [ownerView, theme]);
  // A match email's Yes / Not now (redesign stage 5): read from the link once, before a page rewrites the address.
  // The answer is only counted (owners see the Yes rate); the workspace isn't replaced, so it can't race the page.
  const { toast } = useStore();
  const [nudgeAnswer] = useState(() => { const p = new URLSearchParams(location.search); const id = p.get("nudge"), a = p.get("a"); return id && (a === "yes" || a === "later") ? { id, a } : null; });
  useEffect(() => {
    if (!nudgeAnswer) return;
    api("POST", `/api/nudges/${encodeURIComponent(nudgeAnswer.id)}`, { answer: nudgeAnswer.a }).catch(() => {});
    if (nudgeAnswer.a === "later") toast("Okay, not now. Remy won't bring that opening up again.");
  }, []);
  // Not now from a deadline reminder email: stop reminders for those deadlines.
  useEffect(() => {
    const skip = new URLSearchParams(location.search).get("skip");
    if (!skip) return;
    api("POST", "/api/reminders/skip", { keys: skip.split(",") }).then(() => toast("Okay. Remy won't remind you about that deadline again.")).catch(() => {});
  }, []);
  const { path, query } = useRoute();
  const [asstPage, setAsstPage] = useState<boolean | null>(null);
  const [more, setMore] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [flyIn, setFlyIn] = useState(() => uiFlags.flyIn);
  useEffect(() => {
    if (flyIn) {
      uiFlags.flyIn = false;
      const t = setTimeout(() => setFlyIn(false), 900);
      return () => clearTimeout(t);
    }
  }, [flyIn]);
  useEffect(() => { if (isMobileNow() || path.startsWith("/path")) setAsstPage(null); }, [path]);
  const w = ws as Workspace;
  // Remy stays open on every page until the student minimizes him. On small screens the
  // panel would cover the page, so there he starts minimized as the docked fox button.
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1020px)").matches;
  // Owners on My Path talk to Remy inside his office (PathBoard.tsx), so his panel stays closed there unless something
  // (a tailoring conversation) asks for it.
  const inOffice = ownerView && path.startsWith("/path");
  const asstOpen = inOffice ? asstPage === true : asstPage ?? (isMobile ? false : w.settings.assistantOpen);
  const setAsst = (open: boolean) => {
    setAsstPage(open);
    if (!isMobile) save("settings", { assistantOpen: open });
  };
  // A tailoring conversation opens Remy so the student can answer him.
  useEffect(() => { return onOpenRequest(() => setAsstPage(true)); }, []);
  const collapsed = w.settings.navCollapsed;
  const current = path.startsWith("/accounts") ? ACCOUNTS : NAV.find((n) => (n.path === "/" ? path === "/" : path.startsWith(n.path))) || NAV[0];
  const pendingReview = w.applications.reduce((s, a) => s + a.changes.filter((c) => c.status === "pending").length, 0);
  const openSuggestions = w.suggestions.filter((s) => s.state === "open").length;
  const page = (() => {
    switch (current.path) {
      case "/path": return <PathPage query={query} />;
      case "/resume": return <Resume query={query} />;
      case "/opportunities": return <Opportunities query={query} />;
      case "/community": return <Community />;
      case "/calendar": return <CalendarPage />;
      case "/progress": return <Progress />;
      case "/interview": return <Interview />;
      case "/accounts": return <Accounts query={query} />;
      default: return <Home />;
    }
  })();
  const initials = (w.profile.preferredName || knownName(w) || "S").split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className={`shell ${collapsed ? "nav-collapsed" : ""} ${asstOpen ? "asst-open" : ""}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="logo"><Remy size={26} /><span className="logo-text">Remy<b>.</b></span><BetaBadge /></span>
          <button className="icon-btn" onClick={() => save("settings", { navCollapsed: !collapsed })} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} data-testid="button-toggle-nav">
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
        {NAV.map((n) => (
          <a key={n.path} href={n.path} className="nav-item" aria-current={current.path === n.path ? "page" : undefined} title={n.label} data-testid={`nav-${n.label.toLowerCase().replace(/[^a-z]/g, "")}`}>
            <n.icon size={19} />
            <span className="nav-label">{n.label}</span>
            {n.path === "/resume" && pendingReview > 0 && <span className="count">{pendingReview}</span>}
            {n.path === "/progress" && openSuggestions > 0 && <span className="count">{openSuggestions}</span>}
          </a>
        ))}
        {/* Career quest: owners only while it's tested (Dilan, Nov 19); a big release later. */}
        {CAREER_QUEST_ON && ownerView && ws && <GameSidebar w={ws} />}
        <div className="side-news"><WhatsNew /><a className="nav-item" href="/welcome" title="Remy's homepage" data-testid="nav-homepage"><Info size={19} /><span className="nav-label">Remy homepage</span></a></div>
        <OwnerTools />
        <ProfileMenu initials={initials} active={path.startsWith("/accounts")} />
      </aside>

      <Celebrate />
      <RemyTour />
      <main className="main" id="main">
        <div className="topbar">
          <div className="crumb">Remy › <b>{current.label}</b></div>
          <div style={{ marginLeft: "auto" }} className="row">
            {!asstOpen && !ownerView && (
              <button className="btn btn-secondary btn-sm hide-sm" onClick={() => setAsst(true)} data-testid="button-open-assistant">
                <Remy size={18} /> Open Remy
              </button>
            )}
            {/* Redesign stage 2 (owners first): with his panel closed, Remy waits as his face at the top right, the one way
                to open him on every page and screen size (Dilan, Nov 22: the top-centre spot "looks weird"). */}
            {!asstOpen && ownerView && !inOffice && (
              <button className="remy-dock" onClick={() => setAsst(true)} data-testid="button-open-assistant" aria-label="Open Remy" title="Ask Remy">
                <span className="remy-dock-face"><Remy size={36} mood="idle" /></span>
              </button>
            )}
          </div>
        </div>
        {ownerView && <RemyOffer />}
        <div className="page fade-up" key={current.path}><ErrorBoundary where={`page:${current.path}`} resetKey={current.path}>{page}</ErrorBoundary></div>
      </main>

      {asstOpen && <aside className="assistant" aria-label="Remy assistant" data-testid="assistant-panel"><ErrorBoundary where="assistant" compact><Assistant page={current.label} onMinimize={() => setAsst(false)} flyIn={flyIn} /></ErrorBoundary></aside>}

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV.filter((n) => ["/", "/path", "/resume", "/opportunities", "/progress"].includes(n.path)).map((n) => (
          <a key={n.path} href={n.path} aria-current={current.path === n.path ? "page" : undefined}>
            <n.icon size={19} />
            {n.label === "Opportunities" ? "Jobs" : n.label === "Resume/CV" ? "Resume" : n.label}
          </a>
        ))}
        <a href="#" onClick={(e) => { e.preventDefault(); setMore(true); }} data-testid="mobile-more"><Menu size={19} />More</a>
      </nav>
      {!asstOpen && !inOffice && (
        <button className="asst-fab fade-up" onClick={() => setAsst(true)} data-testid="button-fab-assistant" aria-label="Open Remy">
          <Remy size={30} mood="wave" /> <span className="hide-sm">Remy</span>
        </button>
      )}
      {more && (
        <Modal title="More" onClose={() => setMore(false)}>
          <div className="stack-sm">
            {[...NAV.filter((n) => ["/interview", "/community", "/calendar"].includes(n.path)), ACCOUNTS].map((n) => (
              <button key={n.path} className="nav-item" onClick={() => { setMore(false); go(n.path); }}><n.icon size={19} />{n.label}</button>
            ))}
            <button className="nav-item" onClick={() => { setMore(false); tourAgain(save); go("/"); }} data-testid="mobile-tour"><Compass size={19} />Show me around again</button>
            <button className="nav-item" onClick={() => { setMore(false); go("/about"); }}><Info size={19} />About Remy</button>
            <button className="nav-item" onClick={() => { setMore(false); go("/policies"); }}><ShieldCheck size={19} />Privacy & terms</button>
            <button className="nav-item" onClick={() => { setMore(false); setFeedback(true); }}><Send size={19} />Send feedback</button>
            {me?.owner ? <OwnerTools onDone={() => setMore(false)} /> : null}
            <WhatsNew />
          </div>
        </Modal>
      )}
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </div>
  );
}

// On every page: Remy explains the screen they're on, for them (the tour stays in the menu under their name).
const LOOKING = "What am I looking at?";
// Design preview (owners, Nov 21): Remy opens with one line about the page you're on, in his voice, instead of the
// centred "Hi, I'm Remy." greeting every AI panel has (Demetre's redesign plan).
const INTRO: Record<string, string> = {
  Home: "The big card on Home is the one thing I'd do next. Ask me about it, or about anything in your search.",
  "My Path": "This is where you work out a direction. Ask me what your major leads to, or what a job is really like.",
  "Resume/CV": "Everything here comes from your own resume; I never invent experience. Ask me which of yours is strongest.",
  Opportunities: "These are ranked for you: openings you can apply to and that fit your background come first. Ask me why one fits.",
  Interview: "Practice your stories here before the real thing. Ask me what they're likely to ask you.",
  Community: "This is for the people who can help you. Ask me how to reach out to one of them.",
  Calendar: "Your deadlines and events, together. Ask me to help you plan around them.",
  Progress: "Every application you've sent and what comes next on each. Ask me what to do after a reply.",
  Accounts: "Your profile and what I remember about you. Ask me what I know, or tell me what to forget.",
};

// Redesign stage 2 (owners first): Coming up, then every past session by day (Dilan, Nov 23: "show all previous
// sessions"). A day's chat folds open to its messages.
const dayName = (day: string) => { const t = dayOf(new Date().toISOString()), y = dayOf(new Date(Date.now() - 864e5).toISOString()); return day === t ? "Today" : day === y ? "Yesterday" : fmtDate(day); };
const ACT_ICO = { chat: MessageCircle, did: Check, found: Search, apply: FileText, step: Check } as const;
function RemyActivity() {
  const { ws } = useStore();
  const w = ws!;
  const [more, setMore] = useState(false);
  const [openDay, setOpenDay] = useState("");
  const soon = [
    ...w.calendar.filter((c) => (daysUntil(c.date) ?? -1) >= 0).map((c) => ({ id: c.id, title: c.title, date: c.date })),
    ...w.tasks.filter((t) => !t.done && t.due && (daysUntil(t.due) ?? -1) >= 0).map((t) => ({ id: t.id, title: t.title, date: t.due })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const { fits } = useJobs();
  const days = activityDays(w, fits);
  const shown = more ? days : days.slice(0, 5);
  return (
    <div className="asst-activity" data-testid="remy-activity">
      <b className="small">Coming up</b>
      {soon.length ? soon.map((s) => <div key={s.id} className="act-row"><span className="act-ico"><CalendarDays size={14} /></span><span>{s.title}<span className="xs muted"> · {fmtDate(s.date)}</span></span></div>)
        : <p className="xs muted">Nothing due yet. When you save an opening or add a to-do with a date, it shows here.</p>}
      {!days.length && <><b className="small" style={{ marginTop: 10 }}>History</b><p className="xs muted">Nothing yet. As we talk, and as I read your resume, find openings and tailor applications, every session is kept here.</p></>}
      {shown.map((d) => (
        <section key={d.day} className="act-day" data-testid="activity-day">
          <b className="small act-day-h">{dayName(d.day)}</b>
          {d.events.map((e) => {
            const Ico = ACT_ICO[e.kind];
            const body = <><span className={"act-ico" + (e.kind === "did" ? " done" : "")}><Ico size={13} /></span><span className="grow">{e.text}{e.count && e.count > 1 ? <span className="xs muted"> · {e.kind === "chat" ? `${e.count} messages` : `×${e.count}`}</span> : null}</span></>;
            if (e.kind === "chat") return (
              <div key={e.kind + e.text}>
                <button className="act-row act-btn" aria-expanded={openDay === d.day} onClick={() => setOpenDay(openDay === d.day ? "" : d.day)} data-testid="button-activity-chat">{body}<ChevronDown size={14} className="act-chev" /></button>
                {openDay === d.day && <div className="act-chat">{d.chat.map((m) => <div key={m.id} className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>{m.role === "user" ? m.text : <Rich text={m.text} />}</div>)}</div>}
              </div>
            );
            return e.link
              ? <button key={e.kind + e.text} className="act-row act-btn" onClick={() => go(e.link!)} data-testid="button-activity-open">{body}</button>
              : <div key={e.kind + e.text} className="act-row">{body}</div>;
          })}
          {d.chat.filter((m) => m.did?.some((x) => !x.noUndo)).map((m) => <RemyDid key={m.id} m={m} />)}
        </section>
      ))}
      {days.length > 5 && <button className="btn btn-ghost btn-sm" onClick={() => setMore(!more)} data-testid="button-activity-more">{more ? "Show less" : `Show ${days.length - 5} earlier day${days.length - 5 === 1 ? "" : "s"}`}</button>}
    </div>
  );
}

/** Empty chat (owners): Remy opens with what happened today instead of waiting to be asked. */
const TODAY_ICO = { new: Search, due: CalendarDays, did: Check, next: ArrowRight } as const;
function RemyToday({ onActivity }: { onActivity: () => void }) {
  const { ws } = useStore();
  const { jobs, fits } = useJobs();
  const rows = todayBrief({ ...ws!, jobs: jobs || ws!.jobs }, new Date(), fits);
  const first = firstName(ws!);
  const h = new Date().getHours();
  return (
    <div className="asst-today" data-testid="remy-today">
      <b className="asst-today-h">{h < 12 ? "Morning" : h < 18 ? "Hi" : "Evening"}{first ? `, ${first}` : ""}. {rows.length ? "Here's today:" : "Quiet day so far. Nothing new since yesterday."}</b>
      {rows.map((r) => {
        const Ico = TODAY_ICO[r.kind];
        const click = r.kind === "did" ? onActivity : r.link ? () => go(r.link!) : undefined;
        return <button key={r.kind} className="act-row act-btn" onClick={click} disabled={!click} data-testid={`button-today-${r.kind}`}><span className={"act-ico" + (r.kind === "did" ? " done" : "")}><Ico size={13} /></span><span className="grow">{r.text}</span>{click && <ArrowRight size={13} className="act-chev" />}</button>;
      })}
    </div>
  );
}

// Owners: while Remy starts his answer, bouncing dots and what he's doing, so the wait doesn't look frozen.
const THINKING = ["Remy is reading your message", "Looking at your profile", "Checking your openings", "Writing his answer"];
function RemyThinking() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((n) => Math.min(n + 1, THINKING.length - 1)), 1100); return () => clearInterval(t); }, []);
  return (
    <div className="remy-thinking" role="status" aria-live="polite" data-testid="chat-thinking">
      <span className="lp-typing"><i /><i /><i /></span>
      <span key={i} className="xs muted fade-up">{THINKING[i]}…</span>
    </div>
  );
}

const PROFILE_NAME: Record<string, string> = { major: "Major", minors: "Minor", school: "School", graduation: "Graduation", location: "Location" };
const STARTERS: Record<string, string[]> = {
  Home: ["What should I focus on this week?", "Which opening fits me best right now?", "I'm not sure what career I want. Where do I start?"],
  "My Path": ["What jobs does my major lead to?", "What skill gap matters most for me?"],
  "Resume/CV": ["Which of my experiences is strongest?", "What's missing from my resume?"],
  Opportunities: ["Which deadlines are closest?", "Which of these do I actually qualify for?"],
  Interview: ["What will they ask me in an internship interview?", "Which of my stories fits a leadership question?"],
  Community: ["How do I ask an alum for a 15-minute chat?"],
  Calendar: ["Help me plan around my deadlines"],
  Progress: ["What should I do after an interview invite?"],
  Accounts: ["What do you remember about me?"],
};

function Assistant({ page, onMinimize, flyIn }: { page: string; onMinimize: () => void; flyIn: boolean }) {
  const { ws, setWs, run, save, config, theme, setTheme } = useStore();
  const preview = true; // Remy's page-specific opening line, released to everyone Nov 21 (was owners only)
  const stage2 = useOwnerView(); // redesign stage 2: profile header + Activity tab, owners first
  const pg = stage2 && page === "Account" ? "Accounts" : page; // owners: Account had Home's intro (the nav label is "Account")
  const [msg, setMsg] = useDraft("chat");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ text: string; reply: string } | null>(null); // owners: sent, not saved yet
  // The streamed reply is typed out at a steady pace: the model often sends it in one or two big pieces after a pause.
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0), targetRef = useRef(0);
  targetRef.current = pending?.reply.length || 0;
  useEffect(() => {
    if (!pending?.reply) { shownRef.current = 0; setShown(0); return; }
    if (shownRef.current >= pending.reply.length) return;
    // A timer, not requestAnimationFrame: frames stop in a background tab and the typing would stall at 0.
    const t = setTimeout(() => { shownRef.current = Math.min(pending.reply.length, shownRef.current + 3); setShown(shownRef.current); }, 16);
    return () => clearTimeout(t);
  }, [pending?.reply, shown]);
  const [hiddenDrafts, setHiddenDrafts] = useState<string[]>([]); // chat resume drafts dismissed with "Not now"
  const end = useRef<HTMLDivElement>(null);
  const [greeting, setGreeting] = useState(true);
  useEffect(() => { const t = setTimeout(() => setGreeting(false), 2800); return () => clearTimeout(t); }, []);
  const chat = ws!.chat;
  // A tailoring conversation (started by "Tailor with AI") takes over the chat box while Remy is asking.
  const tailor = useTailorSession();
  const asking = isAsking(tailor);
  const tailorEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { tailorEnd.current?.scrollIntoView({ block: "end" }); }, [tailor?.log.length]);
  const lastAi = [...chat].reverse().find((m) => m.role !== "user")?.id;
  // Owners: talk to Remy. A message you said out loud gets its answer read back.
  const talked = useRef<string | null>(null);
  const voice = useVoice(setMsg, (t) => { talked.current = lastAi || ""; send(t); });
  useEffect(() => {
    if (talked.current === null || !lastAi || lastAi === talked.current || busy) return;
    talked.current = null;
    speak(chat.find((m) => m.id === lastAi)?.text || "");
  }, [lastAi, busy]);
  const [cheer, setCheer] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!lastAi || lastAi === cheer) return;
    const t = setTimeout(() => setCheer(lastAi), 1300);
    return () => clearTimeout(t);
  }, [lastAi]);
  const mood = busy || tailor?.stage === "working" || tailor?.stage === "reading" ? "think" : greeting || asking ? "wave" : lastAi && lastAi !== cheer ? "happy" : "idle";
  // Owners: an empty chat starts at the top, so "Here's today" isn't scrolled out of view on short screens.
  useEffect(() => { if (stage2 && !chat.length && !busy) return; end.current?.scrollIntoView({ block: "end" }); }, [chat.length, busy, pending?.reply.length]);
  const send = async (text: string) => {
    if (asking) { setMsg(""); await answerTailor(text, { setWs, run }); return; }
    if (!text.trim() || busy) return;
    // A finished tailoring or outreach conversation is closed when the student starts chatting,
    // so the reply appears at the bottom instead of above it, out of view.
    if (tailor?.stage === "done") endTailor();
    setBusy(true);
    setMsg("");
    // Owners: their message shows at once and Remy's reply appears as it is written (?stream=1).
    if (stage2) setPending({ text, reply: "" });
    // The exact screen (address + the tabs and switches selected on it), so "what is this?" gets an answer about what's
    // in front of them. Home and Opportunities use pressed switch buttons, not tabs.
    const tabs = [...document.querySelectorAll(".main [role=tab][aria-selected=true], .main .seg [aria-pressed=true]")].map((t) => (t.getAttribute("aria-label") || t.textContent || "").trim()).filter(Boolean);
    const body = { message: text, page, where: location.pathname + location.search, tabs };
    const w = await run(() => stage2
      ? api<Workspace>("POST", "/api/ai/chat?stream=1", body, (d) => { if (typeof d.reply === "string") setPending({ text, reply: d.reply }); })
      : api<Workspace>("POST", "/api/ai/chat", body));
    // Let the typing finish before the saved message replaces it (at most a few seconds).
    for (let i = 0; w && stage2 && i < 150 && shownRef.current < targetRef.current; i++) await new Promise((r) => setTimeout(r, 30));
    if (w) setWs(w);
    else if (stage2) setMsg(text); // it failed: give them their words back to try again
    setPending(null);
    setBusy(false);
  };
  const remember = async (text: string) => {
    const w = await run(() => api<Workspace>("POST", "/api/memory/remember", { text }), "Saved to your AI memory");
    if (w) setWs(w);
  };
  const remembered = new Set(ws!.memory.map((m) => m.text));
  // A button Remy offered under a reply. Already-done ones show as done, so a second tap can't add it twice.
  const roles = ws!.profile.targetRoles.split(/,\s*/).filter(Boolean);
  const isDone = (a: ChatAction) => a.kind === "task" ? ws!.tasks.some((t) => t.title === a.title) : a.kind === "role" ? roles.some((r) => r.toLowerCase() === a.title.toLowerCase())
    : a.kind === "setting" ? settingNow(a.key) === a.value : a.kind === "profile" ? ws!.profile[a.field] === a.value : false;
  const settingNow = (key: string) => key === "theme" ? theme : ws!.settings.notify[key.split(".")[1] as keyof Workspace["settings"]["notify"]];
  const act = (a: ChatAction) => {
    if (a.kind === "open") return go(a.link);
    // The receipt says exactly what changed and where to undo it; run() reports a failed save instead.
    if (a.kind === "setting" && a.key === "theme") return run(() => setTheme(a.value as Theme), `${THEME_NAME[a.value as Theme]} is on. Change it anytime in Account → Appearance.`);
    if (a.kind === "setting") return run(() => save("settings", { notify: { ...ws!.settings.notify, [a.key.split(".")[1]]: a.value } }), `${NOTIFY_NAME[a.key]} ${a.value ? "on" : "off"}. Other reminders are unchanged.`);
    if (a.kind === "task") return run(() => save("tasks", [{ id: rid("t"), title: a.title, why: a.why, due: a.due || "", category: "Prepare", done: false, source: "Remy chat" }, ...ws!.tasks]), "Added to your to-dos");
    // Owners: a profile change re-checks openings and approved versions, so Remy asks and the student taps.
    if (a.kind === "profile") return run(() => save("profile", { ...ws!.profile, [a.field]: a.value }), `${PROFILE_NAME[a.field]} updated to ${a.value}`);
    if (a.kind !== "role") return; // save / tailor and the rest are done by Remy himself (owners), never offered as buttons
    return run(() => save("profile", { ...ws!.profile, targetRoles: [...roles, a.title].join(", ") }), `Remy will look for ${a.title} openings too`);
  };
  const [view, setView] = useState<"chat" | "activity">("chat");
  const [clearing, setClearing] = useState(false); // two taps: Clear chat, then Yes, clear it
  const clearChat = async () => { setClearing(false); const w = await run(() => api<Workspace>("DELETE", "/api/chat"), "Chat cleared"); if (w) setWs(w); };
  return (
    <>
      {stage2 ? (<>
      <div className="asst-profile">
        <button className="asst-x" onClick={onMinimize} aria-label="Minimize Remy" title="Minimize Remy" data-testid="button-close-assistant"><Minus size={16} /></button>
        <div className="asst-avatar"><Remy size={58} mood={mood} className={flyIn ? "fly-in" : ""} /></div>
        <b className="asst-name">Remy</b>
        <span className={"xs asst-status" + (config?.ai.available ? " on" : "")}><i />{config?.ai.available ? "Ready to help" : "AI off on this server"}</span>
        <div className="seg asst-tabs" role="tablist" aria-label="Remy">
          <button role="tab" aria-selected={view === "chat"} aria-pressed={view === "chat"} onClick={() => setView("chat")} data-testid="tab-remy-chat">Chat</button>
          <button role="tab" aria-selected={view === "activity"} aria-pressed={view === "activity"} onClick={() => setView("activity")} data-testid="tab-remy-activity">Activity</button>
        </div>
        {view === "chat" && chat.length > 0 && (clearing
          ? <span className="xs row" style={{ gap: 6, justifyContent: "center" }}>Clear the whole chat? <button className="btn btn-ghost btn-sm" onClick={clearChat} data-testid="button-clear-chat-yes">Yes, clear it</button><button className="btn btn-ghost btn-sm" onClick={() => setClearing(false)}>Keep</button></span>
          : <button className="btn btn-ghost btn-sm xs" onClick={() => setClearing(true)} data-testid="button-clear-chat">Clear chat</button>)}
      </div>
      </>) : (<>
      <div className="asst-head">
        <Remy size={34} mood={mood} className={flyIn ? "fly-in" : ""} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800 }}>Remy</div>
          <div className="xs muted">Your AI coach</div>
        </div>
        {config?.ai.available ? <StatusChip label="Live">Live AI</StatusChip> : <StatusChip label="Needs setup">AI off</StatusChip>}
        <button className="btn btn-secondary btn-sm" onClick={onMinimize} aria-label="Minimize Remy" title="Minimize Remy" data-testid="button-close-assistant"><Minus size={15} /><span className="hide-sm">Minimize</span></button>
      </div>
      </>)}
      {stage2 && view === "activity" ? <div className="asst-body"><RemyActivity /></div> : <>
      <div className="asst-body">
        {chat.length === 0 && !tailor && !busy && preview && (
          <div className="asst-intro" data-testid="assistant-welcome">
            {stage2 && <RemyToday onActivity={() => setView("activity")} />}
            <div className="bubble bubble-ai">{INTRO[pg] || INTRO.Home}</div>
            <p className="xs muted">I only use what's in your approved profile, and I never send anything for you.</p>
            <div className="asst-asks">
              <span className="xs muted">You could ask</span>
              {[LOOKING, ...(STARTERS[pg] || STARTERS.Home)].map((s) => <button key={s} className="asst-ask" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {chat.length === 0 && !tailor && !busy && !preview && (
          // Empty chat: a welcome in the middle of the panel instead of one bubble under a blank space.
          <div className="asst-welcome" data-testid="assistant-welcome">
            <Remy size={56} mood="wave" />
            <b>Hi, I'm Remy.</b>
            <p className="small muted">I can explain recommendations, help you think through choices and suggest next steps. I only use what's in your approved profile, and I never send anything for you.</p>
            <div className="stack-sm">
              {[LOOKING, ...(STARTERS[page] || STARTERS.Home)].map((s) => <button key={s} className="btn btn-secondary btn-sm asst-starter" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {chat.slice(-30).map((m) => (
          <div key={m.id} className="stack-sm" style={{ alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>{m.role === "user" ? m.text : <Rich text={m.text} />}</div>
            {m.resumeProposal && ws!.resume && (() => {
              // A resume change drafted from this message (stage 3): before → after, saved only on "Use this".
              const p = m.resumeProposal;
              const saved = JSON.stringify(p.doc) === JSON.stringify(ws!.resume!.doc);
              if (saved) return <span className="chip chip-live" data-testid="chat-resume-saved"><Check size={12} /> Saved to your resume</span>;
              if (hiddenDrafts.includes(m.id)) return null;
              // Built on an older version (edited or replaced since): saving it would undo those changes (skeptic review).
              if (p.base !== (ws!.resume!.editedAt || ws!.resume!.uploadedAt)) return <span className="xs muted">Your resume changed since this draft. Ask again and Remy will draft it on your latest version.</span>;
              const diff = resumeDiff(ws!.resume!.doc, p.doc);
              if (!diff.length) return null;
              return (
                <div className="chat-proposal" data-testid="chat-resume-proposal">
                  {diff.slice(0, 6).map((c, i) => (
                    <div key={i} className="r1-change"><span className="xs muted">{c.where}</span>{c.before && <span className="r1-before">{c.before}</span>}{c.after && <span className="r1-after">{c.after}</span>}</div>
                  ))}
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => run(() => api<Workspace>("PUT", "/api/resume/doc", { doc: p.doc, base: p.base }).then(setWs), "Saved to your resume")} data-testid="button-chat-use-change">Use this</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setHiddenDrafts((h) => [...h, m.id])}>Not now</button>
                  </div>
                </div>
              );
            })()}
            {/* What Remy did from this reply (redesign stage 6, owners first), each with Undo. */}
            <RemyDid m={m} card={!stage2} />
            {m.role !== "user" && m.id === chat[chat.length - 1]?.id && !busy && <QuickRate place="coach" id={"coach:" + m.id} label="Helpful?" />}
            {!!m.actions?.length && (
              <div className="row" style={{ gap: 6, maxWidth: "92%" }}>
                {m.actions.map((a, i) => isDone(a)
                  ? <span key={i} className="chip"><Check size={12} /> {a.kind === "task" ? "On your to-dos" : a.kind === "setting" || a.kind === "profile" ? "Done" : "In your search"}</span>
                  : <button key={i} className="btn btn-secondary btn-sm" style={{ whiteSpace: "normal", height: "auto", textAlign: "left" }} onClick={() => act(a)} data-testid="button-chat-action">{a.kind === "task" ? <>Add to-do: {a.title}</> : a.kind === "role" ? <>Look for {a.title} openings</> : a.kind === "setting" ? settingLabel(a) : a.kind === "open" ? a.label : a.kind === "profile" ? <>Change {PROFILE_NAME[a.field].toLowerCase()} to {a.value}</> : null}</button>)}
              </div>
            )}
            {m.memorySuggestions?.filter((s) => !remembered.has(s)).map((s) => (
              <div key={s} className="notice" style={{ maxWidth: "92%" }}>
                <div className="stack-sm">
                  <span className="xs muted">Remember this?</span>
                  <span className="small">{s}</span>
                  <div><button className="btn btn-secondary btn-sm" onClick={() => remember(s)} data-testid="button-remember">Remember</button></div>
                </div>
              </div>
            ))}
          </div>
        ))}
        {stage2 && chat.length > 0 && !pending && <RemyAway />}
        {pending && <div className="stack-sm" style={{ alignItems: "flex-end" }}><div className="bubble bubble-user" data-testid="chat-pending">{pending.text}</div></div>}
        {pending?.reply ? <div className="bubble bubble-ai" data-testid="chat-streaming"><Rich text={pending.reply.slice(0, shown)} /></div>
          : busy && (stage2 ? <RemyThinking /> : <div className="bubble bubble-ai row"><Spinner /> Thinking…</div>)}
        {tailor && (
          // Owners: the tailoring talk is part of the chat, not a box inside it (Dilan, Nov 23).
          <div className={stage2 ? "stack-sm" : "asst-card stack-sm"} data-testid="tailor-chat">
            <span className={stage2 ? "xs muted" : "eyebrow"}>{tailor.title}</span>
            {tailor.log.map((m, i) => <div key={i} className={`bubble ${m.role === "me" ? "bubble-user" : "bubble-ai"}`}>{m.text}</div>)}
            {tailor.stage === "asking" && (() => {
              const q = tailor.qs[tailor.idx];
              const taps = [...(q?.options || []), ...(q?.pick ? [q.pick] : [])];
              // Draft-first (stage 3): every question gets "Other" (write your own) and "Skip the rest".
              const extra = tailor.drafted && q?.key !== "_ok";
              const tapStyle = { justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left", height: "auto", padding: "8px 12px" } as const;
              return (taps.length > 0 || extra) && (
                <div className="stack-sm" data-testid="tailor-options">
                  {taps.map((o) => (
                    <button key={o} className={`btn ${o === q.pick ? "btn-ghost" : "btn-secondary"} btn-sm`} style={tapStyle} onClick={() => send(o)} data-testid="tailor-option">{o}</button>
                  ))}
                  {extra && <button className="btn btn-secondary btn-sm" style={tapStyle} onClick={() => { const el = document.querySelector<HTMLTextAreaElement>('[data-testid="input-chat"]'); el?.focus(); el?.setAttribute("placeholder", "Write your own answer…"); }} data-testid="tailor-other">Other (write your own)</button>}
                  {extra && <button className="btn btn-ghost btn-sm" style={tapStyle} onClick={() => send("Skip the rest")} data-testid="tailor-skip-rest">Skip the rest</button>}
                </div>
              );
            })()}
            {(tailor.stage === "working" || tailor.stage === "reading") && <div className="bubble bubble-ai row"><Spinner /> {tailor.stage === "reading" ? "Reading…" : "Working on it…"}</div>}
            <div ref={tailorEnd} />
          </div>
        )}
        {chat.length === 1 && !busy && !tailor && (
          <div className="stack-sm">
            {(STARTERS[page] || STARTERS.Home).map((s) => (
              <button key={s} className="btn btn-secondary btn-sm" style={{ justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left", height: "auto", padding: "8px 12px" }} onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      {stage2 && <OfferSlot />}
      <form className="asst-foot" onSubmit={(e) => { e.preventDefault(); send(msg); }}>
        <textarea
          className="input asst-input"
          rows={2}
          value={msg}
          onChange={(e) => { setMsg(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(msg); } }}
          placeholder={tailor?.stage === "reading" ? "Remy is reading the posting…" : asking ? "Answer Remy… (or type skip)" : config?.ai.available ? "Ask Remy anything… (Shift+Enter for a new line)" : "AI needs setup on this server"}
          disabled={(!config?.ai.available && !asking) || tailor?.stage === "reading"}
          aria-label="Message Remy"
          data-testid="input-chat"
        />
        {stage2 && canListen && config?.ai.available && !asking && <button type="button" className={"btn " + (voice.on ? "btn-primary remy-listening" : "btn-secondary")} onClick={voice.toggle} disabled={busy} aria-label={voice.on ? "Stop listening" : "Talk to Remy"} aria-pressed={voice.on} data-testid="button-chat-mic">{voice.on ? <Square size={16} /> : <Mic size={16} />}</button>}
        <button className="btn btn-primary" disabled={(busy && !asking) || !msg.trim() || tailor?.stage === "reading"} aria-label="Send" data-testid="button-send-chat"><Send size={16} /></button>
      </form>
      </>}
    </>
  );
}


const MENU: [string, string][] = [["profile", "Profile"], ["settings", "Settings"], ["memory", "AI memory"], ["sources", "Connected sources"], ["data", "Account & data"]];

/** The name at the bottom of the sidebar: opens Profile, Settings and the rest of Account. */
function ProfileMenu({ initials, active }: { initials: string; active: boolean }) {
  const { ws, me, run, refresh, save } = useStore();
  const ownerView = useOwnerView();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const kind = me?.kind === "google" || me?.kind === "supabase" ? (me.email || "Signed in") : "Guest workspace";
  const signOut = async () => { setOpen(false); await run(() => api("POST", "/api/auth/logout")); await refresh(); };
  return (
    <div className="side-foot" ref={ref}>
      <button className={"profile-btn" + (active ? " on" : "")} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} data-testid="button-profile-menu">
        <Avatar initials={initials} />
        <div className="side-foot-text" style={{ minWidth: 0, textAlign: "left" }}>
          <div className="small" style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ws!.profile.preferredName || knownName(ws!) || "Student"}</div>
          <div className="xs muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kind}</div>
        </div>
      </button>
      {open && (
        <div className="profile-menu fade-up" role="menu">
          {ownerView ? <>
            {/* Owners first (Dilan, Nov 22: "too much on there"): the account page has the other tabs; the view switch,
                dashboard and theme now sit in the side bar. */}
            <button role="menuitem" onClick={() => { setOpen(false); go("/accounts?tab=profile"); }} data-testid="menu-profile">Profile & account</button>
            <button role="menuitem" onClick={() => { setOpen(false); go("/accounts?tab=settings"); }} data-testid="menu-settings">Settings</button>
            <button role="menuitem" onClick={() => { setOpen(false); setFeedback(true); }} data-testid="menu-feedback">Send feedback</button>
            <div className="divider" />
            <div className="menu-links">
              <button onClick={() => { setOpen(false); tourAgain(save); go("/"); }} data-testid="menu-tour">Tour</button>
              <button onClick={() => { setOpen(false); go("/about"); }} data-testid="menu-about">About</button>
              <button onClick={() => { setOpen(false); go("/policies"); }} data-testid="menu-policies">Privacy</button>
            </div>
          </> : <>
          {MENU.map(([k, l]) => (
            <button key={k} role="menuitem" onClick={() => { setOpen(false); go(`/accounts?tab=${k}`); }} data-testid={`menu-${k}`}>{l}</button>
          ))}
          <div className="divider" />
          <button role="menuitem" onClick={() => { setOpen(false); tourAgain(save); go("/"); }} data-testid="menu-tour">Show me around again</button>
          <button role="menuitem" onClick={() => { setOpen(false); go("/about"); }} data-testid="menu-about">About Remy</button>
          <button role="menuitem" onClick={() => { setOpen(false); go("/policies"); }} data-testid="menu-policies">Privacy & terms</button>
          <button role="menuitem" onClick={() => { setOpen(false); setFeedback(true); }} data-testid="menu-feedback">Send feedback</button>
          </>}
          <div className="divider" />
          <button role="menuitem" onClick={signOut} data-testid="menu-sign-out">Sign out</button>
        </div>
      )}
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </div>
  );
}

/** "Send feedback": a few words about what's confusing or broken; it lands in the owners' dashboard. A screenshot can
 *  go with it (owner feedback #57): chosen or pasted, shrunk here first (longest side 1600px, JPEG). */
function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { run, toast } = useStore();
  const { path } = useRoute();
  const [text, setText] = useDraft("feedback");
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const pick = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);
  const attach = async (file?: File | null) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(file.type)) { toast("Attach an image (a screenshot), like a PNG or JPG."); return; }
    const blob = await shrink(file).catch(() => null);
    if (!blob) { toast("Remy couldn't read that image. Try another screenshot."); return; }
    setShot({ blob, url: URL.createObjectURL(blob) });
  };
  const send = async () => {
    setBusy(true);
    let body: unknown = { message: text, page: path };
    if (shot) { const fd = new FormData(); fd.append("message", text); fd.append("page", path); fd.append("file", shot.blob, "screenshot.jpg"); body = fd; }
    const ok = await run(() => api("POST", "/api/feedback", body), "Thanks! The Remy team reads every note.");
    setBusy(false);
    if (ok) { setText(""); setShot(null); onClose(); }
  };
  return (
    <Modal title="Send feedback" onClose={onClose}>
      <div className="stack-sm">
        <p className="small muted">Something confusing, broken, or missing? Tell the Remy team in a sentence or two. It's sent with the page you're on, not your resume or chats (unless a screenshot you add shows them).</p>
        <textarea className="textarea" autoFocus value={text} onChange={(e) => setText(e.target.value)} onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/")); if (f && !e.clipboardData.getData("text/plain")) { e.preventDefault(); attach(f); } }} placeholder="e.g. I couldn't find where to change my graduation date" aria-label="Your feedback" style={{ minHeight: 110 }} data-testid="input-feedback" />
        {shot ? (
          <div className="row" style={{ gap: 10, alignItems: "flex-start", flexWrap: "nowrap" }} data-testid="feedback-shot">
            <img src={shot.url} alt="Your screenshot" style={{ maxWidth: 160, maxHeight: 110, borderRadius: 8, border: "1px solid var(--line)", objectFit: "cover" }} />
            <div className="stack-sm" style={{ gap: 4 }}><span className="xs muted">Screenshot attached. Only the Remy team sees it.</span><button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setShot(null)} data-testid="button-remove-shot">Remove</button></div>
          </div>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => pick.current?.click()} data-testid="button-add-shot"><ImagePlus size={15} /> Add a screenshot</button>
            <span className="xs muted">Optional. You can also paste one into the box. Only the Remy team sees it.</span>
            <input ref={pick} type="file" accept="image/*" hidden onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-shot" />
          </div>
        )}
        <div className="row-between"><button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button><button className="btn btn-primary btn-sm" onClick={send} disabled={busy || text.trim().length < 3} data-testid="button-send-feedback">{busy && <Spinner />} Send</button></div>
      </div>
    </Modal>
  );
}

/** A screenshot as a JPEG no wider or taller than 1600px, small enough to send (the server takes up to 2 MB). */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); // transparent PNGs get a white background, not black
  g.drawImage(img, 0, 0, c.width, c.height);
  for (const q of [0.85, 0.7, 0.5]) {
    const b = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));
    if (b && b.size <= 1_900_000) return b;
  }
  throw new Error("too large");
}

/** Owners only: switch between owner view (Career quest, owner notes, the dashboard link) and seeing Remy exactly as a
 *  student does. Saved on the account, so it holds on every device (Dilan, Nov 19). */
/** Owners only (Dilan, Nov 22): the owner/student view switch, the owners' dashboard and light/dark in plain sight in
 *  the side bar (and the phone's More sheet) instead of inside the name menu. Shown in student view too, to switch back. */
function OwnerTools({ onDone }: { onDone?: () => void }) {
  const { me, ws, save, run } = useStore();
  const on = useOwnerView();
  if (!me?.owner || !ws) return null;
  const set = (v: boolean) => { onDone?.(); if (v !== on) run(() => save("settings", { ...ws.settings, ownerView: v }), v ? "Owner view is on" : "Student view: you see Remy like a student"); };
  return (
    <div className="owner-tools" data-testid="owner-tools">
      <div className="seg owner-seg" role="group" aria-label="View as">
        <button aria-pressed={on} onClick={() => set(true)} data-testid="button-view-owner">Owner</button>
        <button aria-pressed={!on} onClick={() => set(false)} data-testid="button-view-student">Student</button>
      </div>
      {/* collapsed side bar: one icon flips the view (the two-word switch doesn't fit 72px) */}
      <button className="icon-btn owner-flip" onClick={() => set(!on)} title={on ? "Owner view (click for student view)" : "Student view (click for owner view)"} aria-label={on ? "Switch to student view" : "Switch to owner view"} data-testid="button-view-flip">{on ? <UserCog size={17} /> : <Users size={17} />}</button>
      <a className="icon-btn" href="/admin" onClick={() => onDone?.()} title="Owners' dashboard" aria-label="Owners' dashboard" data-testid="nav-admin"><Gauge size={17} /></a>
      <ThemeToggle />
    </div>
  );
}

