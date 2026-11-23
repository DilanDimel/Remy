// My Path for owners (Nov 23 2026, "season rewards" picked by Dilan, with Remy's office mixed in). Remy walks onto the
// page and explains the student's field (future job, jobs the major leads to, skills for their year); the season track
// gives a reward at every level (Remy's outfits or a new thing for his office); quests and the week's big move come from
// every tab; "Your field" (roles, skills, certifications) sits on the page. Every number comes from data Remy already
// has (DailyPath.tsx buildStops, shared/daily.ts, shared/game.ts, BLS via /api/careers and /api/future).
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Award, Briefcase, Check, Compass, DollarSign, Eye, Flame, Gift, Snowflake, TrendingDown, TrendingUp, Wrench, Zap } from "lucide-react";
import { ROADS, roadFor, YEARS, yearNumber, NEED_LABEL } from "@shared/roads";
import { rankOf, weekKey, weekMissions, doneThisWeek, counters, xpOf, nextOutfit, unlockedOutfits, levelReward, OFFICE, RANKS, WARDROBE } from "@shared/game";
import { CARD_XP, dailyStreak, dayKey, streakDays } from "@shared/daily";
import { api, useStore } from "../lib/store";
import type { Workspace } from "@shared/types";
import { go } from "../lib/router";
import { Modal, Remy, Rich, Spinner } from "./common";
import { OUTFITS } from "./scholar";
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
  // Daily quests (reset at 4 AM with the day): each counts something the student really did today.
  const now = dayKey();
  const rated = Object.values(w.jobFeedback || {}).filter((f) => f.createdAt && dayKey(new Date(f.createdAt)) === now).length;
  const quests = [
    { key: "rate", icon: Eye, title: "Keep or pass 3 openings", n: Math.min(3, rated), of: 3, from: "Opportunities", link: "/opportunities" },
    { key: "role", icon: Compass, title: "Decode one job", n: today.includes("role") ? 1 : 0, of: 1, from: "My Path", link: "/path?play=1" },
    { key: "xp", icon: Zap, title: `Earn ${3 * CARD_XP} XP`, n: Math.min(3 * CARD_XP, today.length * CARD_XP), of: 3 * CARD_XP, from: "Anywhere in Remy", link: "/path?play=1" },
  ];
  return { w, g, mine, setKey, road, stops, year, careers, future, today, streak, xp, lv, missions, done, quests };
}
type D = ReturnType<typeof usePathData>;

/* ------------------------------------------------------------------ the season: a reward at every level */

/** The semester we're in, the day it ends, and what this season is for at the student's year. */
export function seasonOf(now: Date, year: number) {
  const y = now.getFullYear(), m = now.getMonth(), day = now.getDate();
  const [name, end] = (m > 7 || (m === 7 && day > 15)) && !(m === 11 && day > 15) ? ["Fall", new Date(y, 11, 15)]
    : m === 11 ? ["Spring", new Date(y + 1, 4, 15)]
    : m < 4 || (m === 4 && day <= 15) ? ["Spring", new Date(y, 4, 15)] : ["Summer", new Date(y, 7, 15)];
  const left = Math.max(0, Math.ceil((+end - +now) / 864e5));
  const goal = ["", "Find the jobs that fit you", "Get your first interview", "Land a summer internship", "Turn it into a job offer", "Grow in your first job"][year] || "Find the jobs that fit you";
  return { name: name as string, left, goal };
}

function Season({ d }: { d: D }) {
  const { save } = useStore();
  const lv = d.lv, s = d.streak, se = seasonOf(new Date(), d.year);
  const owned = unlockedOutfits(lv.n, d.w.profile.classYear), wearing = d.g.outfit && owned.includes(d.g.outfit) ? d.g.outfit : "suit";
  const first = Math.max(1, Math.min(lv.n - 2, RANKS.length - 7));
  const tiles = Array.from({ length: 8 }, (_, i) => first + i).filter((n) => n <= RANKS.length);
  const pct = lv.max ? 100 : Math.round(((d.xp - lv.floor) / Math.max(1, lv.next - lv.floor)) * 100);
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
        <span>{lv.max ? <b>Top level reached.</b> : <><b>{d.xp - lv.floor} / {lv.next - lv.floor} XP</b> to level {lv.n + 1}</>}</span>
        <span>{se.left} days left this season{bigNext ? ` · Level ${bigNext[1]} unlocks ${OUTFITS[bigNext[0]].name.toLowerCase()}` : ""}</span>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Remy's office: fills up from levels and real steps */

/** Small drawings of the office rewards, used on the season track and in the room. Strokes and fills are tokens. */
function OfficeThing({ k }: { k: string }) {
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
    skyline: <><rect x="6" y="6" width="32" height="28" rx="3" {...st} /><path d="M9 31v-8h5v-6h5v14h3V13h6v18h3v-9h4v9z" fill="var(--blue-bg)" /></>,
  };
  return <svg className="ps-thing" viewBox="0 0 44 40" aria-hidden="true">{art[k] || <circle cx="22" cy="20" r="10" {...st} />}</svg>;
}

/* Where Remy can be in his office (room units, viewBox 0 40 860 430). y is the top of his drawing: seated he shows
   from the chest up behind the desk; standing, his feet touch the floor behind the desk's front edge. */
const FOX_S = 0.62;
type Spot = "desk" | "shelf" | "window";
const SPOTS: Record<Spot, { x: number; y: number; sit?: boolean }> = { desk: { x: 455, y: 208, sit: true }, shelf: { x: 262, y: 192 }, window: { x: 668, y: 192 } };
type Pose = "" | "type" | "point" | "point-low";
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

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

function Office({ d, onField }: { d: D; onField: (tab: SideTab, open?: string) => void }) {
  const g = useGuide(d, onField);
  const fox = useDeskFox();
  const [mood, setMood] = useState<"idle" | "wave" | "think">("idle");
  // On My Path his side panel is closed (App.tsx): you talk to him here, and he answers in the room.
  const { config, setWs, run } = useStore();
  const [q, setQ] = useState(""), [busy, setBusy] = useState(false), [said, setSaid] = useState<{ q: string; id?: string; live?: string } | null>(null);
  const busyRef = useRef(false);
  const aiOn = !!config?.ai.available;
  const reply = said?.id ? d.w.chat.find((m) => m.id === said.id) : null;
  const ask = async () => {
    const text = q.trim();
    if (!text || busy) return;
    setQ(""); setSaid({ q: text }); setBusy(true); busyRef.current = true;
    fox.moveTo("desk", "type"); setMood("think");
    const before = new Set(d.w.chat.map((m) => m.id));
    // His answer appears as he writes it (owners' server streams it), like the Remy panel.
    const w = await run(() => api<Workspace>("POST", "/api/ai/chat?stream=1", { message: text, page: "My Path", where: location.pathname + location.search, tabs: [] }, (l) => { if (typeof l.reply === "string") setSaid({ q: text, live: l.reply }); }));
    setBusy(false); busyRef.current = false; fox.setPose(""); setMood("idle");
    if (w) { setWs(w); setSaid({ q: text, id: [...w.chat].reverse().find((m) => m.role === "assistant" && !before.has(m.id))?.id }); }
  };
  const has = (k: string) => (OFFICE.find(([key]) => key === k)?.[2] || 99) <= d.lv.n;
  const known = (d.g.known || []).length, books = Math.min(8, known), resume = !!d.w.resume, applied = d.w.applications.length > 0;
  const cert = d.stops.some((s) => s.kind === "cert" && s.status === "done");
  const nextItem = OFFICE.find(([, , l]) => l > d.lv.n);
  const owned = unlockedOutfits(d.g.bestRank || d.lv.n, d.w.profile.classYear), wearing = d.g.outfit && owned.includes(d.g.outfit) ? d.g.outfit : "suit";
  const suit = Object.fromEntries((OUTFITS[wearing] || OUTFITS.suit).vars.split(";").map((kv) => kv.split(":"))) as CSSProperties;
  const ink = "var(--ink)", line = { stroke: ink, strokeWidth: 2.5, strokeLinejoin: "round" as const };
  const ghost = { fill: "none", stroke: "var(--fox-deep)", strokeOpacity: 0.45, strokeWidth: 2, strokeDasharray: "4 4" };
  const at = (x: number, y: number) => ({ left: `${(x / 860) * 100}%`, top: `${((y - 40) / 430) * 100}%` });
  const bookColors = ["var(--fox)", "var(--sage)", "var(--ink)", "var(--blue)", "var(--amber)", "var(--fox-deep)", "var(--sage)", "var(--fox)"];

  // The walk-through moves him: each step names a spot and what he does there. Starting it, he waves first.
  const stepKey = g.on ? g.step : -1;
  useEffect(() => {
    if (!g.on) { setMood("idle"); fox.moveTo("desk"); return; }
    const s = g.steps[g.step];
    const greet = g.step === 0 && fox.seated() && !reduced();
    setMood(greet || s.wave ? "wave" : "idle");
    const t = fox.moveTo(s.spot, s.pose, s.face, greet ? 1500 : 0);
    if (greet) fox.later(() => setMood("idle"), t);
  }, [stepKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // On his own: types for a while, now and then gets up to look out the window. Never during the walk-through.
  useEffect(() => {
    if (g.on || reduced()) return;
    let t = 0;
    fox.later(() => fox.setPose("type"), 1200);
    const tick = () => { t = window.setTimeout(() => {
      if (!document.hidden && fox.seated() && !busyRef.current) {
        const r = Math.random();
        if (r < 0.55) { fox.setPose("type"); fox.later(() => fox.setPose(""), 5000); }
        else if (r < 0.8) { const ms = fox.moveTo("window"); fox.later(() => fox.moveTo("desk", "type"), ms + 3800); }
      }
      tick();
    }, 9000 + Math.random() * 6000); };
    tick();
    return () => clearTimeout(t);
  }, [g.on]); // eslint-disable-line react-hooks/exhaustive-deps

  const arrived = !fox.walk;
  const ring = g.on && arrived ? g.steps[g.step].ring : null;
  return (
    <section className="ps-office" aria-label="Remy's office" data-testid="path-office">
      <div className="pt-card-head"><span className="pm-kicker dark">Remy's office</span><span className="pm-faint">{nextItem ? `Level ${nextItem[2]} adds a ${nextItem[1].toLowerCase()}` : "Fully furnished"}</span>
        {!g.on && <button className="btn btn-ghost btn-sm ps-again" onClick={g.start} data-testid="button-hello-again">Walk me through it</button>}</div>
      <div className="ps-roomwrap">
      <div className={"ps-room" + (g.on ? " guiding" : "")} data-testid="path-hello">
        <svg className="ps-scene" viewBox="0 40 860 430" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
          <defs><clipPath id="ps-win"><rect x="560" y="56" width="220" height="152" rx="10" /></clipPath></defs>
          {/* the wall */}
          <rect x="0" y="352" width="860" height="118" fill="color-mix(in srgb, var(--fox) 14%, var(--fox-soft))" />
          <line x1="0" y1="352" x2="860" y2="352" {...line} />
          <rect x="560" y="56" width="220" height="152" rx="10" fill="var(--surface)" />
          <g clipPath="url(#ps-win)">
            <path className="ps-cloud" d="M560 96a11 11 0 0 1 20-6a13 13 0 0 1 24 4a9 9 0 0 1 0 18h-40a8 8 0 0 1-4-16z" fill="var(--blue-bg)" />
            <path className="ps-cloud two" d="M560 74a8 8 0 0 1 14-4a10 10 0 0 1 18 3a7 7 0 0 1 0 14h-30a6 6 0 0 1-2-13z" fill="var(--blue-bg)" />
            <path d={has("skyline") ? "M570 208V140h24v-40h20v108h18V82h26v126h14v-80h22v80h20v-50h16v50h20V208z" : "M570 208V170h24v-30h20v68h18v-80h26v80h14v-40h22v40h20v-20h16v20h20V208z"} fill={has("skyline") ? "var(--blue-bg)" : "color-mix(in srgb, var(--fox) 22%, var(--surface))"} />
          </g>
          <rect x="560" y="56" width="220" height="152" rx="10" fill="none" {...line} />
          <line x1="670" y1="56" x2="670" y2="208" {...line} /><line x1="560" y1="132" x2="780" y2="132" {...line} />
          <rect x="40" y="178" width="200" height="10" rx="3" fill="var(--surface)" {...line} />
          {Array.from({ length: 8 }, (_, i) => { const h = [62, 54, 66, 58, 62, 52, 60, 56][i], x = 52 + i * 22; return i < books
            ? <rect key={i} x={x} y={178 - h} width="18" height={h} rx="2" fill={bookColors[i]} {...line} />
            : <rect key={i} x={x} y={178 - h} width="18" height={h} rx="2" {...ghost} />; })}
          <rect x="40" y="268" width="200" height="10" rx="3" fill="var(--surface)" {...line} />
          {cert ? <rect x="56" y="226" width="40" height="42" rx="4" fill="var(--amber-bg)" {...line} /> : <rect x="56" y="226" width="40" height="42" rx="4" {...ghost} />}
          {has("trophy") && <g transform="translate(130 228)"><path d="M14 6h16v8a8 8 0 0 1-16 0z" fill="var(--amber-bg)" {...line} /><path d="M22 22v10M14 38h16" {...line} /></g>}
          {resume ? <><rect x="282" y="70" width="92" height="116" rx="6" fill="var(--surface)" {...line} /><path d="M304 100h48M304 112h40M304 124h46M304 136h30M304 148h42" stroke="var(--muted-text)" strokeWidth="3" strokeLinecap="round" /></>
            : <rect x="282" y="70" width="92" height="116" rx="6" {...ghost} />}
          {has("painting") && <g transform="translate(410 84)"><rect width="70" height="54" rx="3" fill="var(--surface)" {...line} /><path d="M6 48l18-22 14 16 9-9 17 15z" fill="var(--sage)" /></g>}
          {has("clock") && <g transform="translate(818 64)"><circle r="20" cx="0" cy="20" fill="var(--surface)" {...line} /><path className="ps-hand" d="M0 20V8" fill="none" {...line} /><path d="M0 20l8 6" fill="none" {...line} /></g>}
          {has("rug") && <ellipse cx="470" cy="430" rx="230" ry="30" fill="var(--fox-soft)" stroke={ink} strokeWidth="2.5" />}
          {has("globe") && <g transform="translate(790 300)"><circle cx="22" cy="22" r="20" fill="var(--blue-bg)" {...line} /><path d="M2 22h40M22 2c-8 10-8 30 0 40M22 2c8 10 8 30 0 40" fill="none" {...line} /><path d="M10 52h24M22 42v10" {...line} /></g>}
          {/* his chair, then Remy, then the desk in front of him */}
          <path d="M398 340V262c0-22 14-34 57-34s57 12 57 34v78z" fill="var(--fox-deep)" {...line} />
          <path d="M414 330V266c0-12 10-22 41-22s41 10 41 22v64" fill="none" stroke="color-mix(in srgb, var(--white) 30%, transparent)" strokeWidth="2.5" />
          <g className={"ps-fox" + (fox.walk ? " walk" : "") + (fox.y === SPOTS.desk.y && fox.x === SPOTS.desk.x ? " sit" : "")} style={{ transform: `translateX(${fox.x - 100 * FOX_S}px)`, transitionDuration: `${fox.walk || 0}ms` }}>
            <g className="ps-fox-y" style={{ transform: `translateY(${fox.y}px)` }}>
              <g transform={`scale(${FOX_S})`}><g transform={fox.face < 0 ? "translate(200 0) scale(-1 1)" : undefined}><g className="ps-fox-bob" style={suit}>
                <g className="ps-legs">
                  <g className="ps-tail"><path d="M144 268C196 272 214 226 200 190C194 214 178 236 146 246Z" /><path className="tip" d="M200 190C204 202 204 214 199 226C192 214 192 200 200 190Z" /></g>
                  <g className="ps-leg l"><path d="M82 244v52" className="ps-trouser-ol" /><path d="M82 244v52" className="ps-trouser" /><ellipse cx="76" cy="306" rx="24" ry="12" className="ps-shoe" /></g>
                  <g className="ps-leg r"><path d="M118 244v52" className="ps-trouser-ol" /><path d="M118 244v52" className="ps-trouser" /><ellipse cx="124" cy="306" rx="24" ry="12" className="ps-shoe" /></g>
                  <path className="ps-hem" d="M34 214H166L158 254H42Z" />
                </g>
                <Remy size={200} mood={mood} outfit={wearing} className={fox.pose ? `o-${fox.pose}` : ""} />
              </g></g></g>
            </g>
          </g>
          <rect x="310" y="334" width="320" height="16" rx="5" fill="var(--surface)" {...line} />
          <rect x="322" y="350" width="296" height="56" rx="3" fill="var(--surface-2)" {...line} />
          <path d="M532 378h60" {...line} strokeLinecap="round" /><path d="M554 364h16M554 392h16" stroke={ink} strokeWidth="4" strokeLinecap="round" />
          <g transform="translate(2 34)"><path d="M330 300h36l-5-26h-26z" fill="var(--fox)" {...line} />
            {d.streak.days > 0 && <g className="ps-sway"><path d="M348 274C348 250 334 240 326 232M348 270C352 248 366 238 376 236M348 262C346 244 348 228 350 218" stroke="var(--sage)" strokeWidth="4" fill="none" strokeLinecap="round" /></g>}</g>
          {has("lamp") && <g transform="translate(370 282)"><path d="M10 52h26M23 52V22" {...line} /><path d="M8 22l8-16h14l6 16z" fill="var(--amber-bg)" {...line} /></g>}
          <path d="M498 334l10-46h82l-10 46z" fill="var(--ink)" {...line} /><circle cx="544" cy="310" r="4" fill="var(--fox)" />
          {has("mug") && <g transform="translate(598 314)"><path d="M0 0h16v16a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z" fill="var(--fox)" {...line} /><path className="ps-steam" d="M5-4q-3-5 0-9M11-4q3-5 0-9" stroke="var(--muted-text)" strokeWidth="2" fill="none" strokeLinecap="round" /></g>}
          {/* the front of the room */}
          {has("bigplant") && <g transform="translate(806 368)"><path d="M0 70h40l-6-36H6z" fill="var(--fox)" {...line} /><g className="ps-sway"><path d="M20 34C20 10 2 0-6-10M20 34C20 10 38 0 46-10M20 34V-20" stroke="var(--sage)" strokeWidth="5" fill="none" strokeLinecap="round" /></g></g>}
          {applied ? <g transform="translate(60 386)"><rect width="86" height="60" rx="8" fill="var(--fox-deep)" {...line} /><path d="M26 0v-12h34v12" fill="none" {...line} /></g>
            : <g transform="translate(60 386)"><rect width="86" height="60" rx="8" {...ghost} /><path d="M26 0v-12h34v12" {...ghost} /></g>}
        </svg>
        {ring && <span className="ps-ring" style={at(ring[0], ring[1])} aria-hidden="true" />}
        <button className="ps-tag" style={at(40, 92)} onClick={() => onField("roles")} data-testid="button-office-books">{known ? `${known} job${known === 1 ? "" : "s"} decoded` : "Decode your first job"}</button>
        <button className={"ps-tag" + (cert ? "" : " ghost")} style={at(40, 296)} onClick={() => onField("certs")} data-testid="button-office-cert">{cert ? "Certificate earned" : "First certificate"}</button>
        <button className={"ps-tag" + (resume ? "" : " ghost")} style={at(282, 58)} onClick={() => go("/resume")} data-testid="button-office-resume">{resume ? "Resume on file" : "Add your resume"}</button>
        <span className="ps-tag still" style={at(334, 384)}>{d.streak.days ? `${d.streak.days}-day streak` : "Plant needs a streak"}</span>
        <button className={"ps-tag" + (applied ? "" : " ghost")} style={at(156, 416)} onClick={() => go("/opportunities")} data-testid="button-office-briefcase">{applied ? `${d.w.applications.length} applied` : "First application"}</button>
      </div>
        {g.on ? <div className="ps-bubble" style={{ "--tail": `${Math.min(92, Math.max(8, (fox.x / 860) * 100))}%` } as CSSProperties} aria-live="polite" data-testid="path-guide">{g.bubble}</div>
          : <>
            {said && <div className="ps-bubble chat" style={{ "--tail": `${(fox.x / 860) * 100}%` } as CSSProperties} aria-live="polite" data-testid="office-reply">
              <div className="ps-chat-head"><span className="pm-kicker">You asked: {said.q}</span><button className="btn btn-ghost btn-sm" onClick={() => setSaid(null)} data-testid="button-office-reply-close">Close</button></div>
              {busy ? (said.live ? <div className="ps-reply"><Rich text={said.live} /></div> : <p className="pm-faint">Remy is thinking…</p>) : reply ? <div className="ps-reply"><Rich text={reply.text} /></div> : <p className="pm-faint">I couldn't answer that one. Try asking again.</p>}
            </div>}
            <form className="ps-ask" onSubmit={(e) => { e.preventDefault(); ask(); }}>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} disabled={!aiOn || busy} placeholder={aiOn ? "Ask Remy anything about your path…" : "Remy's chat is off on this server"} aria-label="Ask Remy" data-testid="input-office-ask" />
              <button className="btn btn-primary" disabled={!aiOn || busy || !q.trim()} data-testid="button-office-ask">Ask</button>
            </form>
          </>}
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
  const [on, setOn] = useState(() => !seenToday() && typeof d.w.settings.tour !== "number"); // waits while the site tour runs, so two guides never talk at once
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
  const yearWord = d.year === 5 ? "out of college" : `in your ${YEARS[d.year].toLowerCase()} year`;
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
    { say: <>The forecast for your field: {f0 ? <><b>{f0.fasterThanAverage} of {f0.total}</b> jobs grow faster than average</> : "how jobs change by 2035"}{fastest ? <>, and the fastest is <b>{fastest.title.toLowerCase()}</b> ({fastest.change > 0 ? "+" : ""}{fastest.change}%)</> : null}.</>,
      spot: "window", pose: "point", ring: [670, 118], tab: "forecast" },
    { say: qLeft ? <>That's my office. Today you have {qLeft} quest{qLeft === 1 ? "" : "s"} left, about {qLeft * 2} minutes. Each level adds something to the room.</> : <>That's my office. All three quests are done today, so your streak is safe.</>,
      cta: <button className="btn btn-primary btn-sm" onClick={() => { close(); play(); }} data-testid="button-hello-start">{qLeft ? "Start today's cards" : "Play again"} <ArrowRight size={14} /></button>,
      spot: "desk", pose: "", wave: true, ring: null, tab: "today" },
  ];
  const go2 = (i: number) => { const s = steps[Math.max(0, Math.min(steps.length - 1, i))]; setStep(steps.indexOf(s)); onField(s.tab, s.open || ""); };
  const start = () => { setOn(true); go2(0); };
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
  return (
    <section className="pt-card" aria-label="Daily quests" data-testid="path-quests">
      <div className="pt-card-head"><span className="pm-kicker dark">Daily quests</span><span className="pm-faint">New at 4 AM</span></div>
      <ul className="pt-quests">
        {d.quests.map((q) => { const ok = q.n >= q.of, I = q.icon; return (
          <li key={q.key} className={ok ? "ok" : ""}>
            <span className="pt-qi">{ok ? <Check size={17} strokeWidth={3} /> : <I size={17} />}</span>
            <button className="pt-qb" onClick={() => go(q.link)} data-testid={`button-quest-${q.key}`}><b>{q.title}</b><small>From {q.from}</small><span className="pt-qbar"><i style={{ width: `${(q.n / q.of) * 100}%` }} /></span></button>
            <span className="pt-qn">{q.n} / {q.of}</span>
          </li>); })}
      </ul>
      <div className={"pt-chest" + (all ? " open" : "")}><Gift size={22} aria-hidden="true" /><span>{all ? "Chest open. All three done today, nice." : "Finish all three to open today's chest."}</span></div>
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
  useEffect(() => { setTimeout(() => {
    const body = document.querySelector(".ps-side-body"), row = body?.querySelector(".pm-row.open");
    body?.scrollTo({ top: row ? body.scrollTop + row.getBoundingClientRect().top - body.getBoundingClientRect().top - 8 : 0, behavior: "smooth" });
  }, 80); }, [open, tab]);
  const tabs: [SideTab, string, number | null][] = [["today", "Today", null], ["roles", "Roles", jobs.length], ["skills", "Skills", skills.length], ["certs", "Certs", certs.length], ["forecast", "Forecast", null]];
  return (
    <section className="ps-side" aria-label="Today and your field" id="path-field" data-testid="path-field">
      <header className="ps-side-head">
        <div className="seg ps-side-seg" role="tablist">
          {tabs.map(([k, l, n]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setOpen(""); }} data-testid={`tab-side-${k}`}>{l}{n !== null && <span>{n}</span>}</button>)}
        </div>
      </header>
      <div className="ps-side-body">
        {tab === "today" && <><Quests d={d} /><BigMove d={d} /></>}
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
        {tab === "forecast" && <>
          {f0 && <p className="ps-fc"><b>{f0.fasterThanAverage} of {f0.total}</b> jobs in {d.road?.label.toLowerCase() || f0.field} grow faster than the average job (+{avg}%) by 2035.</p>}
          {f0?.growing.length ? <><h4 className="ps-h4 up"><TrendingUp size={15} /> Growing</h4><ul className="pm-rows">{f0.growing.map(row)}</ul></> : null}
          {f0?.shrinking.length ? <><h4 className="ps-h4 neg"><TrendingDown size={15} /> Shrinking</h4><ul className="pm-rows">{f0.shrinking.map(row)}</ul></> : null}
          <p className="pm-src">Projections: {d.future?.source || "U.S. Bureau of Labor Statistics"}.</p>
        </>}
      </div>
    </section>
  );
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
        <span className={"pm-ico " + (known ? "known" : "")} title={known ? "You've learned this role" : undefined}>{known ? <Check size={16} strokeWidth={3} /> : up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}</span>
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
  const [tab, setTab] = useState<SideTab>("today");
  const [open, setOpen] = useState("");
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
