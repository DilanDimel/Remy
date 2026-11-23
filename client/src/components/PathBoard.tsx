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

function Office({ d, onField }: { d: D; onField: (tab: FieldTab, open?: string) => void }) {
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
      <div className="pt-card-head"><span className="pm-kicker dark">Remy's office</span><span className="pm-faint">{nextItem ? `Level ${nextItem[2]} adds a ${nextItem[1].toLowerCase()}` : "Fully furnished"}</span></div>
      <div className="ps-room">
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
        <span className="ps-desk-fox"><Remy size={120} mood="idle" /></span>
        <button className="ps-tag" style={at(78, 82)} onClick={() => onField("roles")} data-testid="button-office-books">{known ? `${known} job${known === 1 ? "" : "s"} decoded` : "Decode your first job"}</button>
        <button className={"ps-tag" + (cert ? "" : " ghost")} style={at(70, 282)} onClick={() => onField("certs")} data-testid="button-office-cert">{cert ? "Certificate earned" : "First certificate"}</button>
        <button className={"ps-tag" + (resume ? "" : " ghost")} style={at(318, 62)} onClick={() => go("/resume")} data-testid="button-office-resume">{resume ? "Resume on file" : "Add your resume"}</button>
        <span className="ps-tag still" style={at(236, 328)}>{d.streak.days ? `${d.streak.days}-day streak` : "Plant needs a streak"}</span>
        <button className={"ps-tag" + (applied ? "" : " ghost")} style={at(626, 440)} onClick={() => go("/opportunities")} data-testid="button-office-briefcase">{applied ? `${d.w.applications.length} applied` : "First application"}</button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Remy walks in and explains */

const HELLO_KEY = "remy-path-hello";
const seenToday = () => { try { return localStorage.getItem(HELLO_KEY) === dayKey(); } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(HELLO_KEY, dayKey()); } catch { /* private mode: he greets again next time */ } };

function Hello({ d, onField }: { d: D; onField: (tab: FieldTab, open?: string) => void }) {
  const p = d.w.profile, name = (p.preferredName || p.name || "").trim().split(/\s+/)[0];
  const [open, setOpen] = useState(() => !seenToday());
  const [step, setStep] = useState(0);
  // While he's on the page, his seat in the side panel sits empty.
  useEffect(() => {
    document.documentElement.classList.toggle("remy-away", open);
    return () => document.documentElement.classList.remove("remy-away");
  }, [open]);
  const jobs = d.careers?.[0]?.jobs || [];
  const targets = (p.targetRoles || "").toLowerCase().split(/,\s*/).filter(Boolean);
  const byOpenings = [...jobs].sort((a, b) => (b.openings || 0) - (a.openings || 0));
  // "Financial analyst" should find BLS's "Financial and investment analysts": every word's stem must appear.
  const fits = (title: string) => targets.some((t) => t.split(/\s+/).every((wd) => title.toLowerCase().includes(wd.slice(0, 6))));
  const top = jobs.find((o) => fits(o.title)) || byOpenings[0];
  const roles = byOpenings.filter((o) => o !== top).slice(0, 4);
  // Skills Remy's path suggested come first; without a path yet, this year's milestones and certifications from the road.
  const todo = d.stops.filter((s) => s.status !== "done" && ["skill", "step", "cert"].includes(s.kind));
  const rank = (s: (typeof todo)[number]) => (s.kind === "skill" ? 0 : 2) + (s.year <= d.year ? 0 : 4) + (s.kind === "cert" ? 1 : 0) + (s.optional ? 3 : 0);
  const skills = [...todo].sort((a, b) => rank(a) - rank(b) || a.year - b.year).slice(0, 3);
  const avg = d.future?.allJobsGrowth ?? 0;
  const qLeft = d.quests.filter((q) => q.n < q.of).length;
  const who = p.major.trim() ? `studying ${p.major.trim()}` : "still exploring";
  const yearWord = d.year === 5 ? "out of college" : `in your ${YEARS[d.year].toLowerCase()} year`;
  const close = () => { markSeen(); setOpen(false); setStep(0); };
  const steps: { say: ReactNode; body: ReactNode }[] = [
    { say: <><b>Hi{name ? ` ${name}` : ""}.</b> You're {who}, {yearWord}. Here's how your job could look.</>,
      body: top ? <button className="ps-job" onClick={() => { onField("roles", top.soc); close(); }} data-testid="button-hello-job">
        <b>{top.title}</b>
        <span className="ps-facts">{top.wage ? <span><DollarSign size={14} />{money(top.wage)} median</span> : null}<span className={top.change >= avg ? "up" : ""}><TrendingUp size={14} />{top.change > 0 ? "+" : ""}{top.change}% by 2035</span>{top.openings ? <span><Briefcase size={14} />{Math.round(top.openings * 1000).toLocaleString("en-US")} openings a year</span> : null}</span>
      </button> : <p className="ps-none">Tell me your major and I'll show you real pay and growth for your field.</p> },
    { say: <>These are other jobs {p.major ? "your major" : "this field"} leads to. Tap one and I'll walk you through it.</>,
      body: <div className="ps-roles">{roles.map((o) => <button key={o.soc} onClick={() => { onField("roles", o.soc); close(); }} data-testid="button-hello-role"><b>{shortRole(o.title)}</b>{o.wage ? <small>{money(o.wage)}</small> : null}</button>)}</div> },
    { say: <>Here's what to work on now, while you're {d.year === 5 ? "starting out" : `a ${YEARS[d.year].toLowerCase()}`}. Tap one to see why it matters.</>,
      body: skills.length ? <div className="ps-roles">{skills.map((s) => s.kind === "step"
        ? <div key={s.id} className="ps-step"><b>{s.title}</b><small>{s.sub}</small></div>
        : <button key={s.id} onClick={() => { onField(s.kind === "cert" ? "certs" : "skills", s.id); close(); }} data-testid="button-hello-skill"><b>{s.title}</b><small>{s.sub}</small></button>)}</div> : <p className="ps-none">You've covered the core skills for this stage. Nice.</p> },
    { say: qLeft ? <>Today: {qLeft} quest{qLeft === 1 ? "" : "s"} left, about {qLeft * 2} minutes. Each one moves you up the season.</> : <>All three quests done today. Your streak is safe.</>,
      body: <button className="btn btn-primary" onClick={() => { close(); play(); }} data-testid="button-hello-start">{qLeft ? "Start today's cards" : "Play again"} <ArrowRight size={15} /></button> },
  ];
  if (!open) return (
    <section className="ps-hello closed" aria-label="Remy" data-testid="path-hello">
      <Remy size={40} mood="idle" />
      <p><b>{qLeft ? `${qLeft} quest${qLeft === 1 ? "" : "s"} left today.` : "Done for today."}</b> {top ? `${top.title}: ${top.wage ? `${money(top.wage)} median, ` : ""}${top.change > 0 ? "+" : ""}${top.change}% by 2035.` : ""}</p>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} data-testid="button-hello-again">Walk me through it</button>
    </section>
  );
  const st = steps[step];
  return (
    <section className="ps-hello" aria-label="Remy walks you through My Path" data-testid="path-hello">
      <span className="ps-walker"><Remy size={128} mood={step === 0 ? "wave" : "idle"} /></span>
      <div className="ps-bubble" aria-live="polite">
        <span className="pm-kicker">Remy · {step + 1} of {steps.length}</span>
        <p>{st.say}</p>
        {st.body}
        <div className="ps-nav">
          <span className="ps-dots" aria-hidden="true">{steps.map((_, i) => <i key={i} className={i === step ? "on" : ""} />)}</span>
          <button className="btn btn-ghost btn-sm" onClick={close} data-testid="button-hello-skip">{step === steps.length - 1 ? "Close" : "Skip"}</button>
          {step < steps.length - 1 && <button className="btn btn-secondary btn-sm" onClick={() => setStep(step + 1)} data-testid="button-hello-next">Next <ArrowRight size={14} /></button>}
        </div>
      </div>
    </section>
  );
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

/** The merged view: the field's roles with their forecast, plus its skills and certifications, behind one switch. */
function FieldView({ d, focus }: { d: D; focus: { tab: FieldTab; open: string; n: number } }) {
  const [tab, setTab] = useState<FieldTab>(focus.tab);
  const [open, setOpen] = useState(focus.open);
  // Remy (or an office object) points here: switch to that list and open the row he named.
  useEffect(() => { if (focus.n) { setTab(focus.tab); setOpen(focus.open); if ((d.careers?.[0]?.jobs || []).findIndex((o) => o.soc === focus.open) >= 8) setAll(true); } }, [focus.n]); // eslint-disable-line react-hooks/exhaustive-deps
  const jobs = d.careers?.[0]?.jobs || [];
  const avg = d.future?.allJobsGrowth ?? 0;
  const f0 = d.future?.fields[0];
  const known = new Set((stateOf(d.w).known || []).map((k) => k.toLowerCase()));
  const mine = new Set((d.w.profile.targetRoles || "").toLowerCase().split(/,\s*/).filter(Boolean));
  const max = Math.max(10, ...jobs.map((o) => Math.abs(o.change)));
  const skills = d.stops.filter((s) => s.kind === "skill"), certs = d.stops.filter((s) => s.kind === "cert");
  const [all, setAll] = useState(false);
  const shown = all ? jobs : jobs.slice(0, 8);
  return (
    <section className="pm-field" aria-label="Your field" id="path-field" data-testid="path-field">
      <header className="pm-field-head">
        <div><h3>Your field: {d.road?.label.toLowerCase() || d.careers?.[0]?.field}</h3>{f0 && <p><b>{f0.fasterThanAverage} of {f0.total}</b> jobs grow faster than the average job (+{avg}%) by 2035.</p>}</div>
        <select className="input ps-select" value={d.road?.key || ""} onChange={(e) => { d.setKey(e.target.value); setOpen(""); }} aria-label="Field" data-testid="select-road">
          {ROADS.map((r) => <option key={r.key} value={r.key}>{r.label}{r.key === d.mine?.key ? " (yours)" : ""}</option>)}
        </select>
        <div className="pm-seg" role="tablist">
          {([["roles", "Roles", jobs.length], ["skills", "Skills", skills.length], ["certs", "Certifications", certs.length]] as const).map(([k, l, n]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setOpen(""); }}>{l} <span>{n}</span></button>)}
        </div>
      </header>
      {tab === "roles" && <>
        <FieldTiles jobs={jobs} />
        <ul className="pm-rows">
          {shown.map((o) => <RoleRow key={o.soc} o={o} avg={avg} max={max} known={known.has(o.title.toLowerCase())} mine={mine.has(o.title.toLowerCase())} open={open === o.soc} onOpen={() => setOpen(open === o.soc ? "" : o.soc)} />)}
        </ul>
        {jobs.length > 8 && <button className="pm-link" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${jobs.length} roles`} <ArrowRight size={14} /></button>}
        <p className="pm-src">Pay, openings and growth: {d.future?.source || "U.S. Bureau of Labor Statistics"}. The line on each bar is the average job.</p>
      </>}
      {tab !== "roles" && (
        <ul className="pm-rows">
          {(tab === "skills" ? skills : certs).map((s) => (
            <li key={s.id} className={"pm-row role" + (open === s.id ? " open" : "")}>
              <button className="pm-row-btn two" onClick={() => setOpen(open === s.id ? "" : s.id)} aria-expanded={open === s.id}>
                <span className={"pm-ico" + (s.status === "done" ? " known" : "")}>{s.status === "done" ? <Check size={16} strokeWidth={3} /> : tab === "skills" ? <Wrench size={16} /> : <Award size={16} />}</span>
                <div className="pm-role-main"><b>{s.title}</b><small>{tab === "skills" ? s.sub : s.cred ? NEED_LABEL[s.cred.need] : ""} · usually {YEARS[s.year].toLowerCase()}</small></div>
                <span className={"pm-pill " + s.status}>{s.status === "done" ? "Done" : s.progress ? "On your list" : "Open"}</span>
              </button>
              {open === s.id && <div className="pm-row-detail"><StopDetail s={s} future={d.future} onPlay={play} /></div>}
            </li>
          ))}
        </ul>
      )}
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


type FieldTab = "roles" | "skills" | "certs";

export function PathBoard() {
  const d = usePathData();
  const [focus, setFocus] = useState<{ tab: FieldTab; open: string; n: number }>({ tab: "roles", open: "", n: 0 });
  const onField = (tab: FieldTab, open = "") => {
    setFocus((f) => ({ tab, open, n: f.n + 1 }));
    setTimeout(() => document.getElementById("path-field")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  if (!d.careers || !d.future) return <div className="card card-pad row"><Spinner /> <span className="muted">Remy is getting your path ready…</span></div>;
  return (
    <div className="pm ps" data-testid="path-board">
      <Hello d={d} onField={onField} />
      <Season d={d} />
      <div className="ps-body">
        <Office d={d} onField={onField} />
        <div className="ps-rail">
          <Quests d={d} />
          <BigMove d={d} />
        </div>
      </div>
      <FieldView d={d} focus={focus} />
      <LevelUp d={d} />
    </div>
  );
}

