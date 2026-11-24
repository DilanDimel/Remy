// My Path for owners (Nov 23 2026, "season rewards" picked by Dilan, with Remy's office mixed in). Remy walks onto the
// page and explains the student's field (future job, jobs the major leads to, skills for their year); the season track
// gives a reward at every level (Remy's outfits or a new thing for his office); quests and the week's big move come from
// every tab; "Your field" (roles, skills, certifications) sits on the page. Every number comes from data Remy already
// has (DailyPath.tsx buildStops, shared/daily.ts, shared/game.ts, BLS via /api/careers and /api/future).
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as RMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Award, Briefcase, Check, Compass, DollarSign, Eye, Flame, Gift, Mic, Snowflake, Square, TrendingDown, TrendingUp, Wrench, X, Zap } from "lucide-react";
import { ROADS, roadFor, YEARS, yearNumber, NEED_LABEL } from "@shared/roads";
import { rankOf, weekKey, weekMissions, doneThisWeek, counters, xpOf, nextOutfit, unlockedOutfits, levelReward, OFFICE, RANKS, WARDROBE } from "@shared/game";
import { CARD_XP, dailyStreak, dayKey, streakDays } from "@shared/daily";
import { pinColor, pinsOf, topPins } from "@shared/pins";
import { CHEST_XP, RARE, chestPrize, rareOwned, welcomeBack } from "@shared/chest";
import { prepChain } from "@shared/prep";
import { dailyQuests, seasonOf } from "@shared/path";
import { api, useStore } from "../lib/store";
import type { Workspace } from "@shared/types";
import { go } from "../lib/router";
import { Modal, Remy, Rich, Spinner } from "./common";
import { PATH_WALK } from "./Tour";
import { ACTS, OUTFITS } from "./scholar";
import { GIVE_UP, KONAMI, POKES, QUOTES, SECRETS, SPIN, TAPS, dateLine, pick, timeLine } from "@shared/officeLines";
import "./office.css";
import { OfficeOpens, RemyDid } from "./RemyDid";
import { canListen, speak, useVoice } from "../lib/voice";
import { buildStops, money, stateOf, StopDetail, useFieldData, type Occ } from "./DailyPath";

const play = () => go("/path?play=1");

function usePathData() {
  const { ws } = useStore();
  const w = ws!, p = w.profile;
  const mine = roadFor(p.major, p.path) || roadFor([p.targetRoles, p.interests].join(" "), p.path);
  const [key, setKey] = useState(mine?.key || "");
  const road = ROADS.find((r) => r.key === key);
  const { careers, future } = useFieldData(road && road.key !== mine?.key ? road.label : "");
  const stops = useMemo(() => buildStops(w, road, careers, future, w.plan), [w, road, careers, future]);
  const year = Math.min(5, Math.max(1, yearNumber(p.classYear) || 1));
  const g = stateOf(w);
  const today = g.days?.[dayKey()] || [];
  const streak = dailyStreak(streakDays(w));
  const xp = xpOf(w, g), lv = rankOf(xp, g.bestRank);
  const wk = weekKey(), missions = weekMissions(w, wk), done = doneThisWeek(w, g, wk, counters(w));
  // Daily quests (reset at 4 AM with the day): each counts something the student really did today (shared with the app).
  const icons = { rate: Eye, role: Compass, xp: Zap };
  const quests = dailyQuests(w, today).map((q) => ({ ...q, icon: icons[q.key] }));
  return { w, g, mine, setKey, road, stops, year, careers, future, today, streak, xp, lv, missions, done, quests };
}
type D = ReturnType<typeof usePathData>;

/* ------------------------------------------------------------------ the season: a reward at every level */

function Season({ d }: { d: D }) {
  const { save } = useStore();
  const lv = d.lv, s = d.streak, se = seasonOf(new Date(), d.year);
  const owned = unlockedOutfits(lv.n, d.w.profile.classYear), wearing = d.g.outfit && owned.includes(d.g.outfit) ? d.g.outfit : "suit";
  const first = Math.max(1, Math.min(lv.n - 2, RANKS.length - 7));
  const tiles = Array.from({ length: 8 }, (_, i) => first + i).filter((n) => n <= RANKS.length);
  const pct = lv.max ? 100 : Math.round(((Math.max(0, d.xp - lv.floor)) / Math.max(1, lv.next - lv.floor)) * 100);
  const nowI = tiles.indexOf(lv.n);
  const fill = nowI < 0 ? 100 : Math.min(100, ((nowI + pct / 100) / Math.max(1, tiles.length - 1)) * 100);
  const bigNext = nextOutfit(lv.n);
  const wear = (o: string) => save("game", { ...d.g, outfit: o }).catch(() => {});
  return (
    <section className="ps-season" aria-label="This season" data-testid="path-season">
      <div className="ps-season-top">
        <div><span className="pm-kicker">{se.name} season · {YEARS[d.year]}</span><h2>{se.goal}</h2></div>
        <div className="ps-chips">
          <span className="ps-chip" title={s.todayDone ? "Done today" : "Do one thing today to keep it"}><Flame size={16} className={"pt-flame" + (s.days ? " lit" : "")} fill="currentColor" aria-hidden="true" /><b>{s.days}</b> day{s.days === 1 ? "" : "s"}</span>
          <span className="ps-chip ice" title="A freeze covers one missed day. You earn one every 7 days."><Snowflake size={16} aria-hidden="true" /><b>{s.freezes}</b> {s.freezes === 1 ? "freeze" : "freezes"}</span>
          <span className="ps-chip"><i className="pt-badge">{lv.n}</i>{lv.name}</span>
          <a className="ps-chip link" href="/rewards" data-testid="link-path-rewards"><Award size={16} aria-hidden="true" />All rewards</a>
        </div>
      </div>
      <ol className="ps-track" aria-label="Level rewards">
        {tiles.map((n) => {
          const r = n === 1 ? { kind: "outfit" as const, key: "suit", level: 1 } : levelReward(n);
          const got = n <= lv.n, next = n === lv.n + 1, isOutfit = r?.kind === "outfit";
          const label = !r ? rankOf(0, n).name : isOutfit ? OUTFITS[r.key].name : r.label;
          const body = <>
            <span className="ps-lv">{n}</span>
            <span className="ps-art">{isOutfit ? <Remy size={46} outfit={r!.key} /> : r ? <OfficeThing k={r.key} /> : <Award size={28} />}</span>
            <b>{label}</b>
            {isOutfit && got && <small>{wearing === r!.key ? "Wearing" : "Tap to wear"}</small>}
          </>;
          const cls = "ps-rw" + (got ? " got" : next ? " now" : " lock") + (isOutfit ? " outfit" : "");
          return <li key={n}>{isOutfit && got
            ? <button className={cls + (wearing === r!.key ? " on" : "")} onClick={() => wear(r!.key)} aria-pressed={wearing === r!.key} aria-label={`Level ${n}: ${label}. ${wearing === r!.key ? "Remy is wearing it" : "Put it on Remy"}`} data-testid={`button-outfit-${r!.key}`}>{body}</button>
            : <div className={cls} aria-label={`Level ${n}: ${label}${got ? ", unlocked" : ""}`}>{body}</div>}</li>;
        })}
      </ol>
      <div className="ps-bar" role="progressbar" aria-label="XP to next level" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${fill}%` }} /></div>
      <div className="ps-under">
        <span>{lv.max ? <b>Top level reached.</b> : <><b>{Math.max(0, d.xp - lv.floor)} / {lv.next - lv.floor} XP</b> to level {lv.n + 1}</>}</span>
        <span>{se.left} days left this season{bigNext ? ` · Level ${bigNext[1]} unlocks ${OUTFITS[bigNext[0]].name.toLowerCase()}` : ""}</span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Remy's office: fills up from levels and real steps */

/** Small drawings of the office rewards, used on the season track and in the room. Strokes and fills are tokens. */
export function OfficeThing({ k }: { k: string }) {
  const st = { stroke: "var(--ink)", strokeWidth: 2.2, strokeLinejoin: "round" as const, fill: "var(--surface)" };
  const art: Record<string, JSX.Element> = {
    lamp: <><path d="M14 30h16" {...st} /><path d="M22 30V16" {...st} /><path d="M12 16l6-10h10l4 10z" {...st} fill="var(--amber-bg)" /></>,
    globe: <><circle cx="22" cy="16" r="10" {...st} fill="var(--blue-bg)" /><path d="M12 16h20M22 6c-4 5-4 15 0 20M22 6c4 5 4 15 0 20" {...st} fill="none" /><path d="M16 34h12M22 26v8" {...st} /></>,
    clock: <><circle cx="22" cy="20" r="13" {...st} /><path d="M22 12v8l5 4" {...st} fill="none" /></>,
    mug: <><path d="M12 14h16v14a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z" {...st} fill="var(--fox)" /><path d="M28 18h3a3 3 0 0 1 0 6h-3" {...st} fill="none" /></>,
    rug: <><rect x="6" y="14" width="32" height="16" rx="8" {...st} fill="var(--fox-soft)" /><rect x="12" y="18" width="20" height="8" rx="4" {...st} fill="none" /></>,
    painting: <><rect x="8" y="8" width="28" height="24" rx="2" {...st} /><path d="M11 28l8-10 6 7 4-4 5 7z" fill="var(--sage)" /><circle cx="29" cy="14" r="3" fill="var(--amber)" /></>,
    bigplant: <><path d="M16 34h12l-2-10h-8z" {...st} fill="var(--fox)" /><path d="M22 24C22 16 14 12 12 8M22 24c0-8 8-12 10-16M22 24V6" stroke="var(--sage)" strokeWidth="3" fill="none" strokeLinecap="round" /></>,
    trophy: <><path d="M14 6h16v8a8 8 0 0 1-16 0z" {...st} fill="var(--amber-bg)" /><path d="M22 22v6M16 32h12" {...st} /><path d="M14 9H9a5 5 0 0 0 5 6M30 9h5a5 5 0 0 1-5 6" {...st} fill="none" /></>,
    bonsai: <><path d="M12 28h20l-2 6H14z" {...st} fill="var(--fox-deep)" /><path d="M22 28c0-6-4-8-6-12M22 28c1-7 6-9 8-12" {...st} fill="none" /><circle cx="15" cy="13" r="6" fill="var(--sage)" /><circle cx="29" cy="12" r="7" fill="var(--sage)" /><circle cx="22" cy="8" r="5" fill="var(--sage)" /></>,
    goldmug: <><path d="M12 12h16v16a4 4 0 0 1-4 4h-8a4 4 0 0 1-4-4z" {...st} fill="var(--amber)" /><path d="M28 16h3a3 3 0 0 1 0 6h-3" {...st} fill="none" /><path d="M20 4l1.5 3 3 .5-2.2 2 .6 3-2.9-1.5-2.9 1.5.6-3-2.2-2 3-.5z" fill="var(--amber)" /></>,
    pennant: <><path d="M8 8v26" {...st} /><path d="M9 9l28 7-28 8z" {...st} fill="var(--fox)" /><path d="M14 13l12 3-12 3z" fill="var(--surface)" /></>,
    record: <><rect x="4" y="18" width="36" height="16" rx="3" {...st} /><ellipse cx="18" cy="18" rx="12" ry="4" {...st} fill="var(--ink)" /><circle cx="18" cy="18" r="2" fill="var(--fox)" /><path d="M34 12l-6 8" {...st} /></>,
    skyline: <><rect x="6" y="6" width="32" height="28" rx="3" {...st} /><path d="M9 31v-8h5v-6h5v14h3V13h6v18h3v-9h4v9z" fill="var(--blue-bg)" /></>,
  };
  return <svg className="ps-thing" viewBox="0 0 44 40" aria-hidden="true">{art[k] || <circle cx="22" cy="20" r="10" {...st} />}</svg>;
}

/* Where Remy can be in his office (room units, viewBox 0 40 860 420). y is the top of his drawing: seated he shows
   from the chest up behind the desk; standing, his feet touch the floor behind the desk's front edge. */
const FOX_S = 0.62;
type Spot = "desk" | "shelf" | "window";
const SPOTS: Record<Spot, { x: number; y: number; sit?: boolean }> = { desk: { x: 455, y: 208, sit: true }, shelf: { x: 262, y: 186 }, window: { x: 668, y: 186 } };
type Pose = "" | "type" | "point" | "point-low" | "lean";
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const isNight = () => document.documentElement.dataset.theme === "dark";

/** Remy in the room: sits at his desk and types, gets up and walks to things, points at them, and strolls to the window
 *  now and then. Moves are a short chain of timers so a new move always cancels the one before it. */
function useDeskFox() {
  const [x, setX] = useState(SPOTS.desk.x), [y, setY] = useState(SPOTS.desk.y);
  const [walk, setWalk] = useState(0), [face, setFace] = useState<1 | -1>(1), [pose, setPose] = useState<Pose>("");
  const at = useRef<Spot>("desk"), timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => { return stop; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** Walk to a spot, then hold a pose there. Returns how long the walk takes. */
  const moveTo = (to: Spot, endPose: Pose = "", endFace: 1 | -1 = 1, wait = 0) => {
    stop(); setPose("");
    const from = SPOTS[at.current], t = SPOTS[to], still = reduced();
    const rise = from.sit && to !== at.current ? 380 : 0;
    const ms = to === at.current || still ? 0 : Math.round(500 + Math.abs(t.x - from.x) * 2.4);
    at.current = to;
    if (rise) later(() => setY(SPOTS.shelf.y), wait); // stand up first
    later(() => { if (ms) { setFace(t.x < from.x ? -1 : 1); setWalk(ms); } setX(t.x); }, wait + rise);
    later(() => { setWalk(0); setY(t.y); setFace(endFace); setPose(endPose); }, wait + rise + ms + 40);
    return wait + rise + ms + 40;
  };
  return { x, y, walk, face, pose, setPose, moveTo, later, stop, seated: () => at.current === "desk" };
}

const KONAMI_KEYS = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

/* Day and night (Nov 24, Demetre and Dilan): light mode is the office by day, dark mode the same office at night with the
   lamp on, stars and lit windows. Every thing in the room wiggles when tapped and Remy says something about it; he
   answers your questions in a speech bubble in the room, and now and then leans back in his chair with a Stoic quote. */
function Office({ d, onField }: { d: D; onField: (tab: SideTab, open?: string) => void }) {
  const g = useGuide(d, onField);
  const fox = useDeskFox();
  const [mood, setMood] = useState<"idle" | "wave" | "think">("idle");
  // On My Path his side panel is closed (App.tsx): you talk to him here, and he answers in the room.
  const { config, setWs, run } = useStore();
  const [q, setQ] = useState(""), [busy, setBusy] = useState(false), [said, setSaid] = useState<{ q: string; id?: string; live?: string } | null>(null);
  const busyRef = useRef(false), saidRef = useRef(said), guideRef = useRef(g.on);
  saidRef.current = said; guideRef.current = g.on;
  const aiOn = !!config?.ai.available;
  const reply = said?.id ? d.w.chat.find((m) => m.id === said.id) : null;
  // What he says on his own: a quote, a line about what you tapped, the time of day. Never over an answer or the tour.
  const [quip, setQuip] = useState<{ text: string; by?: string } | null>(null);
  const quipT = useRef(0);
  const say = (text: string, by?: string, ms = 6500) => {
    if (saidRef.current || guideRef.current) return;
    setQuip({ text, by }); clearTimeout(quipT.current);
    quipT.current = window.setTimeout(() => setQuip(null), ms + text.length * 25);
  };
  useEffect(() => () => clearTimeout(quipT.current), []);
  const foxEl = useRef<SVGGElement>(null);
  /** One of the little things he does (scholar.ts ACTS), played on his drawing. */
  const act = (name: string) => {
    const el = foxEl.current?.querySelector("svg.fox"), a = ACTS[name];
    if (!el || !a || reduced() || [...el.classList].some((c) => c.startsWith("act-"))) return;
    el.classList.add("act-" + name); window.setTimeout(() => el.classList.remove("act-" + name), a.ms);
  };
  const quote = () => { const x = pick(QUOTES); if (fox.seated()) { fox.setPose("lean"); fox.later(() => fox.setPose(""), 9000); } say(`“${x.q}”`, x.by, 8000); };
  // Talk to him here too: what you say is sent when you stop, and his answer is read back.
  const voice = useVoice(setQ, (t) => ask(t, true));
  const ask = async (said0?: string, spoken = false) => {
    const text = (said0 ?? q).trim();
    if (!text || busy) return;
    setQuip(null); setQ(""); setSaid({ q: text }); setBusy(true); busyRef.current = true;
    fox.moveTo("desk", "type"); setMood("think");
    const before = new Set(d.w.chat.map((m) => m.id));
    // His answer appears as he writes it (owners' server streams it), like the Remy panel.
    const w = await run(() => api<Workspace>("POST", "/api/ai/chat?stream=1", { message: text, page: "My Path", where: location.pathname + location.search, tabs: [] }, (l) => { if (typeof l.reply === "string") setSaid({ q: text, live: l.reply }); }));
    setBusy(false); busyRef.current = false; fox.setPose(""); setMood("idle");
    if (w) {
      setWs(w);
      const m = [...w.chat].reverse().find((x) => x.role === "assistant" && !before.has(x.id));
      setSaid({ q: text, id: m?.id });
      if (spoken && m) speak(m.text);
    }
  };
  const has = (k: string) => (OFFICE.find(([key]) => key === k)?.[2] || 99) <= d.lv.n;
  const known = (d.g.known || []).length, books = Math.min(8, known), resume = !!d.w.resume, applied = d.w.applications.length > 0;
  const cert = d.stops.some((s) => s.kind === "cert" && s.status === "done");
  const nextItem = OFFICE.find(([, , l]) => l > d.lv.n);
  const pins = topPins(d.w, 8), rare = rareOwned(d.g);
  const owned = unlockedOutfits(d.g.bestRank || d.lv.n, d.w.profile.classYear), wearing = d.g.outfit && owned.includes(d.g.outfit) ? d.g.outfit : "suit";
  const suit = Object.fromEntries((OUTFITS[wearing] || OUTFITS.suit).vars.split(";").map((kv) => kv.split(":"))) as CSSProperties;
  const L = { stroke: "var(--room-line)", strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const ghost = { fill: "none", stroke: "var(--room-label-2)", strokeOpacity: 0.7, strokeWidth: 2, strokeDasharray: "4 5" };
  const O = "var(--room-obj)", O2 = "var(--room-obj-2)", WOOD = "var(--room-wood)", WOOD2 = "var(--room-wood-2)";
  const at = (x: number, y: number) => ({ left: `${(x / 860) * 100}%`, top: `${((y - 40) / 420) * 100}%` });
  const bookColors = ["var(--sch-navy)", "var(--sch-tweed)", "var(--sch-wine)", "var(--sch-camel)", "var(--fox)", "var(--sch-ox)", "var(--sch-knit)", "var(--sch-brown)"];

  // The clock on the wall tells the real time.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const hh = ((now.getHours() % 12) + now.getMinutes() / 60) * 30, mm = now.getMinutes() * 6;
  // Taps: the thing wiggles and Remy says something about it. Some things do more.
  const [wig, setWig] = useState<{ k: string; n: number } | null>(null);
  const [lamp, setLamp] = useState<"" | "on" | "off">(""), [music, setMusic] = useState(false), [spin, setSpin] = useState(0);
  const pokes = useRef<number[]>([]);
  const it = (k: string, cls = "") => ({ className: `ps-it ${cls}` + (wig?.k === k ? ` wig${wig.n % 2}` : ""), "data-it": k });
  const tap = (k: string) => {
    setWig((w) => ({ k, n: (w?.n || 0) + 1 }));
    if (k === "remy") {
      const t = Date.now(); pokes.current = [...pokes.current.filter((p) => t - p < 2500), t];
      const n = pokes.current.length;
      if (n >= 10) { pokes.current = []; act("yawn"); return say(GIVE_UP); }
      if (n === 5 && fox.seated()) { setSpin((s) => s + 1); act("grin"); return say(SPIN, undefined, 2000); }
      act(pick(["grin", "push", "look", "wave"])); return say(pick(POKES));
    }
    if (k === "lamp") setLamp((l) => (l ? (l === "on" ? "off" : "on") : isNight() ? "off" : "on"));
    if (k === "record") setMusic((m) => !m);
    if (k === "mug" || k === "goldmug") act("coffee");
    if (k === "books") act("read");
    if (k === "laptop" && fox.seated()) { fox.setPose("type"); fox.later(() => fox.setPose(""), 3000); }
    if (k === "chair" && fox.seated()) setSpin((s) => s + 1);
    if ((k === "window" || k === "skyline") && fox.seated() && !reduced()) { const ms = fox.moveTo("window", "point"); fox.later(() => fox.moveTo("desk"), ms + 4200); }
    const lines = TAPS[k];
    if (lines) say(pick(lines).replace("{time}", now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })));
  };
  const onScene = (e: RMouseEvent) => { const el = (e.target as Element).closest?.("[data-it]"); if (el) tap(el.getAttribute("data-it")!); };

  // The walk-through moves him: each step names a spot and what he does there. Starting it, he waves first.
  const stepKey = g.on ? g.step : -1;
  useEffect(() => {
    if (!g.on) { setMood("idle"); fox.moveTo("desk"); return; }
    setQuip(null);
    const s = g.steps[g.step];
    const greet = g.step === 0 && fox.seated() && !reduced();
    setMood(greet || s.wave ? "wave" : "idle");
    const t = fox.moveTo(s.spot, s.pose, s.face, greet ? 1500 : 0);
    if (greet) fox.later(() => setMood("idle"), t);
  }, [stepKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // On his own: types, strolls to the window, leans back with a quote, sips coffee, yawns at night. Never during the walk-through.
  useEffect(() => {
    if (g.on) return;
    let t = 0;
    // Hello for the day or the time: once, a few seconds after you arrive.
    const hello = window.setTimeout(() => { const n = new Date(); say(dateLine(n) || timeLine(n.getHours(), n.getDay())); }, 3500);
    if (reduced()) return () => clearTimeout(hello);
    fox.later(() => fox.setPose("type"), 1200);
    const tick = () => { t = window.setTimeout(() => {
      if (!document.hidden && fox.seated() && !busyRef.current && !saidRef.current) {
        const r = Math.random();
        if (r < 0.35) { fox.setPose("type"); fox.later(() => fox.setPose(""), 5000); }
        else if (r < 0.52) { const ms = fox.moveTo("window"); fox.later(() => fox.moveTo("desk", "type"), ms + 3800); }
        else if (r < 0.7) quote();
        else act(isNight() && Math.random() < 0.5 ? "yawn" : pick(["coffee", "clean", "read", "push", "tie", "idea", "look"]));
      }
      tick();
    }, 9000 + Math.random() * 7000); };
    tick();
    return () => { clearTimeout(t); clearTimeout(hello); };
  }, [g.on]); // eslint-disable-line react-hooks/exhaustive-deps
  // Secrets on the keyboard: the Konami code, or typing stoic, remy, hire or coffee anywhere but a text box.
  useEffect(() => {
    let keys: string[] = [], typed = "";
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      keys = [...keys, e.key].slice(-KONAMI_KEYS.length);
      if (keys.join() === KONAMI_KEYS.join()) { keys = []; setSpin((s) => s + 1); act("idea"); return say(KONAMI); }
      if (e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-8);
      const word = Object.keys(SECRETS).find((w) => typed.endsWith(w));
      if (!word) return;
      typed = "";
      if (word === "stoic") quote(); else { say(SECRETS[word]); act(word === "coffee" ? "coffee" : "grin"); }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const arrived = !fox.walk;
  const ring = g.on && arrived ? g.steps[g.step].ring : null;
  const seatedNow = fox.y === SPOTS.desk.y && fox.x === SPOTS.desk.x;
  // The speech bubble sits beside his head on the window side, where no labels or furniture sit (Nov 24); at the window it flips left. Phones: below the room.
  const fx = (fox.x / 860) * 100, hy = ((fox.y + 96 - 40) / 420) * 100;
  const sayAt = { "--fx": `${fx}%`, "--hy": `${hy}%`, "--tail": `${fx}%` } as CSSProperties;
  const side = fx > 70 ? "l" : "r";
  const stars = [[578, 70], [636, 64], [704, 76], [748, 66], [764, 98], [690, 104], [596, 116], [728, 118], [654, 92]];
  const lit = [[576, 178], [584, 192], [600, 150], [604, 166], [599, 184], [638, 138], [648, 152], [640, 168], [650, 184], [678, 176], [686, 192], [718, 194]];
  return (
    <section className="ps-office" aria-label="Remy's office" data-testid="path-office">
      {/* One row above the room (Nov 24): who's here, what to ask him, the walk-through. Saves a row so My Path fits 1440x800. */}
      <div className="pt-card-head"><span className="ps-office-title"><span className="pm-kicker dark">Remy's office</span><span className="pm-faint">{nextItem ? `Level ${nextItem[2]} adds a ${nextItem[1].toLowerCase()}` : "Fully furnished"}</span></span>
        {!g.on && <form className="ps-ask" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} disabled={!aiOn || busy} placeholder={aiOn ? "Ask Remy anything about your path…" : "Remy's chat is off on this server"} aria-label="Ask Remy" data-testid="input-office-ask" />
            {canListen && aiOn && <button type="button" className={"btn btn-sm " + (voice.on ? "btn-primary remy-listening" : "btn-secondary")} onClick={voice.toggle} disabled={busy} aria-label={voice.on ? "Stop listening" : "Talk to Remy"} aria-pressed={voice.on} data-testid="button-office-mic">{voice.on ? <Square size={16} /> : <Mic size={16} />}</button>}
            <button className="btn btn-primary btn-sm" disabled={!aiOn || busy || !q.trim()} data-testid="button-office-ask">Ask</button>
        </form>}
        {!g.on && <button className="btn btn-ghost btn-sm ps-again" onClick={g.start} data-testid="button-hello-again">Walk me through it</button>}</div>
      <div className="ps-roomwrap">
      <div className={"ps-room" + (g.on ? " guiding" : "") + (lamp ? ` lamp-${lamp}` : "") + (music ? " music" : "")} data-testid="path-hello">
        <svg className="ps-scene" viewBox="0 40 860 420" preserveAspectRatio="xMidYMax meet" aria-hidden="true" onClick={onScene}>
          <defs>
            <clipPath id="ps-win"><rect x="560" y="56" width="220" height="152" rx="6" /></clipPath>
            <linearGradient id="ps-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--room-sky)" }} /><stop offset="1" style={{ stopColor: "var(--room-sky-2)" }} /></linearGradient>
            <radialGradient id="ps-glow"><stop offset="0" style={{ stopColor: "var(--room-glow)", stopOpacity: 0.5 }} /><stop offset="1" style={{ stopColor: "var(--room-glow)", stopOpacity: 0 }} /></radialGradient>
            <linearGradient id="ps-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--room-sky-2)", stopOpacity: 0.7 }} /><stop offset="1" style={{ stopColor: "var(--room-sky-2)", stopOpacity: 0 }} /></linearGradient>
          </defs>
          {/* the wall, a panel along the bottom, the wood floor */}
          <rect x="0" y="40" width="860" height="312" fill="var(--room-wall)" />
          <rect x="0" y="296" width="860" height="56" fill="var(--room-wall-2)" />
          <path d="M0 296H860" stroke="var(--room-line)" strokeOpacity=".16" strokeWidth="2" />
          <rect x="0" y="352" width="860" height="118" fill="var(--room-floor)" />
          <path d="M0 386H860M0 424H860M0 460H860M120 352v34M380 386v38M610 352v34M250 424v36M720 424v36M520 460v10" stroke="var(--room-floor-2)" strokeWidth="2" />
          <rect x="0" y="346" width="860" height="8" fill={O2} stroke="var(--room-line)" strokeWidth="2" />
          <path className="ps-day" d="M560 354H780L736 470H500Z" fill="url(#ps-beam)" />
          <circle className="ps-lamplight" cx="393" cy="300" r="190" fill="url(#ps-glow)" />
          {/* the window: sun and clouds by day; moon, stars and a shooting star at night; the city lights up */}
          <g {...it("window")}>
            <rect x="552" y="48" width="236" height="168" rx="8" fill={O} {...L} />
            <rect x="560" y="56" width="220" height="152" rx="6" fill="url(#ps-sky)" />
            <g clipPath="url(#ps-win)">
              <g className="ps-night">{stars.map(([x, y], i) => <circle key={i} className="ps-twinkle" cx={x} cy={y} r={i % 3 ? 1.4 : 2} fill="var(--room-sun)" style={{ animationDelay: `${-i * 0.7}s` }} />)}
                <path className="ps-shoot" d="M740 64l-30 12" stroke="var(--room-sun)" strokeWidth="2" strokeLinecap="round" /></g>
              <g {...it("sun", "ps-day")}><circle cx="606" cy="92" r="20" fill="var(--room-sun)" opacity=".3" /><circle cx="606" cy="92" r="14" fill="var(--room-sun)" /></g>
              <g {...it("moon", "ps-night")}><path d="M606 76a14 14 0 1 0 0 28a6 14 0 1 1 0-28z" fill="var(--room-sun)" /></g>
              <g className="ps-day">
                <path className="ps-cloud" d="M560 96a11 11 0 0 1 20-6a13 13 0 0 1 24 4a9 9 0 0 1 0 18h-40a8 8 0 0 1-4-16z" fill={O} opacity=".92" />
                <path className="ps-cloud two" d="M560 74a8 8 0 0 1 14-4a10 10 0 0 1 18 3a7 7 0 0 1 0 14h-30a6 6 0 0 1-2-13z" fill={O} opacity=".8" />
                <path className="ps-bird" d="M560 110q4-5 8 0q4-5 8 0" stroke="var(--room-line)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                <path className="ps-bird two" d="M560 100q3-4 6 0q3-4 6 0" stroke="var(--room-line)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
              </g>
              <path d="M560 208V152h18v-14h16v30h14v-40h22v50h16v-24h20v34h18v-58h14v58h22v-30h16v30h24V208z" fill="var(--room-city-2)" />
              <path {...it("skyline")} d={has("skyline") ? "M570 208V140h24v-40h20v108h18V82h26v126h14v-80h22v80h20v-50h16v50h20V208z" : "M570 208V170h24v-30h20v68h18v-80h26v80h14v-40h22v40h20v-20h16v20h20V208z"} fill="var(--room-city)" />
              <g className="ps-night">{lit.map(([x, y], i) => <rect key={i} className={i % 4 ? "" : "ps-flick"} x={x} y={y} width="4" height="5" rx="1" fill="var(--room-glow)" />)}</g>
            </g>
            <rect x="560" y="56" width="220" height="152" rx="6" fill="none" {...L} />
            <path d="M670 56V208M560 132H780" {...L} strokeWidth="5" stroke={O} /><path d="M670 56V208M560 132H780" {...L} fill="none" strokeWidth="1.5" />
            <rect x="544" y="204" width="252" height="10" rx="3" fill={O} {...L} />
          </g>
          {/* shelves: decoded jobs on top, the certificate frame, the trophy and the bonsai below */}
          <g {...it("books")}>
            {Array.from({ length: 8 }, (_, i) => { const h = [62, 54, 66, 58, 62, 52, 60, 56][i], x = 52 + i * 22; return i < books
              ? <g key={i} transform={i === 5 && books > 6 ? `rotate(-8 ${x + 18} 178)` : undefined}><rect x={x} y={178 - h} width="18" height={h} rx="2" fill={bookColors[i]} {...L} /><path d={`M${x + 4} ${186 - h}h10M${x + 4} ${170}h10`} stroke={O} strokeOpacity=".55" strokeWidth="2" /></g>
              : <rect key={i} x={x} y={178 - h} width="18" height={h} rx="2" {...ghost} />; })}
            <rect x="40" y="178" width="200" height="10" rx="3" fill={WOOD} {...L} />
          </g>
          <rect x="40" y="268" width="200" height="10" rx="3" fill={WOOD} {...L} />
          <g {...it("cert")}>{cert ? <><rect x="56" y="226" width="40" height="42" rx="3" fill={WOOD2} {...L} /><rect x="62" y="232" width="28" height="30" rx="1" fill={O} /><circle cx="76" cy="254" r="4" fill="var(--fox)" /><path d="M68 240h16M68 246h12" stroke="var(--room-label-2)" strokeWidth="2" /></>
            : <rect x="56" y="226" width="40" height="42" rx="3" {...ghost} />}</g>
          {has("trophy") && <g {...it("trophy")}><g transform="translate(130 228)"><path d="M14 6h16v8a8 8 0 0 1-16 0z" fill="var(--sch-bulb)" {...L} /><path d="M14 9H9a5 5 0 0 0 5 6M30 9h5a5 5 0 0 1-5 6" fill="none" {...L} /><path d="M22 22v10M14 38h16" {...L} /></g></g>}
          {/* streak milestones (Nov 24): the plant blooms at 7 days in a row, a framed photo at 30, gold at 100 */}
          {d.streak.best >= 30 && <g {...it("photo")}><g transform="translate(796 120)"><rect width="52" height="64" rx="3" fill={d.streak.best >= 100 ? "var(--sch-bulb)" : WOOD2} {...L} /><rect x="7" y="7" width="38" height="50" rx="2" fill={O} stroke="var(--room-line)" strokeWidth="1.5" />
            <text x="26" y="34" textAnchor="middle" fontSize="17" fontWeight="800" fill="var(--fox)">{d.streak.best >= 100 ? 100 : 30}</text><text x="26" y="48" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--room-label-2)">days</text></g></g>}
          {/* rare finds from the daily chest (Nov 24) */}
          {rare.has("bonsai") && <g {...it("bonsai")}><g transform="translate(184 230)"><path d="M6 30h32l-4 8H10z" fill="var(--sch-ox)" {...L} /><path d="M22 30c0-8-6-10-9-15M22 30c1-9 7-11 10-15" fill="none" {...L} /><circle cx="12" cy="13" r="8" fill="var(--sch-tweed)" /><circle cx="32" cy="12" r="9" fill="var(--sch-tweed)" /><circle cx="22" cy="6" r="7" fill="var(--sch-tweed)" /></g></g>}
          {rare.has("pennant") && <g {...it("pennant")}><g transform="translate(494 74)"><path d="M0 0v62" {...L} /><path className="ps-flag" d="M1 2l46 14-46 16z" fill="var(--fox)" {...L} /><path d="M9 11l20 6-20 7z" fill={O} /></g></g>}
          {rare.has("goldmug") && <g {...it("goldmug")}><g transform="translate(736 182)"><path d="M0 0h18v18a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z" fill="var(--sch-bulb)" {...L} /><path d="M18 5h4a4 4 0 0 1 0 8h-4" fill="none" {...L} /></g></g>}
          {rare.has("record") && <g {...it("record")}><g transform="translate(670 372)"><rect width="78" height="30" rx="5" fill={WOOD2} {...L} /><g className="ps-vinyl"><ellipse cx="32" cy="2" rx="26" ry="7" fill="var(--sch-black)" {...L} /><circle cx="32" cy="2" r="3" fill="var(--fox)" /></g><path d="M68-8l-12 12" {...L} />
            <g className="ps-notes"><path d="M20-14v-12l8-2v12" fill="none" {...L} strokeWidth="2" /><circle cx="18" cy="-14" r="3" fill="var(--room-line)" /><circle cx="26" cy="-16" r="3" fill="var(--room-line)" /></g></g></g>}
          <g {...it("resume")} transform="translate(0 16)">{resume ? <><rect x="282" y="70" width="92" height="116" rx="4" fill={WOOD2} {...L} /><rect x="290" y="78" width="76" height="100" rx="2" fill={O} /><circle cx="304" cy="94" r="7" fill="var(--room-obj-2)" stroke="var(--room-label-2)" strokeWidth="1.5" /><path d="M316 90h36M316 98h24M298 114h56M298 124h48M298 134h54M298 146h40M298 156h50" stroke="var(--room-label-2)" strokeWidth="3" strokeLinecap="round" /></>
            : <rect x="282" y="70" width="92" height="116" rx="4" {...ghost} />}</g>
          {/* the corkboard: every career pin earned, best first (Rewards, Nov 24) */}
          <g {...it("pins")}><rect x="404" y="150" width="136" height="64" rx="4" {...(pins.length ? { fill: "color-mix(in srgb, var(--room-wood) 75%, var(--room-obj))", ...L } : ghost)} />
            {pins.map((p, i) => <circle key={p.id} cx={424 + (i % 4) * 32} cy={168 + Math.floor(i / 4) * 28} r="9" fill={pinColor(p)} {...L} />)}</g>
          {has("painting") && <g {...it("painting")}><g transform="translate(410 50)"><rect width="70" height="54" rx="3" fill={WOOD2} {...L} /><rect x="6" y="6" width="58" height="42" fill="var(--room-sky-2)" /><circle cx="48" cy="18" r="5" fill="var(--sch-bulb)" /><path d="M6 48l18-22 14 16 9-9 17 15z" fill="var(--sch-tweed)" /></g></g>}
          {has("clock") && <g {...it("clock")}><g transform="translate(818 64)"><circle r="20" cx="0" cy="20" fill={O} {...L} /><circle r="1.6" cx="0" cy="4" fill="var(--room-line)" /><circle r="1.6" cx="0" cy="36" fill="var(--room-line)" /><circle r="1.6" cx="16" cy="20" fill="var(--room-line)" /><circle r="1.6" cx="-16" cy="20" fill="var(--room-line)" />
            <path d="M0 20V11" {...L} transform={`rotate(${hh} 0 20)`} /><path d="M0 20V6" {...L} strokeWidth="1.8" transform={`rotate(${mm} 0 20)`} /><circle r="2.2" cx="0" cy="20" fill="var(--fox)" /></g></g>}
          {has("rug") && <g {...it("rug")}><ellipse cx="470" cy="432" rx="230" ry="30" fill="color-mix(in srgb, var(--sch-navy) 60%, var(--room-floor))" stroke="var(--room-line)" strokeWidth="2.5" /><ellipse cx="470" cy="432" rx="200" ry="20" fill="none" stroke={O} strokeOpacity=".5" strokeWidth="2" strokeDasharray="6 6" /></g>}
          {has("globe") && <g {...it("globe")}><g transform="translate(724 358) scale(1.4)"><path d="M10 56h24M22 44v12" {...L} /><path d="M4 22a18 18 0 0 0 36 0" fill="none" {...L} stroke={WOOD2} strokeWidth="4" /><circle cx="22" cy="22" r="18" fill="var(--room-sky)" {...L} /><path d="M10 12c4-3 9-2 10 2s-3 5-1 8-2 6-5 5-6-6-5-10z" fill="var(--sch-tweed)" /><path d="M27 9c4 1 8 5 8 9-3 1-5-1-7 1s-3 4-5 2 0-5 1-7-1-4 3-5z" fill="var(--sch-tweed)" /><path d="M26 30c3-1 6-1 7 1-1 3-5 4-7 3z" fill="var(--sch-tweed)" /><circle cx="22" cy="22" r="18" fill="none" {...L} /></g></g>}
          {/* his chair, then Remy, then the desk in front of him */}
          <g {...it("chair", "ps-chair" + (fox.pose === "lean" && seatedNow ? " lean" : "") + (spin ? ` spin${spin % 2}` : ""))}>
            <path d="M398 340V262c0-22 14-34 57-34s57 12 57 34v78z" fill="var(--room-chair)" {...L} />
            <path d="M414 330V266c0-12 10-22 41-22s41 10 41 22v64" fill="none" stroke={O} strokeOpacity=".22" strokeWidth="2.5" />
            <path d="M430 256h50" stroke={O} strokeOpacity=".22" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          <g ref={foxEl} data-it="remy" className={"ps-fox" + (fox.walk ? " walk" : "") + (seatedNow ? " sit" : "")} style={{ transform: `translateX(${fox.x - 100 * FOX_S}px)`, transitionDuration: `${fox.walk || 0}ms` }}>
            <g className="ps-fox-y" style={{ transform: `translateY(${fox.y}px)` }}>
              <g transform={`scale(${FOX_S})`}><g transform={fox.face < 0 ? "translate(200 0) scale(-1 1)" : undefined}><g className={"ps-fox-bob" + (spin && seatedNow ? ` spin${spin % 2}` : "")} style={suit}>
                <g className="ps-legs">
                  <g className="ps-tail"><path d="M134 258C172 270 210 254 216 214C219 194 213 180 204 170C197 190 184 206 162 216C148 222 140 234 134 258Z" /><path className="tip" d="M204 170C213 180 219 194 216 212C207 206 199 194 196 184Z" /></g>
                  <g className="ps-leg l"><path className="ps-trouser" d="M62 248L60 296Q60 302 66 302L92 302Q98 302 98 296L99 248Z" /><path className="ps-shoe" d="M97 296L72 296Q53 297 51 308Q50 317 60 317L94 317Q100 317 100 311L100 300Q100 296 97 296Z" /><path className="ps-shine" d="M59 306Q63 302 71 302" /></g>
                  <g className="ps-leg r"><path className="ps-trouser" d="M138 248L140 296Q140 302 134 302L108 302Q102 302 102 296L101 248Z" /><path className="ps-shoe" d="M103 296L128 296Q147 297 149 308Q150 317 140 317L106 317Q100 317 100 311L100 300Q100 296 103 296Z" /><path className="ps-shine" d="M129 302Q137 302 141 306" /></g>
                  <path className="ps-hem" d="M31 212C32 228 36 242 40 256L95 262L100 254L105 262L160 256C164 242 168 228 169 212Z" />
                  <path className="ps-hem-line" d="M100 222V253" /><circle className="ps-btn" cx="106" cy="230" r="3" /><circle className="ps-btn" cx="106" cy="243" r="3" />
                </g>
                <Remy size={200} mood={mood} outfit={wearing} className={fox.pose ? `o-${fox.pose}` : ""} />
                <g className="ps-arms"><g className="ps-arm l"><path className="ps-sleeve-ol" d="M48 184Q35 212 36 244" /><path className="ps-sleeve" d="M48 184Q35 212 36 244" /><path className="ps-cuff" d="M28 245L44 246" /><ellipse className="ps-paw" cx="36" cy="255" rx="11" ry="10" /></g><g className="ps-arm r"><path className="ps-sleeve-ol" d="M152 184Q165 212 164 244" /><path className="ps-sleeve" d="M152 184Q165 212 164 244" /><path className="ps-cuff" d="M156 246L172 245" /><ellipse className="ps-paw" cx="164" cy="255" rx="11" ry="10" /></g></g>
              </g></g></g>
            </g>
          </g>
          <g {...it("desk")}>
            <rect x="322" y="350" width="296" height="56" rx="3" fill={WOOD2} {...L} />
            <path d="M532 362v32M542 378h40" stroke="var(--room-line)" strokeOpacity=".45" strokeWidth="2" /><circle cx="562" cy="378" r="3" fill="var(--room-line)" />
            <rect x="310" y="334" width="320" height="16" rx="5" fill={WOOD} {...L} />
          </g>
          <g {...it("plant")}><g transform="translate(2 34)"><path d="M330 300h36l-5-26h-26z" fill="var(--sch-camel)" {...L} />
            {d.streak.days > 0 && <g className="ps-sway"><path d="M348 274C348 250 334 240 326 232M348 270C352 248 366 238 376 236M348 262C346 244 348 228 350 218" stroke="var(--sch-tweed)" strokeWidth="4" fill="none" strokeLinecap="round" />
              {d.streak.best >= 7 && [[326, 230], [377, 235], [350, 215]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="6" fill="var(--fox-soft)" stroke="var(--fox)" strokeWidth="3" />)}</g>}</g></g>
          {has("lamp") && <g {...it("lamp")}><g transform="translate(370 282)"><path className="ps-lamplight" d="M9 22L-6 52H52L37 22Z" fill="var(--room-glow)" opacity=".22" /><path d="M10 52h26M23 52V22" {...L} /><path d="M8 22l8-16h14l6 16z" fill="var(--room-shade)" {...L} /></g></g>}
          <g {...it("laptop")}><path d="M498 334l10-46h82l-10 46z" fill="var(--room-chair)" {...L} /><path className="ps-night" d="M508 288h82l-10 46h-82z" fill="var(--room-sky-2)" opacity=".35" /><circle cx="544" cy="310" r="4" fill="var(--fox)" /><path d="M470 334h120" {...L} strokeWidth="3" /></g>
          {has("mug") && <g {...it("mug")}><g transform="translate(598 314)"><path d="M0 0h16v16a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z" fill="var(--fox)" {...L} /><path d="M16 4h3a4 4 0 0 1 0 8h-3" fill="none" {...L} /><path className="ps-steam" d="M5-4q-3-5 0-9M11-4q3-5 0-9" stroke="var(--room-label-2)" strokeWidth="2" fill="none" strokeLinecap="round" /></g></g>}
          {/* the front of the room */}
          {has("bigplant") && <g {...it("bigplant")}><g transform="translate(806 368)"><path d="M0 70h40l-6-36H6z" fill={O2} {...L} /><g className="ps-sway"><path d="M20 34C20 10 2 0-6-10M20 34C20 10 38 0 46-10M20 34V-20" stroke="var(--sch-tweed)" strokeWidth="5" fill="none" strokeLinecap="round" /><ellipse cx="-6" cy="-12" rx="8" ry="4" fill="var(--sch-tweed)" transform="rotate(-30 -6 -12)" /><ellipse cx="46" cy="-12" rx="8" ry="4" fill="var(--sch-tweed)" transform="rotate(30 46 -12)" /><ellipse cx="20" cy="-22" rx="4" ry="8" fill="var(--sch-tweed)" /></g></g></g>}
          <g {...it("briefcase")}>{applied ? <g transform="translate(60 386)"><path d="M26 0v-12h34v12" fill="none" {...L} strokeWidth="4" /><rect width="86" height="60" rx="8" fill="var(--room-leather)" {...L} /><path d="M0 22h86" stroke="var(--room-line)" strokeOpacity=".5" strokeWidth="2" /><rect x="37" y="16" width="12" height="12" rx="2" fill="var(--sch-bulb)" {...L} strokeWidth="1.5" /></g>
            : <g transform="translate(60 386)"><rect width="86" height="60" rx="8" {...ghost} /><path d="M26 0v-12h34v12" {...ghost} /></g>}</g>
        </svg>
        {ring && <span className="ps-ring" style={at(ring[0], ring[1])} aria-hidden="true" />}
        {/* Captions sit centred just above the thing they name, so the room reads as one system (Dilan, Nov 24). */}
        <button className="ps-tag" style={at(139, 104)} onClick={() => onField("roles")} data-testid="button-office-books">{known ? `${known} job${known === 1 ? "" : "s"} decoded` : "Decode your first job"}</button>
        <button className={"ps-tag below" + (cert ? "" : " ghost")} style={at(110, 280)} onClick={() => onField("certs")} data-testid="button-office-cert">{cert ? "Certificate earned" : "First certificate"}</button>
        <button className={"ps-tag" + (resume ? "" : " ghost")} style={at(328, 84)} onClick={() => go("/resume")} data-testid="button-office-resume">{resume ? "Resume on file" : "Add your resume"}</button>
        <button className={"ps-tag" + (pins.length ? "" : " ghost")} style={at(472, 146)} onClick={() => go("/rewards")} data-testid="button-office-pins">{pins.length ? `${pinsOf(d.w).filter((p) => p.earned).length} pins` : "Earn your first pin"}</button>
        <span className="ps-tag still" style={at(352, 244)}>{d.streak.days ? `${d.streak.days}-day streak` : "Plant needs a streak"}</span>
        <button className={"ps-tag side" + (applied ? "" : " ghost")} style={at(152, 392)} onClick={() => go("/opportunities")} data-testid="button-office-briefcase">{applied ? `${d.w.applications.length} applied` : "First application"}</button>
      </div>
        {g.on ? <div className="ps-bubble" style={{ "--tail": `${Math.min(92, Math.max(8, fx))}%` } as CSSProperties} aria-live="polite" data-testid="path-guide">{g.bubble}</div>
          : said ? <div className={"ps-say " + side} style={sayAt} aria-live="polite" data-testid="office-reply">
              <button className="ps-say-x" onClick={() => setSaid(null)} aria-label="Close Remy's answer" data-testid="button-office-reply-close"><X size={14} /></button>
              <div className="ps-say-body">{busy ? (said.live ? <div className="ps-reply"><Rich text={said.live} /></div> : <span className="ps-think" role="status" aria-label="Remy is thinking"><i /><i /><i /></span>)
                : reply ? <div className="ps-reply"><Rich text={reply.text} /><RemyDid m={reply} /><OfficeOpens actions={reply.actions} /></div> : <p>I couldn't answer that one. Try asking again.</p>}</div>
            </div>
          : quip && <button className={"ps-say quip " + side} style={sayAt} onClick={() => setQuip(null)} aria-live="polite" data-testid="office-quip"><span className="ps-say-body"><span>{quip.text}</span>{quip.by && <small>{quip.by}</small>}</span></button>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Remy walks you through his office */

const HELLO_KEY = "remy-path-hello";
const seenToday = () => { try { return localStorage.getItem(HELLO_KEY) === dayKey(); } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(HELLO_KEY, dayKey()); } catch { /* private mode: he greets again next time */ } };

type GuideStep = { say: ReactNode; cta?: ReactNode; spot: Spot; pose: Pose; face?: 1 | -1; wave?: boolean; ring: [number, number] | null; tab: SideTab; open?: string };

/** Remy's walk-through, played inside his office: he walks to each object, says what it means for you, and the panel
 *  beside the office opens the matching list with the thing he named. First visit each day plays it; "Walk me through
 *  it" replays it. Arrow keys step through it and Escape ends it. */
function useGuide(d: D, onField: (tab: SideTab, open?: string) => void) {
  const p = d.w.profile, name = (p.preferredName || p.name || "").trim().split(/\s+/)[0];
  const [on, setOn] = useState(() => !seenToday() && typeof d.w.settings.tour !== "number" && !new URLSearchParams(location.search).get("side")); // waits while the site tour runs, so two guides never talk at once; a link that opens one panel (the app's Path rows) skips it so it can't switch the tab
  const [step, setStep] = useState(0);
  const jobs = d.careers?.[0]?.jobs || [];
  const targets = (p.targetRoles || "").toLowerCase().split(/,\s*/).filter(Boolean);
  const byOpenings = [...jobs].sort((a, b) => (b.openings || 0) - (a.openings || 0));
  // "Financial analyst" should find BLS's "Financial and investment analysts": every word's stem must appear.
  const fits = (title: string) => targets.some((t) => t.split(/\s+/).every((wd) => title.toLowerCase().includes(wd.slice(0, 6))));
  const target = jobs.find((o) => fits(o.title)), top = target || byOpenings[0];
  const roles = byOpenings.filter((o) => o !== top).slice(0, 2);
  // Skills Remy's path suggested come first; without a path yet, this year's milestones from the road.
  const todo = d.stops.filter((s) => s.status !== "done" && (s.kind === "skill" || s.kind === "step"));
  const rank = (s: (typeof todo)[number]) => (s.kind === "skill" ? 0 : 2) + (s.year <= d.year ? 0 : 4) + (s.optional ? 3 : 0);
  const skills = [...todo].sort((a, b) => rank(a) - rank(b) || a.year - b.year).slice(0, 2);
  const certs = d.stops.filter((s) => s.kind === "cert" && s.status !== "done").sort((a, b) => +!!a.optional - +!!b.optional).slice(0, 1);
  const avg = d.future?.allJobsGrowth ?? 0, f0 = d.future?.fields[0];
  const fastest = [...jobs].sort((a, b) => b.change - a.change)[0];
  const qLeft = d.quests.filter((q) => q.n < q.of).length;
  const who = p.major.trim() ? `studying ${p.major.trim()}` : "still exploring";
  const yearWord = d.year === 5 ? "out of college" : `in your ${YEARS[d.year].toLowerCase().replace(/-year$/, "")} year`; // "first year", not "first-year year"
  const asA = d.year === 5 ? "starting out" : `a ${YEARS[d.year].toLowerCase()}`;
  const and = (xs: string[]) => xs.map((x, i) => <span key={i}>{i ? " and " : ""}<b>{x}</b></span>);
  const close = () => { markSeen(); setOn(false); setStep(0); onField("today"); };
  const steps: GuideStep[] = [
    { say: <><b>Hi{name ? ` ${name}` : ""}!</b> You're {who}, {yearWord}. {!top ? <>Tell me your major and I'll show you real pay and growth for your field out that window.</>
        : <>{target ? "Out that window is where you're headed" : `Out that window: in ${d.road?.label.toLowerCase() || "your field"}, the most openings are for`} <b>{top.title.toLowerCase()}</b>{top.wage ? <>, {money(top.wage)} median</> : null}, {top.change > 0 ? "+" : ""}{top.change}% by 2035.{target ? null : <> Tell me the job you want and I'll put it here.</>}</>}</>,
      spot: "window", pose: "point", ring: [670, 118], tab: "roles", open: top?.soc },
    { say: <>Every book on this shelf is a job you've decoded. {roles.length ? <>Your {p.major ? "major" : "field"} also leads to {and(roles.map((o) => shortRole(o.title).toLowerCase()))}.</> : null} The full list is on the right.</>,
      spot: "shelf", pose: "point", face: -1, ring: [140, 140], tab: "roles" },
    { say: skills.length ? <>What I'd work on now, while you're {asA}: {and(skills.map((s) => clip(s.title)))}.</> : <>You've covered this stage. Nice.</>,
      spot: "desk", pose: "type", ring: null, tab: "skills", open: skills[0]?.id },
    { say: certs.length ? <>This frame is for your first certification. In your field, start with <b>{clip(certs[0].title)}</b>.</> : <>This frame is for a certification. Your field doesn't require one; projects matter more.</>,
      spot: "shelf", pose: "point-low", face: -1, ring: [76, 247], tab: "certs", open: certs[0]?.id },
    { say: <>On the right is what's ahead, from now to 2035. By then {f0 ? <><b>{f0.fasterThanAverage} of {f0.total}</b> jobs grow faster than average</> : "jobs in your field will look different"}{fastest ? <>, and the fastest is <b>{fastest.title.toLowerCase()}</b> ({fastest.change > 0 ? "+" : ""}{fastest.change}%)</> : null}.</>,
      spot: "window", pose: "point", ring: [670, 118], tab: "forecast" },
    { say: qLeft ? <>That's my office. Today you have {qLeft} quest{qLeft === 1 ? "" : "s"} left, about {qLeft * 2} minutes. Each level adds something to the room.</> : <>That's my office. All three quests are done today, so your streak is safe.</>,
      cta: <button className="btn btn-primary btn-sm" onClick={() => { close(); play(); }} data-testid="button-hello-start">{qLeft ? "Start today's cards" : "Play again"} <ArrowRight size={14} /></button>,
      spot: "desk", pose: "", wave: true, ring: null, tab: "today" },
  ];
  const go2 = (i: number) => { const s = steps[Math.max(0, Math.min(steps.length - 1, i))]; setStep(steps.indexOf(s)); onField(s.tab, s.open || ""); };
  const start = () => { setOn(true); go2(0); };
  // The site tour ends here and hands over to this walk-through (it promised to).
  useEffect(() => { const f = () => start(); addEventListener(PATH_WALK, f); return () => removeEventListener(PATH_WALK, f); });
  // the panel follows him on the first step too
  useEffect(() => { if (on) go2(step); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!on) return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" && step < steps.length - 1) go2(step + 1);
      else if (e.key === "ArrowLeft" && step > 0) go2(step - 1);
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });
  const s = steps[step];
  const bubble = <>
    <span className="pm-kicker">Remy · {step + 1} of {steps.length}</span>
    <p>{s.say}</p>{s.cta}
    <div className="ps-nav">
      <span className="ps-dots" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i === step ? "on" : i < step ? "done" : ""} />)}</span>
      {step > 0 && step < steps.length - 1 && <button className="btn btn-ghost btn-sm" onClick={() => go2(step - 1)} data-testid="button-hello-back">Back</button>}
      <button className="btn btn-ghost btn-sm" onClick={close} data-testid="button-hello-skip">{step === steps.length - 1 ? "Done" : "Skip"}</button>
      {step < steps.length - 1 && <button className="btn btn-secondary btn-sm" onClick={() => go2(step + 1)} data-testid="button-hello-next">Next <ArrowRight size={14} /></button>}
    </div></>;
  return { on, step, steps, start, bubble };
}

/** A stop's title without its aside: "Some students take the SIE (mostly for ...)" → "Some students take the SIE". */
const clip = (t: string) => t.replace(/\s*[(;:].*$/, "");
const shortRole = (t: string) => t.replace(/,.*$/, "").replace(/ and /g, " & ");


/* ------------------------------------------------------------------ beside the trail */

function Quests({ d }: { d: D }) {
  const all = d.quests.every((q) => q.n >= q.of);
  const away = welcomeBack(streakDays(d.w), dayKey());
  return (
    <section className="pt-card" aria-label="Daily quests" data-testid="path-quests">
      <div className="pt-card-head"><span className="pm-kicker dark">Daily quests</span><span className="pm-faint">New at 4 AM</span></div>
      {away > 0 && !d.g.chests?.[dayKey()] && <p className="pt-welcome" data-testid="quests-welcome-back"><b>Welcome back!</b> You were away {away} days, and that's fine. Finish today's three quests and the chest gives double XP.</p>}
      <ul className="pt-quests">
        {d.quests.map((q) => { const ok = q.n >= q.of, I = q.icon; return (
          <li key={q.key} className={ok ? "ok" : ""}>
            <span className="pt-qi">{ok ? <Check size={17} strokeWidth={3} /> : <I size={17} />}</span>
            <button className="pt-qb" onClick={() => go(q.link)} data-testid={`button-quest-${q.key}`}><b>{q.title}</b><small>From {q.from}</small><span className="pt-qbar"><i style={{ width: `${(q.n / q.of) * 100}%` }} /></span></button>
            <span className="pt-qn">{q.n} / {q.of}</span>
          </li>); })}
      </ul>
      <Chest d={d} all={all} back={away > 0} />
    </section>
  );
}

/** Today's chest: locked until all three quests are done, then one tap opens it as a big moment in the middle of the
 *  screen (Demetre, Nov 24: "it should be happening quite big"), and the card keeps what was inside. */
function Chest({ d, all, back }: { d: D; all: boolean; back: boolean }) {
  const { save } = useStore();
  const day = dayKey(), got = d.g.chests?.[day];
  const [busy, setBusy] = useState(false);
  const [moment, setMoment] = useState("");
  const open = () => {
    const prize = chestPrize(day, d.g, back);
    setBusy(true); setMoment(prize);
    save("game", { ...d.g, chests: { ...(d.g.chests || {}), [day]: prize } }).catch(() => setMoment("")).finally(() => setBusy(false));
  };
  const rare = got && got !== "xp" ? RARE.find(([k]) => k === got)?.[1] : "";
  return <>
    {!all ? <div className="pt-chest"><Gift size={22} aria-hidden="true" /><span>Finish all three to open today's chest.</span></div>
      : !got ? <button className="pt-chest ready" onClick={open} disabled={busy} data-testid="button-open-chest"><Gift size={22} aria-hidden="true" /><span>All three done. Open today's chest</span></button>
      : <div className="pt-chest open" data-testid="chest-prize"><Gift size={22} aria-hidden="true" /><span>{rare ? <>You found a <b>{rare}</b> for Remy's office!</> : got === "bigxp" ? <>+{2 * CHEST_XP} bonus XP. Good to have you back.</> : <>+{CHEST_XP} bonus XP. See you tomorrow.</>}</span></div>}
    {moment && <ChestMoment prize={moment} onClose={() => setMoment("")} />}
  </>;
}

function ChestMoment({ prize, onClose }: { prize: string; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const rare = RARE.find(([k]) => k === prize);
  const ink = { stroke: "var(--ink)", strokeWidth: 4, strokeLinejoin: "round" as const };
  return createPortal(
    <div className="modal-back ch-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ch-moment" role="dialog" aria-modal="true" aria-label="Today's chest" data-testid="chest-moment">
        <span className="ch-rays" aria-hidden="true" />
        <svg className="ch-chest" viewBox="0 0 200 170" aria-hidden="true">
          <g className="ch-body"><rect x="24" y="78" width="152" height="84" rx="10" fill="var(--fox)" {...ink} /><rect x="24" y="100" width="152" height="12" fill="var(--fox-deep)" {...ink} /><rect x="88" y="94" width="24" height="28" rx="4" fill="var(--amber)" {...ink} /></g>
          <g className="ch-lid"><path d="M24 80V58c0-22 18-34 76-34s76 12 76 34v22z" fill="var(--fox)" {...ink} /><path d="M88 24v56h24V24" fill="var(--amber)" {...ink} /></g>
        </svg>
        <div className="rw-confetti ch-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ ["--a" as string]: `${i * 15}deg`, ["--d" as string]: `${0.75 + (i % 3) * 0.1}s` }} />)}</div>
        <div className="ch-prize">
          {rare ? <span className="ch-thing"><OfficeThing k={rare[0]} /></span> : <span className="ch-xp">+{prize === "bigxp" ? 2 * CHEST_XP : CHEST_XP} XP</span>}
          <h2>{rare ? `A ${rare[1].toLowerCase()}!` : prize === "bigxp" ? "Welcome back bonus" : "Bonus XP"}</h2>
          <p>{rare ? "A rare find. Only the daily chest gives it. It's in Remy's office now." : prize === "bigxp" ? "Double XP for coming back. Good to have you." : "All three quests done today. See you tomorrow for another chest."}</p>
          <button className="btn btn-primary" onClick={onClose} autoFocus data-testid="button-chest-done">{rare ? "See it in the office" : "Nice"}</button>
        </div>
      </div>
    </div>, document.body);
}

/** With an interview in the next 5 days, its prep steps take the big move's place (shared/prep.ts). */
function PrepOrMove({ d }: { d: D }) {
  const p = prepChain(d.w, dayKey());
  if (!p) return <BigMove d={d} />;
  const left = p.steps.filter((s) => !s.done).length;
  return (
    <section className="pt-card peach" aria-label="Interview prep" data-testid="path-prep-chain">
      <div className="pt-card-head"><span className="pm-kicker">{p.event.title} {p.days === 0 ? "today" : p.days === 1 ? "tomorrow" : `in ${p.days} days`}</span><span className="pm-faint">{left ? `${4 - left} of 4 ready` : "Ready"}</span></div>
      <ul className="pt-prep">
        {p.steps.map((s) => <li key={s.key} className={s.done ? "ok" : ""}>
          <span className="pt-qi">{s.done ? <Check size={15} strokeWidth={3} /> : <Square size={15} />}</span>
          {s.done ? <span>{s.label}</span> : <button className="pt-qb" onClick={() => go(s.link)} data-testid={`button-prep-${s.key}`}>{s.label} <ArrowRight size={13} /></button>}
        </li>)}
      </ul>
      {!left && <p className="pt-move-why"><b>You're ready.</b> Go get it.</p>}
    </section>
  );
}

function BigMove({ d }: { d: D }) {
  const m = d.missions.find((x) => !d.done.includes(x.key));
  return (
    <section className="pt-card peach" aria-label="This week's big move" data-testid="path-big-move">
      <div className="pt-card-head"><span className="pm-kicker">This week's big move</span>{m && <span className="pt-xp">+{m.xp} XP</span>}</div>
      {m ? <>
        <b className="pt-move">{m.title}</b>
        <p className="pt-move-why">{m.effect}. About {m.mins} minutes.</p>
        <button className="btn btn-primary" onClick={() => go(m.link)} data-testid="button-big-move">Let's do it <ArrowRight size={15} /></button>
      </> : <p className="pt-move-why"><b>All {d.missions.length} done this week.</b> Next week's move comes Monday.</p>}
      {d.done.length > 0 && m && <p className="pm-faint pt-move-left">{d.done.length} of {d.missions.length} done this week</p>}
    </section>
  );
}

/* ------------------------------------------------------------------ the level-up moment */

const rankXp = (n: number) => rankOf(0, n).floor;

/** The level-up moment: a new level (and maybe an outfit) the moment it happens, never for levels earned before this existed. */
function LevelUp({ d }: { d: D }) {
  const { save } = useStore();
  const [up, setUp] = useState<{ n: number; fresh: string } | null>(null);
  const best = d.g.bestRank;
  useEffect(() => {
    if (best && d.lv.n <= best) return;
    save("game", { ...d.g, bestRank: d.lv.n }).catch(() => {});
    // the first visit only records where they are; after that, say it and offer any outfit this climb unlocked
    if (best) setUp({ n: d.lv.n, fresh: WARDROBE.find(([, l]) => l > best && l <= d.lv.n)?.[0] || "" });
  }, [d.lv.n, best]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!up) return null;
  const { n: shown, fresh } = up, after = nextOutfit(shown);
  const close = () => setUp(null);
  return (
    <Modal title={`Level ${shown}: ${rankOf(0, shown).name}`} onClose={close}>
      <div className="pt-lvlup" data-testid="path-level-up">
        <Remy size={120} mood="happy" outfit={fresh || undefined} />
        <p>{fresh ? <>You unlocked <b>{OUTFITS[fresh].name}</b>. Want Remy to put it on?</> : <>Nice climbing. {after ? `Level ${after[1]} unlocks ${OUTFITS[after[0]].name}.` : ""}</>}</p>
        <div className="row">
          {fresh && <button className="btn btn-primary" onClick={() => { save("game", { ...d.g, bestRank: shown, outfit: fresh }).catch(() => {}); close(); }} data-testid="button-wear-outfit">Put it on</button>}
          <button className="btn btn-ghost" onClick={close} data-testid="button-level-up-close">{fresh ? "Later" : "Keep going"}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ your field */

type SideTab = "today" | "roles" | "skills" | "certs" | "forecast";

/** The panel beside the office: today's quests, then your field's roles, skills, certifications and forecast.
 *  Office objects and Remy's walk-through switch it, so nothing opens far down the page. */
function Side({ d, tab, setTab, open, setOpen }: { d: D; tab: SideTab; setTab: (t: SideTab) => void; open: string; setOpen: (s: string) => void }) {
  const jobs = d.careers?.[0]?.jobs || [];
  const avg = d.future?.allJobsGrowth ?? 0;
  const f0 = d.future?.fields[0];
  const known = new Set((stateOf(d.w).known || []).map((k) => k.toLowerCase()));
  const mine = new Set((d.w.profile.targetRoles || "").toLowerCase().split(/,\s*/).filter(Boolean));
  const max = Math.max(10, ...jobs.map((o) => Math.abs(o.change)), ...(f0 ? [...f0.growing, ...f0.shrinking].map((o) => Math.abs(o.change)) : []));
  const skills = d.stops.filter((s) => s.kind === "skill" || s.kind === "step").sort((a, b) => a.year - b.year), certs = d.stops.filter((s) => s.kind === "cert");
  const row = (o: Occ) => <RoleRow key={o.soc} o={o} avg={avg} max={max} known={known.has(o.title.toLowerCase())} mine={mine.has(o.title.toLowerCase())} open={open === o.soc} onOpen={() => setOpen(open === o.soc ? "" : o.soc)} />;
  // the row Remy named scrolls into view inside the panel
  // (inside the panel only, so the page never jumps away from Remy's office on a phone)
  useEffect(() => { const t = [80, 600].map((ms) => window.setTimeout(() => { // again once the opened details have drawn
    const body = document.querySelector(".ps-side-body"), row = body?.querySelector(".pm-row.open");
    if (!body) return;
    if (!row) return body.scrollTo({ top: 0, behavior: "smooth" });
    // the open row goes to the top of the panel, so its details show without scrolling (Dilan, Nov 24)
    const by = row.getBoundingClientRect().top - body.getBoundingClientRect().top - 8;
    if (Math.abs(by) > 4) body.scrollTo({ top: body.scrollTop + by, behavior: "smooth" });
  }, ms)); return () => t.forEach(clearTimeout); }, [open, tab, jobs.length, d.future]); // again once the field's numbers load, since rows above can move
  const tabs: [SideTab, string, number | null][] = [["today", "Today", null], ["roles", "Roles", jobs.length], ["skills", "Skills", skills.length], ["certs", "Certs", certs.length], ["forecast", "Timeline", null]];
  return (
    <section className="ps-side" aria-label="Today and your field" id="path-field" data-testid="path-field">
      <header className="ps-side-head">
        <div className="seg ps-side-seg" role="tablist">
          {tabs.map(([k, l, n]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setOpen(""); }} data-testid={`tab-side-${k}`}>{l}{n !== null && <span>{n}</span>}</button>)}
        </div>
      </header>
      <div className="ps-side-body">
        {tab === "today" && <><Quests d={d} /><PrepOrMove d={d} /></>}
        {tab !== "today" && <div className="ps-field-line">
          <span>Your field</span>
          <select className="input ps-select" value={d.road?.key || ""} onChange={(e) => { d.setKey(e.target.value); setOpen(""); }} aria-label="Field" data-testid="select-road">
            {ROADS.map((r) => <option key={r.key} value={r.key}>{r.label}{r.key === d.mine?.key ? " (yours)" : ""}</option>)}
          </select>
        </div>}
        {tab === "roles" && <>
          <FieldTiles jobs={jobs} />
          <ul className="pm-rows">{jobs.map(row)}</ul>
          <p className="pm-src">Pay, openings and growth: {d.future?.source || "U.S. Bureau of Labor Statistics"}. The line on each bar is the average job.</p>
        </>}
        {(tab === "skills" || tab === "certs") && (
          <ul className="pm-rows">
            {(tab === "skills" ? skills : certs).map((s) => (
              <li key={s.id} className={"pm-row role" + (open === s.id ? " open" : "")}>
                <button className="pm-row-btn two" onClick={() => setOpen(open === s.id ? "" : s.id)} aria-expanded={open === s.id}>
                  <span className={"pm-ico" + (s.status === "done" ? " known" : "")}>{s.status === "done" ? <Check size={16} strokeWidth={3} /> : s.kind === "skill" ? <Wrench size={16} /> : s.kind === "step" ? <Compass size={16} /> : <Award size={16} />}</span>
                  <div className="pm-role-main"><b>{s.title}</b><small>{s.kind === "step" ? s.sub : `${s.kind === "cert" && s.cred ? NEED_LABEL[s.cred.need] : s.sub} · ${s.year === 5 ? "after college" : `usually ${YEARS[s.year].toLowerCase()}`}`}</small></div>
                  <span className={"pm-pill " + s.status}>{s.status === "done" ? "Done" : s.progress ? "On your list" : s.year === d.year ? "This year" : "Open"}</span>
                </button>
                {open === s.id && <div className="pm-row-detail"><StopDetail s={s} future={d.future} onPlay={play} /></div>}
              </li>
            ))}
            {!(tab === "skills" ? skills : certs).length && <p className="ps-none">Nothing here yet for this field. Build your path and Remy adds skills that fit you.</p>}
          </ul>
        )}
        {tab === "forecast" && <Ahead d={d} jobs={jobs} avg={avg} />}
      </div>
    </section>
  );
}

/** Timeline (was "Forecast", which repeated the Roles list; Dilan, Nov 24): what's ahead from now to 2035, one stop per
 *  stage of college, with the next skill, the summer to aim for, the first job and the 2035 outlook for the field. */
function Ahead({ d, jobs, avg }: { d: D; jobs: Occ[]; avg: number }) {
  const now = new Date(), y = now.getFullYear(), p = d.w.profile;
  const f0 = d.future?.fields[0];
  const next = d.stops.find((s) => s.status !== "done" && (s.kind === "skill" || s.kind === "step") && s.year <= d.year) || d.stops.find((s) => s.status !== "done" && s.kind !== "role");
  const targets = (p.targetRoles || "").toLowerCase().split(/,\s*/).filter(Boolean);
  const job = jobs.find((o) => targets.some((t) => t.split(/\s+/).every((wd) => o.title.toLowerCase().includes(wd.slice(0, 6))))) || [...jobs].sort((a, b) => (b.openings || 0) - (a.openings || 0))[0];
  const fast = [...(f0?.growing || jobs)].sort((a, b) => b.change - a.change)[0], slow = f0?.shrinking[0];
  const grad = p.graduation?.trim() || (d.year < 5 ? String(y + 4 - d.year + (now.getMonth() > 6 ? 1 : 0)) : "");
  const summer = ["", "Try a first internship, research or a project you can show.", "Land a first internship.", "The big internship summer. It often turns into a job offer.", "Start your first job, or a last internship that leads to one.", "Grow in your first job."][d.year];
  const stops: { when: string; what: ReactNode }[] = [
    { when: `Now · ${YEARS[d.year]}`, what: next ? <>Work on <b>{clip(next.title)}</b>.</> : <>You've covered this stage. Nice.</> },
    ...(d.year < 5 ? [{ when: `Summer ${now.getMonth() > 6 ? y + 1 : y}`, what: <>{summer}</> }] : []),
    ...(grad && d.year < 5 ? [{ when: `Graduation · ${grad}`, what: job ? <>First job: <b>{job.title.toLowerCase()}</b>{job.wage ? <>, {money(job.wage)} median</> : null}.</> : <>Your first job.</> }] : []),
    { when: "By 2035", what: <>{f0 ? <><b>{f0.fasterThanAverage} of {f0.total}</b> jobs in your field grow faster than average (+{avg}%). </> : null}{fast ? <>Fastest: <b>{fast.title.toLowerCase()}</b> ({fast.change > 0 ? "+" : ""}{fast.change}%). </> : null}{slow ? <>Shrinking: {slow.title.toLowerCase()} ({slow.change}%).</> : null}</> },
  ];
  return <>
    <ol className="ps-tl" data-testid="path-timeline">{stops.map((s, i) => <li key={i} className={i ? "" : "now"}><b>{s.when}</b><p>{s.what}</p></li>)}</ol>
    <p className="pm-src">Projections: {d.future?.source || "U.S. Bureau of Labor Statistics"}.</p>
  </>;
}

/** Three coloured headline numbers for the field's roles, all from BLS. */
function FieldTiles({ jobs }: { jobs: Occ[] }) {
  const pay = jobs.map((o) => o.wage || 0).filter((n) => n > 0).sort((a, b) => a - b);
  const mid = pay.length ? pay[Math.floor(pay.length / 2)] : 0;
  const open = Math.round(jobs.reduce((n, o) => n + (o.openings || 0), 0) * 1000);
  const top = [...jobs].sort((a, b) => b.change - a.change)[0];
  if (!jobs.length) return null;
  return (
    <div className="pm-tiles">
      {mid > 0 && <div className="pm-tile sage"><DollarSign aria-hidden="true" /><b>{money(Math.round(mid / 1000))}k</b><span>median pay across {jobs.length} roles</span></div>}
      {open > 0 && <div className="pm-tile blue"><Briefcase aria-hidden="true" /><b>{open >= 1000 ? `${Math.round(open / 1000)}k` : open}</b><span>openings a year</span></div>}
      {top && <div className="pm-tile amber"><TrendingUp aria-hidden="true" /><b>{top.change > 0 ? "+" : ""}{top.change}%</b><span>fastest: {top.title.toLowerCase()}</span></div>}
    </div>
  );
}

function RoleRow({ o, avg, max, known, mine, open, onOpen }: { o: Occ; avg: number; max: number; known: boolean; mine: boolean; open: boolean; onOpen: () => void }) {
  const up = o.change >= avg, cls = up ? "up" : o.change < 0 ? "neg" : "down";
  return (
    <li className={"pm-row role" + (open ? " open" : "")}>
      <button className="pm-row-btn" onClick={onOpen} aria-expanded={open}>
        <span className={"pm-ico " + (known ? "known" : "")} title={known ? "You've learned this role" : undefined}>{known ? <Check size={16} strokeWidth={3} /> : o.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}</span>
        <div className="pm-role-main"><b>{o.title}{mine && <em className="pm-mine">Your target</em>}</b><small>{o.wage ? `${money(o.wage)} median` : ""}{o.openings ? ` · ${Math.round(o.openings * 1000).toLocaleString("en-US")} openings/yr` : ""}</small></div>
        <span className="pm-growth" title="Growth by 2035; the line is the average job">
          <span className="pm-track"><i className={cls} style={{ width: `${Math.min(100, (Math.abs(o.change) / max) * 100)}%` }} /><em style={{ left: `${Math.min(100, (avg / max) * 100)}%` }} /></span>
          <b className={cls}>{o.change > 0 ? "+" : ""}{o.change}%</b>
        </span>
      </button>
      {open && <div className="pm-row-detail"><StopDetail s={{ id: "role-" + o.soc, kind: "role", year: 1, title: o.title, sub: "", status: known ? "done" : "open", progress: known ? 1 : 0, occ: o }} future={null} onPlay={play} /></div>}
    </li>
  );
}


export function PathBoard() {
  const d = usePathData();
  // ?side=skills (the app's Path rows): open that panel and bring it into view instead of the top of the page.
  const [side] = useState(() => { const s = new URLSearchParams(location.search).get("side"); return (["today", "roles", "skills", "certs", "forecast"] as SideTab[]).find((t) => t === s); });
  const [tab, setTab] = useState<SideTab>(side || "today");
  const [open, setOpen] = useState("");
  const ready = !!(d.careers && d.future);
  useEffect(() => { if (side && ready) setTimeout(() => document.getElementById("path-field")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120); }, [side, ready]);
  const onField = (t: SideTab, o = "") => { setTab(t); setOpen(o); };
  if (!d.careers || !d.future) return <div className="card card-pad row"><Spinner /> <span className="muted">Remy is getting your path ready…</span></div>;
  return (
    <div className="pm ps" data-testid="path-board">
      <Season d={d} />
      <div className="ps-stage">
        <Office d={d} onField={onField} />
        <Side d={d} tab={tab} setTab={setTab} open={open} setOpen={setOpen} />
      </div>
      <LevelUp d={d} />
    </div>
  );
}
