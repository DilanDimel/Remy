import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BarChart3, BellRing, Briefcase, CalendarDays, ChevronLeft, ChevronRight, Compass, FileText, Home, Info, LayoutDashboard, type LucideIcon, Mail, Megaphone, MessagesSquare, Mic, Sparkles, UserCog, Users, X } from "lucide-react";
import { newsLink, showsNews, type NewsItem } from "@shared/news";
import { NEWS, latestNewsId, unseenNews } from "../lib/news";
import { go } from "../lib/router";
import { useOwnerView, useOwnersOnly, useStore } from "../lib/store";
import { Modal, Remy } from "./common";

const KIND: Record<string, string> = { New: "chip-live", Improved: "chip-student", Fixed: "chip-plain", Changed: "chip-demo" };
const fmt = (d: string) => new Date(d + "T12:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** A quiet "What's new" button: a count only when there's something unseen, the list only when opened. */
export function WhatsNew({ className = "nav-item", label = true }: { className?: string; label?: boolean }) {
  const { ws, save } = useStore();
  const [open, setOpen] = useState(false);
  const [seenAtOpen, setSeenAtOpen] = useState<string | undefined>();
  const redesign = useOwnerView(); // the new What's new panel: owners, and everyone once the redesign is released
  const owner = useOwnersOnly(); // owner-only notes stay with owners after the release
  const unseen = unseenNews(ws?.settings.newsSeen, owner, redesign).length;
  const show = () => {
    setSeenAtOpen(ws?.settings.newsSeen ?? "");
    setOpen(true);
    if (unseen && ws) save("settings", { newsSeen: latestNewsId() });
  };
  const items = NEWS.filter((n) => showsNews(n, owner, redesign)).sort((a, b) => (a.id < b.id ? 1 : -1));
  const days = [...new Set(items.map((n) => n.date))];
  return (
    <>
      <button className={className} onClick={show} title="What's new" data-testid="button-whats-new">
        <Megaphone size={19} />
        {label && <span className="nav-label">What's new</span>}
        {unseen > 0 && <span className="count" aria-label={`${unseen} new`}>{unseen}</span>}
      </button>
      {open && redesign && <NewsPanel items={items} seen={seenAtOpen} onClose={() => setOpen(false)} />}
      {open && !redesign && (
        <Modal title="What's new in Remy" onClose={() => setOpen(false)}>
          <div className="stack" data-testid="whats-new-list">
            {days.map((d) => (
              <section key={d} className="stack-sm">
                <h3 className="xs muted" style={{ textTransform: "none" }}>{fmt(d)}</h3>
                {items.filter((n) => n.date === d).map((n) => (
                  <div key={n.id} className="stack-sm" style={{ gap: 4 }}>
                    <div className="row" style={{ gap: 8 }}><span className={"chip " + KIND[n.kind]}>{n.kind}</span><b className="small">{n.title}</b></div>
                    <p className="small muted">{n.body}</p>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

// Owners' What's new (redesign, Nov 23): a day-by-day timeline beside the selected note, with a real Try it button.
const PAGE: Record<string, [string, LucideIcon]> = {
  "/": ["Home", Home], "/path": ["My Path", Compass], "/resume": ["Resume", FileText], "/opportunities": ["Opportunities", Briefcase],
  "/interview": ["Interview", MessagesSquare], "/calendar": ["Calendar", CalendarDays], "/progress": ["Progress", BarChart3],
  "/community": ["Community", Users], "/accounts": ["Account", UserCog], "/about": ["About", Info], "/admin": ["Dashboard", LayoutDashboard],
};
// shortcut: icon from keywords in the title, then the note's page; add an `icon` field to NewsItem if this guesses wrong often.
const WORDS: [RegExp, LucideIcon][] = [[/email|emailed/i, Mail], [/out loud|talk|voice/i, Mic], [/text|alert|remind/i, BellRing], [/dashboard/i, LayoutDashboard], [/chat|ask remy|remy does|answers/i, MessagesSquare]];
const pageOf = (n: NewsItem) => { const to = newsLink(n); return to ? PAGE[to.split("?")[0]] : undefined; };
const iconOf = (n: NewsItem) => WORDS.find(([re]) => re.test(n.title))?.[1] ?? pageOf(n)?.[1] ?? Sparkles;
const dayName = (d: string) => {
  const diff = Math.round((new Date().setHours(12, 0, 0, 0) - new Date(d + "T12:00").getTime()) / 864e5);
  const date = new Date(d + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return diff === 0 ? `Today · ${date}` : diff === 1 ? `Yesterday · ${date}` : date;
};

function NewsPanel({ items, seen, onClose }: { items: NewsItem[]; seen?: string; onClose: () => void }) {
  const [sel, setSel] = useState(items[0]?.id);
  const [detail, setDetail] = useState(false); // phones: the list first, a tap opens the note
  const i = Math.max(0, items.findIndex((n) => n.id === sel));
  const n = items[i];
  const [viewed, setViewed] = useState<Set<string | undefined>>(() => new Set());
  // a note's dot goes once you've opened it (phones open the list first, so only a tapped note counts there)
  useEffect(() => { if (detail || !matchMedia("(max-width: 690px)").matches) setViewed((v) => new Set(v).add(sel)); }, [sel, detail]);
  const fresh = (x: NewsItem) => !!seen && x.id > seen && !viewed.has(x.id);
  const newCount = items.filter(fresh).length;
  const days = [...new Set(items.map((x) => x.date))];
  const pick = (id: string) => { setSel(id); setDetail(true); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" && items[i + 1]) setSel(items[i + 1].id);
      if (e.key === "ArrowUp" && items[i - 1]) setSel(items[i - 1].id);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, items, i]);
  useEffect(() => { document.querySelector(".wn-ti[aria-current='true']")?.scrollIntoView({ block: "nearest" }); }, [sel]);
  if (!n) return null;
  const to = newsLink(n);
  const page = pageOf(n);
  const Icon = iconOf(n);
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wn" data-view={detail ? "detail" : "list"} role="dialog" aria-modal="true" aria-label="What's new in Remy">
        <aside className="wn-left">
          <div className="wn-head">
            <Remy size={40} />
            <div><h2>What’s new</h2><p className="xs muted">{!seen ? `${items.length} updates so far` : newCount ? `${newCount} new since you last looked` : "You’re all caught up"}</p></div>
            <button className="icon-btn wn-x-phone" onClick={onClose} aria-label="Close" data-testid="button-close-news-list"><X size={18} /></button>
          </div>
          <nav className="wn-tl" data-testid="whats-new-list">
            {days.map((d) => (
              <section key={d}>
                <h3>{dayName(d)}</h3>
                {items.filter((x) => x.date === d).map((x) => {
                  const XIcon = iconOf(x);
                  return (
                    <button key={x.id} className="wn-ti" aria-current={x.id === n.id} onClick={() => pick(x.id)} data-testid="button-news-item">
                      <XIcon size={16} /><span>{x.title}</span>{fresh(x) && <i className="wn-dot" aria-label="New to you" />}
                    </button>
                  );
                })}
              </section>
            ))}
          </nav>
        </aside>
        <main className="wn-right" data-testid="whats-new-detail">
          <div className="wn-top">
            <button className="btn btn-ghost btn-sm wn-back" onClick={() => setDetail(false)} data-testid="button-news-back"><ChevronLeft size={16} />All updates</button>
            <div className="wn-meta"><span className={"chip " + KIND[n.kind]}>{n.kind}</span><span>{dayName(n.date)}{n.owners ? " · Owners only" : ""}</span></div>
            <button className="icon-btn" onClick={onClose} aria-label="Close" data-testid="button-close-modal"><X size={18} /></button>
          </div>
          <div className="wn-pv" aria-hidden>
            <div className="wn-pv-ic"><Icon size={24} /></div>
            <div className="wn-win">
              <div className="wn-bar"><i /><i /><i /></div>
              <div className="wn-body">
                <div className="wn-side"><span /><span className="on" /><span /><span /></div>
                <div className="wn-main">
                  <div className="l" style={{ width: "55%" }} /><div className="l" style={{ width: "35%" }} />
                  <div className="wn-card"><div className="wn-logo" /><div style={{ flex: 1 }}><div className="l" style={{ width: "70%" }} /><div className="l" style={{ width: "40%" }} /></div><div className="wn-pill"><Icon size={12} />{page?.[0] ?? "Remy"}</div></div>
                  <div className="wn-card faded"><div className="wn-logo" /><div style={{ flex: 1 }}><div className="l" style={{ width: "60%" }} /><div className="l" style={{ width: "30%" }} /></div></div>
                </div>
              </div>
            </div>
          </div>
          <h2 className="wn-title">{n.title}</h2>
          <p className="wn-text">{n.body}</p>
          <div className="wn-acts">
            {to ? <button className="btn btn-primary wn-try" onClick={() => { onClose(); go(to); }} data-testid="button-news-try">Try it{page ? ` on ${page[0]}` : ""}<ArrowRight size={16} /></button> : <span />}
            <div className="wn-nav">
              <button className="btn btn-secondary btn-sm" disabled={i === 0} onClick={() => setSel(items[i - 1].id)} data-testid="button-news-newer"><ChevronLeft size={15} />Newer</button>
              <button className="btn btn-secondary btn-sm" disabled={i === items.length - 1} onClick={() => setSel(items[i + 1].id)} data-testid="button-news-older">Older<ChevronRight size={15} /></button>
            </div>
          </div>
        </main>
      </div>
    </div>,
    document.body,
  );
}
