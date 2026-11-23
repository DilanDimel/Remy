// My Path for owners (Nov 23 2026, "season rewards" picked by Dilan, with Remy's office mixed in). Remy walks onto the
// page and explains the student's field (future job, jobs the major leads to, skills for their year); the season track
// gives a reward at every level (Remy's outfits or a new thing for his office); quests and the week's big move come from
// every tab; "Your field" (roles, skills, certifications) sits on the page. Every number comes from data Remy already
// has (DailyPath.tsx buildStops, shared/daily.ts, shared/game.ts, BLS via /api/careers and /api/future).
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Award, Briefcase, Check, Compass, DollarSign, Eye, Flame, Gift, Snowflake, TrendingDown, TrendingUp, Wrench, Zap } from "lucide-react";
import { ROADS, roadFor, YEARS, yearNumber, NEED_LABEL } from "@shared/roads";
import { rankOf, weekKey, weekMissions, doneThisWeek, counters, xpOf, nextOutfit, unlockedOutfits, levelReward, OFFICE, RANKS, WARDROBE } from "@shared/game";
import { CARD_XP, dailyStreak, dayKey } from "@shared/daily";
import { useStore } from "../lib/store";
import { go } from "../lib/router";
import { Modal, Remy, Spinner } from "./common";
import { OUTFITS } from "./scholar";
import { buildStops, money, stateOf, StopDetail, useFieldData, type Occ } from "./DailyPath";

const play = () => go("/path?play=1");

function usePathData() {
  const { ws } = useStore();
  const w = ws!, p = w.profile;
  const { careers, future } = useFieldData();
  const mine = roadFor(p.major, p.path) || roadFor([p.targetRoles, p.interests].join(" "), p.path);
  const [key, setKey] = useState(mine?.key || "");
  const road = ROADS.find((r) => r.key === key);
  const stops = useMemo(() => buildStops(w, road, careers, future, w.plan), [w, road, careers, future]);
  const year = Math.min(5, Math.max(1, yearNumber(p.classYear) || 1));
  const g = stateOf(w);
  const today = g.days?.[dayKey()] || [];
  const streak = dailyStreak(g);
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

function Office({ d, onField }: { d: D; onField: (tab: SideTab, open?: string) => void }) {
  const g = useGuide(d, onField);
  const has = (k: string) => (OFFICE.find(([key]) => key === k)?.[2] || 99) <= d.lv.n;
  const known = (d.g.known || []).length, books = Math.min(8, known), resume = !!d.w.resume, applied = d.w.applications.length > 0;
  const cert = d.stops.some((s) => s.kind === "cert" && s.status === "done");
  const nextItem = OFFICE.find(([, , l]) => l > d.lv.n);
  const ink = "var(--ink)", line = { stroke: ink, strokeWidth: 2.5, strokeLinejoin: "round" as const };
  const ghost = { fill: "none", stroke: "var(--fox-deep)", strokeOpacity: 0.45, strokeWidth: 2, strokeDasharray: "4 4" };
  const at = (x: number, y: number) => ({ left: `${(x / 860) * 100}%`, top: `${((y - 40) / 430) * 100}%` });
  const bookColors = ["var(--fox)", "var(--sage)", "var(--ink)", "var(--blue)", "var(--amber)", "var(--fox-deep)", "var(--sage)", "var(--fox)"];
  return (
    <section className="ps-office" aria-label="Remy's office" data-testid="path-office">
      <div className="pt-card-head"><span className="pm-kicker dark">Remy's office</span><span className="pm-faint">{nextItem ? `Level ${nextItem[2]} adds a ${nextItem[1].toLowerCase()}` : "Fully furnished"}</span>
        {!g.on && <button className="btn btn-ghost btn-sm ps-again" onClick={g.start} data-testid="button-hello-again">Walk me through it</button>}</div>
      <div className="ps-roomwrap">
      <div className={"ps-room" + (g.on ? " guiding" : "")} data-testid="path-hello">
        <svg className="ps-scene" viewBox="0 40 860 430" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
          <rect x="0" y="352" width="860" height="118" fill="color-mix(in srgb, var(--fox) 14%, var(--fox-soft))" />
          {has("rug") && <ellipse cx="430" cy="420" rx="220" ry="32" fill="var(--fox-soft)" stroke={ink} strokeWidth="2.5" />}
          <line x1="0" y1="352" x2="860" y2="352" {...line} />
          <rect x="560" y="60" width="220" height="170" rx="10" fill="var(--surface)" {...line} />
          <path d={has("skyline") ? "M570 220V150h24v-40h20v110h18V90h26v130h14v-80h22v80h20v-50h16v50h20V220z" : "M570 220V180h24v-30h20v50h18v-70h26v70h14v-40h22v40h20v-20h16v20h20V220z"} fill={has("skyline") ? "var(--blue-bg)" : "color-mix(in srgb, var(--fox) 22%, var(--surface))"} />
          <line x1="670" y1="60" x2="670" y2="230" {...line} /><line x1="560" y1="145" x2="780" y2="145" {...line} />
          <rect x="70" y="178" width="200" height="10" rx="3" fill="var(--surface)" {...line} />
          {Array.from({ length: 8 }, (_, i) => { const h = [62, 54, 66, 58, 62, 52, 60, 56][i], x = 82 + i * 22; return i < books
            ? <rect key={i} x={x} y={178 - h} width="18" height={h} rx="2" fill={bookColors[i]} {...line} />
            : <rect key={i} x={x} y={178 - h} width="18" height={h} rx="2" {...ghost} />; })}
          <rect x="70" y="268" width="200" height="10" rx="3" fill="var(--surface)" {...line} />
          {cert ? <rect x="86" y="226" width="40" height="42" rx="4" fill="var(--amber-bg)" {...line} /> : <rect x="86" y="226" width="40" height="42" rx="4" {...ghost} />}
          {has("trophy") && <g transform="translate(150 228)"><path d="M14 6h16v8a8 8 0 0 1-16 0z" fill="var(--amber-bg)" {...line} /><path d="M22 22v10M14 38h16" {...line} /></g>}
          {resume ? <><rect x="330" y="70" width="92" height="116" rx="6" fill="var(--surface)" {...line} /><path d="M352 100h48M352 112h40M352 124h46M352 136h30M352 148h42" stroke="var(--muted-text)" strokeWidth="3" strokeLinecap="round" /></>
            : <rect x="330" y="70" width="92" height="116" rx="6" {...ghost} />}
          {has("painting") && <g transform="translate(450 84)"><rect width="70" height="54" rx="3" fill="var(--surface)" {...line} /><path d="M6 48l18-22 14 16 9-9 17 15z" fill="var(--sage)" /></g>}
          {has("clock") && <g transform="translate(800 70)"><circle r="20" cx="0" cy="20" fill="var(--surface)" {...line} /><path d="M0 8v12l8 6" fill="none" {...line} /></g>}
          <rect x="250" y="300" width="360" height="20" rx="5" fill="var(--surface)" {...line} />
          <path d="M272 320v80M588 320v80" stroke={ink} strokeWidth="5" strokeLinecap="round" />
          <path d="M470 300l12-48h86l-12 48z" fill="var(--ink)" {...line} />
          <g transform="translate(-30 0)"><path d="M300 300h36l-5-26h-26z" fill="var(--fox)" {...line} />
            {d.streak.days > 0 && <path d="M318 274C318 250 304 240 296 232M318 270C322 248 336 238 346 236M318 262C316 244 318 228 320 218" stroke="var(--sage)" strokeWidth="4" fill="none" strokeLinecap="round" />}</g>
          {has("lamp") && <g transform="translate(566 248)"><path d="M10 52h26M23 52V22" {...line} /><path d="M8 22l8-16h14l6 16z" fill="var(--amber-bg)" {...line} /></g>}
          {has("mug") && <g transform="translate(400 278)"><path d="M0 0h16v16a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z" fill="var(--fox)" {...line} /></g>}
          {has("globe") && <g transform="translate(700 300)"><circle cx="22" cy="22" r="20" fill="var(--blue-bg)" {...line} /><path d="M2 22h40M22 2c-8 10-8 30 0 40M22 2c8 10 8 30 0 40" fill="none" {...line} /><path d="M10 52h24M22 42v10" {...line} /></g>}
          {has("bigplant") && <g transform="translate(780 330)"><path d="M0 70h40l-6-36H6z" fill="var(--fox)" {...line} /><path d="M20 34C20 10 2 0-6-10M20 34C20 10 38 0 46-10M20 34V-20" stroke="var(--sage)" strokeWidth="5" fill="none" strokeLinecap="round" /></g>}
          {applied ? <g transform="translate(640 372)"><rect width="86" height="60" rx="8" fill="var(--fox-deep)" {...line} /><path d="M26 0v-12h34v12" fill="none" {...line} /></g>
            : <g transform="translate(640 372)"><rect width="86" height="60" rx="8" {...ghost} /><path d="M26 0v-12h34v12" {...ghost} /></g>}
        </svg>
        {g.on && g.ring && <span className="ps-ring" style={at(g.ring[0], g.ring[1])} aria-hidden="true" />}
        <span className={"ps-desk-fox" + (g.walking ? " walking" : "")} style={{ left: `${g.fox}%` }}><Remy size={120} mood={g.on && g.step === 0 ? "wave" : "idle"} /></span>
        <button className="ps-tag" style={at(78, 82)} onClick={() => onField("roles")} data-testid="button-office-books">{known ? `${known} job${known === 1 ? "" : "s"} decoded` : "Decode your first job"}</button>
        <button className={"ps-tag" + (cert ? "" : " ghost")} style={at(70, 282)} onClick={() => onField("certs")} data-testid="button-office-cert">{cert ? "Certificate earned" : "First certificate"}</button>
        <button className={"ps-tag" + (resume ? "" : " ghost")} style={at(318, 62)} onClick={() => go("/resume")} data-testid="button-office-resume">{resume ? "Resume on file" : "Add your resume"}</button>
        <span className="ps-tag still" style={at(236, 328)}>{d.streak.days ? `${d.streak.days}-day streak` : "Plant needs a streak"}</span>
        <button className={"ps-tag" + (applied ? "" : " ghost")} style={at(626, 440)} onClick={() => go("/opportunities")} data-testid="button-office-briefcase">{applied ? `${d.w.applications.length} applied` : "First application"}</button>
      </div>
        {g.on && <div className={"ps-bubble " + (g.fox > 50 ? "left" : "right")} aria-live="polite">{g.bubble}</div>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Remy walks in and explains */

const HELLO_KEY = "remy-path-hello";
const seenToday = () => { try { return localStorage.getItem(HELLO_KEY) === dayKey(); } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(HELLO_KEY, dayKey()); } catch { /* private mode: he greets again next time */ } };

/** Remy's walk-through, played inside his office: he walks to each object, says what it means for you, and the panel
 *  beside the office opens the matching list. First visit each day plays it; "Walk me through it" replays it. */
function useGuide(d: D, onField: (tab: SideTab, open?: string) => void) {
  const p = d.w.profile, name = (p.preferredName || p.name || "").trim().split(/\s+/)[0];
  const [on, setOn] = useState(() => !seenToday() && typeof d.w.settings.tour !== "number"); // waits while the site tour runs, so two guides never talk at once
  const [step, setStep] = useState(0);
  const [walking, setWalking] = useState(false);
  // While he's in the office, his seat in the side panel sits empty.
  useEffect(() => {
    document.documentElement.classList.toggle("remy-away", on);
    return () => document.documentElement.classList.remove("remy-away");
  }, [on]);
  const jobs = d.careers?.[0]?.jobs || [];
  const targets = (p.targetRoles || "").toLowerCase().split(/,\s*/).filter(Boolean);
  const byOpenings = [...jobs].sort((a, b) => (b.openings || 0) - (a.openings || 0));
  // "Financial analyst" should find BLS's "Financial and investment analysts": every word's stem must appear.
  const fits = (title: string) => targets.some((t) => t.split(/\s+/).every((wd) => title.toLowerCase().includes(wd.slice(0, 6))));
  const top = jobs.find((o) => fits(o.title)) || byOpenings[0];
  const roles = byOpenings.filter((o) => o !== top).slice(0, 4);
  // Skills Remy's path suggested come first; without a path yet, this year's milestones from the road.
  const todo = d.stops.filter((s) => s.status !== "done" && (s.kind === "skill" || s.kind === "step"));
  const rank = (s: (typeof todo)[number]) => (s.kind === "skill" ? 0 : 2) + (s.year <= d.year ? 0 : 4) + (s.optional ? 3 : 0);
  const skills = [...todo].sort((a, b) => rank(a) - rank(b) || a.year - b.year).slice(0, 2);
  const certs = d.stops.filter((s) => s.kind === "cert" && s.status !== "done").sort((a, b) => +!!a.optional - +!!b.optional).slice(0, 2);
  const avg = d.future?.allJobsGrowth ?? 0, f0 = d.future?.fields[0];
  const fastest = [...jobs].sort((a, b) => b.change - a.change)[0];
  const qLeft = d.quests.filter((q) => q.n < q.of).length;
  const who = p.major.trim() ? `studying ${p.major.trim()}` : "still exploring";
  const yearWord = d.year === 5 ? "out of college" : `in your ${YEARS[d.year].toLowerCase()} year`;
  const asA = d.year === 5 ? "starting out" : `a ${YEARS[d.year].toLowerCase()}`;
  const close = () => { markSeen(); setOn(false); setStep(0); onField("today"); };
  const pick = (tab: SideTab, open = "") => { onField(tab, open); };
  const chip = (key: string, label: string, sub: string, act: () => void, testid: string) => <button key={key} onClick={act} data-testid={testid}><b>{label}</b><small>{sub}</small></button>;
  // [what he says, what he shows, fox position (% across the room), the object he points at (room coords), the panel tab]
  const steps: [ReactNode, ReactNode, number, [number, number] | null, SideTab][] = [
    [<><b>Hi{name ? ` ${name}` : ""}.</b> You're {who}, {yearWord}. Out that window is where you're headed:</>,
      top ? <button className="ps-job" onClick={() => pick("roles", top.soc)} data-testid="button-hello-job"><b>{top.title}</b>
        <span className="ps-facts">{top.wage ? <span><DollarSign size={13} />{money(top.wage)} median</span> : null}<span className={top.change >= avg ? "up" : ""}><TrendingUp size={13} />{top.change > 0 ? "+" : ""}{top.change}% by 2035</span>{top.openings ? <span><Briefcase size={13} />{Math.round(top.openings * 1000).toLocaleString("en-US")} openings a year</span> : null}</span></button>
        : <p className="ps-none">Tell me your major and I'll show you real pay and growth for your field.</p>, 66, [670, 145], "roles"],
    [<>Every book on this shelf is a job you've decoded. Here are more your {p.major ? "major" : "field"} leads to:</>,
      <div className="ps-roles">{roles.map((o) => chip(o.soc, shortRole(o.title), o.wage ? money(o.wage) : "", () => pick("roles", o.soc), "button-hello-role"))}</div>, 34, [170, 140], "roles"],
    [<>What to work on now, while you're {asA}:</>,
      skills.length ? <div className="ps-roles">{skills.map((s) => chip(s.id, s.title, s.sub, () => pick("skills", s.id), "button-hello-skill"))}</div> : <p className="ps-none">You've covered this stage. Nice.</p>, 52, [520, 276], "skills"],
    [<>This frame is for your first certification. The ones that matter in your field:</>,
      certs.length ? <div className="ps-roles">{certs.map((s) => chip(s.id, s.title, s.sub, () => pick("certs", s.id), "button-hello-cert"))}</div> : <p className="ps-none">Your field doesn't require one. Projects matter more.</p>, 30, [106, 247], "certs"],
    [<>The forecast for your field: {f0 ? <><b>{f0.fasterThanAverage} of {f0.total}</b> jobs grow faster than average</> : "how jobs change by 2035"}{fastest ? <>, fastest is <b>{fastest.title.toLowerCase()}</b> ({fastest.change > 0 ? "+" : ""}{fastest.change}%)</> : null}.</>,
      <button className="btn btn-secondary btn-sm" onClick={() => pick("forecast")} data-testid="button-hello-forecast">See the forecast <ArrowRight size={14} /></button>, 66, [670, 190], "forecast"],
    [qLeft ? <>That's your office. Today: {qLeft} quest{qLeft === 1 ? "" : "s"} left, about {qLeft * 2} minutes. Each one adds to the room.</> : <>That's your office. All three quests done today, your streak is safe.</>,
      <button className="btn btn-primary btn-sm" onClick={() => { close(); play(); }} data-testid="button-hello-start">{qLeft ? "Start today's cards" : "Play again"} <ArrowRight size={14} /></button>, 50, null, "today"],
  ];
  const go2 = (i: number) => { setStep(i); setWalking(true); onField(steps[i][4]); setTimeout(() => setWalking(false), 900); };
  const start = () => { setOn(true); go2(0); };
  // the panel follows him on the first step too
  useEffect(() => { if (on) onField(steps[step][4]); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [say, body, fox, ring] = steps[step];
  const bubble = <>
    <span className="pm-kicker">Remy · {step + 1} of {steps.length}</span>
    <p>{say}</p>{body}
    <div className="ps-nav">
      <span className="ps-dots" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i === step ? "on" : ""} />)}</span>
      <button className="btn btn-ghost btn-sm" onClick={close} data-testid="button-hello-skip">{step === steps.length - 1 ? "Done" : "Skip"}</button>
      {step < steps.length - 1 && <button className="btn btn-secondary btn-sm" onClick={() => go2(step + 1)} data-testid="button-hello-next">Next <ArrowRight size={14} /></button>}
    </div></>;
  return { on, step, start, walking, fox: on ? fox : 50, ring, bubble };
}

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
  useEffect(() => { if (open) setTimeout(() => document.querySelector(".ps-side .pm-row.open")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80); }, [open, tab]);
  const tabs: [SideTab, string, number | null][] = [["today", "Today", null], ["roles", "Roles", jobs.length], ["skills", "Skills", skills.length], ["certs", "Certs", certs.length], ["forecast", "Forecast", null]];
  return (
    <section className="ps-side" aria-label="Today and your field" id="path-field" data-testid="path-field">
      <header className="ps-side-head">
        <div className="pm-seg" role="tablist">
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
