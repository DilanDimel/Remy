import { uiFlags } from "./lib/router";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3, Briefcase, CalendarDays, ChevronsLeft, ChevronsRight, Compass, FileText, Home as HomeIcon, Menu, Send,
  Sparkles, UserCog, Users, X,
} from "lucide-react";
import { StoreProvider, api, useStore } from "./lib/store";
import { go, useRoute } from "./lib/router";
import { Modal, Pip, Spinner, StatusChip } from "./components/common";
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
  { path: "/accounts", label: "Accounts", icon: UserCog },
];

export default function App() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}

function Root() {
  const { loading, ws, me } = useStore();
  if (loading)
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div className="stack" style={{ alignItems: "center" }}><Pip size={64} /><span className="muted small">Opening Offer Ready…</span></div>
      </div>
    );
  if (!me || !ws || !ws.started) return <Welcome />;
  if (!ws.onboarding.done) return <Onboarding />;
  return <Shell />;
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
  useEffect(() => setAsstPage(null), [path]);
  const w = ws as Workspace;
  const onAccounts = path === "/accounts";
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 1020px)").matches;
  const asstOpen = asstPage ?? (onAccounts || isMobile ? false : w.settings.assistantOpen);
  const setAsst = (open: boolean) => {
    setAsstPage(open);
    if (!onAccounts && !isMobile) save("settings", { assistantOpen: open });
  };
  const collapsed = w.settings.navCollapsed;
  const current = NAV.find((n) => (n.path === "/" ? path === "/" : path.startsWith(n.path))) || NAV[0];
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
          <span className="logo"><span className="logo-text">offer<b>ready.</b></span>{collapsed && <b>o.</b>}</span>
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
        <div className="side-foot">
          <div className="avatar">{me?.picture ? <img src={me.picture} alt="" referrerPolicy="no-referrer" /> : initials}</div>
          <div className="side-foot-text" style={{ minWidth: 0 }}>
            <div className="small" style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.profile.preferredName || w.profile.name || "Student"}</div>
            <div className="xs muted">{me?.kind === "google" ? "Google account" : "Demo workspace"}</div>
          </div>
        </div>
      </aside>

      <main className="main" id="main">
        <div className="topbar">
          <div className="crumb">Offer Ready › <b>{current.label}</b></div>
          <div style={{ marginLeft: "auto" }} className="row">
            {!asstOpen && (
              <button className="btn btn-secondary btn-sm hide-sm" onClick={() => setAsst(true)} data-testid="button-open-assistant">
                <Sparkles size={15} /> Ask Pip
              </button>
            )}
          </div>
        </div>
        <div className="page fade-up" key={current.path}>{page}</div>
      </main>

      {asstOpen && <Assistant page={current.label} onClose={() => setAsst(false)} flyIn={flyIn} />}

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
        <button className="asst-fab mobile-only" onClick={() => setAsst(true)} data-testid="button-fab-assistant" aria-label="Ask Pip">
          <Pip size={30} /> <span>Ask Pip</span>
        </button>
      )}
      {more && (
        <Modal title="More" onClose={() => setMore(false)}>
          <div className="stack-sm">
            {NAV.filter((n) => ["/community", "/calendar", "/accounts"].includes(n.path)).map((n) => (
              <button key={n.path} className="nav-item" onClick={() => { setMore(false); go(n.path); }}><n.icon size={19} />{n.label}</button>
            ))}
          </div>
        </Modal>
      )}
      <style>{`.mobile-only{display:none}@media (max-width:760px){.mobile-only{display:flex}}`}</style>
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

function Assistant({ page, onClose, flyIn }: { page: string; onClose: () => void; flyIn: boolean }) {
  const { ws, setWs, run, config } = useStore();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const chat = ws!.chat;
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [chat.length, busy]);
  const send = async (text: string) => {
    if (!text.trim() || busy) return;
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
    <aside className="assistant" aria-label="Pip assistant" data-testid="assistant-panel">
      <div className="asst-head">
        <Pip size={34} mood={busy ? "think" : "idle"} className={flyIn ? "fly-in" : ""} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Pip</div>
          <div className="xs muted">Knows your approved profile · {page}</div>
        </div>
        {config?.ai.available ? <StatusChip label="Live">Live AI</StatusChip> : <StatusChip label="Needs setup">AI off</StatusChip>}
        <button className="icon-btn" onClick={onClose} aria-label="Close assistant" data-testid="button-close-assistant"><X size={18} /></button>
      </div>
      <div className="asst-body">
        {chat.length === 0 && (
          <div className="bubble bubble-ai">
            Hi! I can explain recommendations, help you think through choices, and suggest next steps. I only use what's in your approved profile — and I'll never send anything for you.
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
        {chat.length < 2 && !busy && (
          <div className="stack-sm">
            {(STARTERS[page] || STARTERS.Home).map((s) => (
              <button key={s} className="btn btn-secondary btn-sm" style={{ justifyContent: "flex-start", whiteSpace: "normal", textAlign: "left", height: "auto", padding: "8px 12px" }} onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        <div ref={end} />
      </div>
      <form className="asst-foot" onSubmit={(e) => { e.preventDefault(); send(msg); }}>
        <input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={config?.ai.available ? "Ask Pip anything…" : "AI needs setup on this server"} disabled={!config?.ai.available} aria-label="Message Pip" data-testid="input-chat" />
        <button className="btn btn-primary" disabled={busy || !msg.trim()} aria-label="Send" data-testid="button-send-chat"><Send size={16} /></button>
      </form>
    </aside>
  );
}

