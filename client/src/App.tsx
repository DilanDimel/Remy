import { uiFlags } from "./lib/router";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3, Briefcase, CalendarDays, ChevronsLeft, ChevronsRight, Compass, FileText, Home as HomeIcon, Menu, Send,
  Minus, UserCog, Users,
} from "lucide-react";
import { StoreProvider, api, useStore } from "./lib/store";
import { go, useRoute } from "./lib/router";
import { Modal, Remy, Spinner, StatusChip } from "./components/common";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { answer as answerTailor, endSession as endTailor, isAsking, onOpenRequest, useTailorSession } from "./lib/tailorChat";
import Welcome from "./pages/Welcome";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import PathPage from "./pages/Path";
import Resume from "./pages/Resume";
import Opportunities from "./pages/Opportunities";
import Community from "./pages/Community";
import CalendarPage from "./pages/Calendar";
import Progress from "./pages/Progress";
import Accounts from "./pages/Accounts";
import type { Workspace } from "@shared/types";

const NAV = [
  { path: "/", label: "Home", icon: HomeIcon },
  { path: "/path", label: "My Path", icon: Compass },
  { path: "/resume", label: "Resume/CV", icon: FileText },
  { path: "/opportunities", label: "Opportunities", icon: Briefcase },
  { path: "/community", label: "Community", icon: Users },
  { path: "/calendar", label: "Calendar", icon: CalendarDays },
  { path: "/progress", label: "Progress", icon: BarChart3 },
];
const ACCOUNTS = { path: "/accounts", label: "Account", icon: UserCog };

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
  const { loading, ws, me, signInAgain } = useStore();
  if (loading)
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div className="stack" style={{ alignItems: "center" }}><Remy size={64} mood="think" /><span className="muted small">Remy is getting things ready…</span></div>
      </div>
    );
  if (!me || !ws || !ws.started || signInAgain) return <Welcome />;
  if (!ws.onboarding.done) return <Onboarding />;
  return <Shell />;
}

function isMobileNow() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 1020px)").matches;
}

function Shell() {
  const { ws, save, me } = useStore();
  const { path, query } = useRoute();
  const [asstPage, setAsstPage] = useState<boolean | null>(null);
  const [more, setMore] = useState(false);
  const [flyIn, setFlyIn] = useState(() => uiFlags.flyIn);
  useEffect(() => {
    if (flyIn) {
      uiFlags.flyIn = false;
      const t = setTimeout(() => setFlyIn(false), 900);
      return () => clearTimeout(t);
    }
  }, [flyIn]);
  useEffect(() => { if (isMobileNow()) setAsstPage(null); }, [path]);
  const w = ws as Workspace;
  // Remy stays open on every page until the student minimizes him. On small screens the
  // panel would cover the page, so there he starts minimized as the docked fox button.
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1020px)").matches;
  const asstOpen = asstPage ?? (isMobile ? false : w.settings.assistantOpen);
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
      case "/accounts": return <Accounts query={query} />;
      default: return <Home />;
    }
  })();
  const initials = (w.profile.preferredName || w.profile.name || me?.name || "S").split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className={`shell ${collapsed ? "nav-collapsed" : ""} ${asstOpen ? "asst-open" : ""}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="logo"><Remy size={26} /><span className="logo-text">Remy<b>.</b></span></span>
          <button className="icon-btn" onClick={() => save("settings", { navCollapsed: !collapsed })} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} data-testid="button-toggle-nav">
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>
        {NAV.map((n) => (
          <a key={n.path} href={"#" + n.path} className="nav-item" aria-current={current.path === n.path ? "page" : undefined} title={n.label} data-testid={`nav-${n.label.toLowerCase().replace(/[^a-z]/g, "")}`}>
            <n.icon size={19} />
            <span className="nav-label">{n.label}</span>
            {n.path === "/resume" && pendingReview > 0 && <span className="count">{pendingReview}</span>}
            {n.path === "/progress" && openSuggestions > 0 && <span className="count">{openSuggestions}</span>}
          </a>
        ))}
        <ProfileMenu initials={initials} active={path.startsWith("/accounts")} />
      </aside>

      <main className="main" id="main">
        <div className="topbar">
          <div className="crumb">Remy › <b>{current.label}</b></div>
          <div style={{ marginLeft: "auto" }} className="row">
            {!asstOpen && (
              <button className="btn btn-secondary btn-sm hide-sm" onClick={() => setAsst(true)} data-testid="button-open-assistant">
                <Remy size={18} /> Open Remy
              </button>
            )}
          </div>
        </div>
        <div className="page fade-up" key={current.path}><ErrorBoundary where={`page:${current.path}`} resetKey={current.path}>{page}</ErrorBoundary></div>
      </main>

      {asstOpen && <aside className="assistant" aria-label="Remy assistant" data-testid="assistant-panel"><ErrorBoundary where="assistant" compact><Assistant page={current.label} onMinimize={() => setAsst(false)} flyIn={flyIn} /></ErrorBoundary></aside>}

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV.filter((n) => ["/", "/path", "/resume", "/opportunities", "/progress"].includes(n.path)).map((n) => (
          <a key={n.path} href={"#" + n.path} aria-current={current.path === n.path ? "page" : undefined}>
            <n.icon size={19} />
            {n.label === "Opportunities" ? "Jobs" : n.label === "Resume/CV" ? "Resume" : n.label}
          </a>
        ))}
        <a href="#" onClick={(e) => { e.preventDefault(); setMore(true); }} data-testid="mobile-more"><Menu size={19} />More</a>
      </nav>
      {!asstOpen && (
        <button className="asst-fab fade-up" onClick={() => setAsst(true)} data-testid="button-fab-assistant" aria-label="Open Remy">
          <Remy size={30} mood="wave" /> <span className="hide-sm">Remy</span>
        </button>
      )}
      {more && (
        <Modal title="More" onClose={() => setMore(false)}>
          <div className="stack-sm">
            {[...NAV.filter((n) => ["/community", "/calendar"].includes(n.path)), ACCOUNTS].map((n) => (
              <button key={n.path} className="nav-item" onClick={() => { setMore(false); go(n.path); }}><n.icon size={19} />{n.label}</button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

const STARTERS: Record<string, string[]> = {
  Home: ["What should I focus on this week?", "Which opening fits me best right now?"],
  "My Path": ["What roles connect finance and information systems?", "What skill gap matters most for me?"],
  "Resume/CV": ["Which of my experiences is strongest for banking?", "How should I explain my club leadership?"],
  Opportunities: ["Which deadlines are closest?", "Am I eligible for sophomore programs?"],
  Community: ["How do I ask an alum for a 15-minute chat?"],
  Calendar: ["Help me plan around my deadlines"],
  Progress: ["What should I do after an interview invite?"],
  Accounts: ["What do you remember about me?"],
};

function Assistant({ page, onMinimize, flyIn }: { page: string; onMinimize: () => void; flyIn: boolean }) {
  const { ws, setWs, run, config } = useStore();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
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
  const [cheer, setCheer] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!lastAi || lastAi === cheer) return;
    const t = setTimeout(() => setCheer(lastAi), 1300);
    return () => clearTimeout(t);
  }, [lastAi]);
  const mood = busy || tailor?.stage === "working" ? "think" : greeting || asking ? "wave" : lastAi && lastAi !== cheer ? "happy" : "idle";
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [chat.length, busy]);
  const send = async (text: string) => {
    if (asking) { setMsg(""); await answerTailor(text, { setWs, run }); return; }
    if (!text.trim() || busy) return;
    // A finished tailoring or outreach conversation is closed when the student starts chatting,
    // so the reply appears at the bottom instead of above it, out of view.
    if (tailor?.stage === "done") endTailor();
    setBusy(true);
    setMsg("");
    const w = await run(() => api<Workspace>("POST", "/api/ai/chat", { message: text, page }));
    if (w) setWs(w);
    setBusy(false);
  };
  const remember = async (text: string) => {
    const w = await run(() => api<Workspace>("POST", "/api/memory/remember", { text }), "Saved to your AI memory");
    if (w) setWs(w);
  };
  const remembered = new Set(ws!.memory.map((m) => m.text));
  return (
    <>
      <div className="asst-head">
        <Remy size={34} mood={mood} className={flyIn ? "fly-in" : ""} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800 }}>Remy</div>
          <div className="xs muted">Your AI coach</div>
        </div>
        {config?.ai.available ? <StatusChip label="Live">Live AI</StatusChip> : <StatusChip label="Needs setup">AI off</StatusChip>}
        <button className="btn btn-secondary btn-sm" onClick={onMinimize} aria-label="Minimize Remy" title="Minimize Remy" data-testid="button-close-assistant"><Minus size={15} /><span className="hide-sm">Minimize</span></button>
      </div>
      <div className="asst-body">
        {chat.length === 0 && (
          <div className="bubble bubble-ai">
            Hi, I'm Remy! I can explain recommendations, help you think through choices, and suggest next steps. I only use what's in your approved profile — and I'll never send anything for you.
          </div>
        )}
        {chat.slice(-30).map((m) => (
          <div key={m.id} className="stack-sm" style={{ alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-ai"}`}>{m.text}</div>
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
        {busy && <div className="bubble bubble-ai row"><Spinner /> Thinking…</div>}
        {tailor && (
          <div className="asst-card stack-sm" data-testid="tailor-chat">
            <span className="eyebrow">{tailor.title}</span>
            {tailor.log.map((m, i) => <div key={i} className={`bubble ${m.role === "me" ? "bubble-user" : "bubble-ai"}`}>{m.text}</div>)}
            {tailor.stage === "working" && <div className="bubble bubble-ai row"><Spinner /> Working on it…</div>}
            <div ref={tailorEnd} />
          </div>
        )}
        {chat.length < 2 && !busy && !tailor && (
          <div className="stack-sm">
            {(STARTERS[page] || STARTERS.Home).map((s) => (
              <button key={s} className="btn btn-secondary btn-sm" style={{ justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left", height: "auto", padding: "8px 12px" }} onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      <form className="asst-foot" onSubmit={(e) => { e.preventDefault(); send(msg); }}>
        <textarea
          className="input asst-input"
          rows={2}
          value={msg}
          onChange={(e) => { setMsg(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(msg); } }}
          placeholder={asking ? "Answer Remy… (or type skip)" : config?.ai.available ? "Ask Remy anything… (Shift+Enter for a new line)" : "AI needs setup on this server"}
          disabled={!config?.ai.available && !asking}
          aria-label="Message Remy"
          data-testid="input-chat"
        />
        <button className="btn btn-primary" disabled={(busy && !asking) || !msg.trim()} aria-label="Send" data-testid="button-send-chat"><Send size={16} /></button>
      </form>
    </>
  );
}


const MENU: [string, string][] = [["profile", "Profile"], ["settings", "Settings"], ["memory", "AI memory"], ["sources", "Connected sources"], ["data", "Account & data"]];

/** The name at the bottom of the sidebar: opens Profile, Settings and the rest of Account. */
function ProfileMenu({ initials, active }: { initials: string; active: boolean }) {
  const { ws, me, run, refresh } = useStore();
  const [open, setOpen] = useState(false);
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
        <div className="avatar">{me?.picture ? <img src={me.picture} alt="" referrerPolicy="no-referrer" /> : initials}</div>
        <div className="side-foot-text" style={{ minWidth: 0, textAlign: "left" }}>
          <div className="small" style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ws!.profile.preferredName || ws!.profile.name || "Student"}</div>
          <div className="xs muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kind}</div>
        </div>
      </button>
      {open && (
        <div className="profile-menu fade-up" role="menu">
          {MENU.map(([k, l]) => (
            <button key={k} role="menuitem" onClick={() => { setOpen(false); go(`/accounts?tab=${k}`); }} data-testid={`menu-${k}`}>{l}</button>
          ))}
          <div className="divider" />
          <button role="menuitem" onClick={signOut} data-testid="menu-sign-out">Sign out</button>
        </div>
      )}
    </div>
  );
}
