// My Path for owners (Nov 23 2026, "the trail", picked by Dilan from the proactive-Remy proposal): one trail you walk a
// stop a day, with Remy standing on today's stop. Streak, level, freezes and today's quests sit in one strip; three daily
// quests and the week's big move sit beside the trail; "Your field" (roles, skills, certifications, forecast) opens below.
// Every stop and number comes from data Remy already has (DailyPath.tsx buildStops, shared/daily.ts, shared/game.ts).
import { Fragment, useMemo, useState } from "react";
import { ArrowRight, Award, Briefcase, Check, Compass, DollarSign, Eye, Flag, Flame, Gift, Lock, Mountain, MountainSnow, Snowflake, Tent, TrendingDown, TrendingUp, Wrench, Zap } from "lucide-react";
import { ROADS, roadFor, YEARS, yearNumber, NEED_LABEL } from "@shared/roads";
import { levelOf, weekKey, weekMissions, doneThisWeek, counters, xpOf } from "@shared/game";
import { CARD_XP, dailyStreak, dayKey } from "@shared/daily";
import { useStore } from "../lib/store";
import { go } from "../lib/router";
import { Remy, Spinner } from "./common";
import { buildStops, KIND, money, shortTitle, stateOf, StopDetail, useFieldData, type Occ, type Stop } from "./DailyPath";

const play = () => go("/path?play=1");
// Each class year is a named chapter of the climb.
const CHAPTER: Record<number, [string, typeof Tent]> = { 1: ["The base", Tent], 2: ["The climb", Mountain], 3: ["The ridge", MountainSnow], 4: ["The summit", Flag], 5: ["Beyond", Compass] };

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
  const xp = xpOf(w, g), lv = levelOf(xp, g.bestLevel);
  const wk = weekKey(), missions = weekMissions(w, wk), done = doneThisWeek(w, g, wk, counters(w));
  // Daily quests (reset at 4 AM with the day): each counts something the student really did today.
  const now = dayKey();
  const rated = Object.values(w.jobFeedback || {}).filter((f) => f.createdAt && dayKey(new Date(f.createdAt)) === now).length;
  const quests = [
    { key: "rate", icon: Eye, title: "Keep or pass 3 openings", n: Math.min(3, rated), of: 3 },
    { key: "role", icon: Compass, title: "Decode one job", n: today.includes("role") ? 1 : 0, of: 1 },
    { key: "xp", icon: Zap, title: `Earn ${3 * CARD_XP} XP`, n: Math.min(3 * CARD_XP, today.length * CARD_XP), of: 3 * CARD_XP },
  ];
  return { w, mine, setKey, road, stops, year, careers, future, today, streak, xp, lv, missions, done, quests };
}
type D = ReturnType<typeof usePathData>;
const roundDone = (d: D) => (["openings", "role", "forecast"] as const).every((c) => d.today.includes(c));

/* ------------------------------------------------------------------ the strip: streak, level, freezes, quests */

function Hud({ d }: { d: D }) {
  const s = d.streak, lv = d.lv;
  const pct = lv.max ? 100 : Math.round(((d.xp - lv.floor) / Math.max(1, lv.next - lv.floor)) * 100);
  const qDone = d.quests.filter((q) => q.n >= q.of).length;
  return (
    <section className="pt-hud" aria-label="Your progress" data-testid="path-hud">
      <span className="pt-hud-it" title={s.todayDone ? "Done today" : "Play today to keep it"}><Flame size={20} className={"pt-flame" + (s.days ? " lit" : "")} fill="currentColor" aria-hidden="true" /><b>{s.days}</b><small>day streak</small></span>
      <span className="pt-hud-lvl"><i className="pt-badge">{lv.n}</i><span><b>{lv.name}</b><small>{d.xp} / {lv.max ? d.xp : lv.next} XP</small></span>
        <span className="pt-bar" role="progressbar" aria-label="XP to next level" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></span></span>
      <span className="pt-hud-it ice" title="A freeze covers one missed day. You earn one every 7 days."><Snowflake size={18} aria-hidden="true" /><b>{s.freezes}</b><small>{s.freezes === 1 ? "freeze" : "freezes"}</small></span>
      <span className="pt-hud-it gold"><Gift size={18} aria-hidden="true" /><b>{qDone} / 3</b><small>quests</small></span>
    </section>
  );
}

/* ------------------------------------------------------------------ the trail */

const WAVE = [0, 1, 0, -1];
const STEP = 108, TOP = 64;

function Trail({ d }: { d: D }) {
  const years = [1, 2, 3, 4, 5].filter((y) => d.stops.some((s) => s.year === y && s.kind !== "checkpoint"));
  const [pick, setChap] = useState(0);
  const [sel, setSel] = useState("");
  // stops can arrive after first render, so the chapter is derived, never stale
  const chap = years.includes(pick) ? pick : years.includes(d.year) ? d.year : years[0] || 1;
  const ys = d.stops.filter((s) => s.year === chap && s.kind !== "checkpoint");
  const pts = ys.map((_, i) => ({ x: 50 + WAVE[i % WAVE.length] * 24, y: TOP + i * STEP }));
  const h = TOP + Math.max(0, ys.length - 1) * STEP + 76;
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${a.x} ${a.y} C${a.x} ${(a.y + b.y) / 2} ${b.x} ${(a.y + b.y) / 2} ${b.x} ${b.y}`;
  const nowI = ys.findIndex((s) => s.status === "now");
  const picked = ys.find((s) => s.id === sel);
  // Remy stands on the side away from the next stop so the bubble never covers it
  const flip = nowI >= 0 && (pts[nowI].x > 50 || (pts[nowI + 1]?.x ?? 0) > pts[nowI].x);
  const done = roundDone(d), [name] = CHAPTER[chap] || CHAPTER[1];
  const say = <TodaySay d={d} stop={ys[nowI]} done={done} />;
  return (
    <section className="pt-trail" aria-label="Your trail" data-testid="path-trail">
      <header className="pt-chap">
        <span className="pt-chap-n">Chapter {chap}</span><h3>{name}</h3>
        <span className="pt-chap-meta">{chap === 5 ? "After college" : YEARS[chap]} · {ys.filter((s) => s.status === "done").length} of {ys.length} stops</span>
        <select className="input pt-select" value={d.road?.key || ""} onChange={(e) => { d.setKey(e.target.value); setSel(""); }} aria-label="Field" data-testid="select-road">
          {ROADS.map((r) => <option key={r.key} value={r.key}>{r.label}{r.key === d.mine?.key ? " (yours)" : ""}</option>)}
        </select>
      </header>
      <div className="pt-chaps" role="tablist" aria-label="Chapters">
        {years.map((y) => { const [n, G] = CHAPTER[y]; const all = d.stops.filter((s) => s.year === y && s.kind !== "checkpoint"); return (
          <button key={y} role="tab" aria-selected={chap === y} className={y === d.year ? "here" : ""} onClick={() => { setChap(y); setSel(""); }} data-testid={`button-chapter-${y}`}>
            <G size={15} aria-hidden="true" />{n}<small>{all.filter((s) => s.status === "done").length}/{all.length}</small>
          </button>); })}
      </div>
      {nowI >= 0 && <div className="pt-say-top">{say}</div>}
      <div className="pt-map" style={{ height: h }}>
        <svg className="pt-road" viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" aria-hidden="true">
          {pts.slice(1).map((p, i) => <path key={i} d={seg(pts[i], p)} className={ys[i].status === "done" && ys[i + 1].status === "done" ? "on" : ""} vectorEffect="non-scaling-stroke" />)}
        </svg>
        {ys.map((s, i) => {
          const p = pts[i];
          return (
            <Fragment key={s.id}>
              <button className={`pt-node ${s.status}${sel === s.id ? " sel" : ""}`} style={{ left: `${p.x}%`, top: p.y }} onClick={() => setSel(sel === s.id ? "" : s.id)} aria-pressed={sel === s.id} aria-label={`${KIND[s.kind].label}: ${s.title}`} data-testid="road-stop">
                <span className="pt-dot">
                  {s.status !== "done" && s.progress > 0 && <svg className="pt-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="100" strokeDasharray={`${s.progress * 100} 100`} /></svg>}
                  {s.status === "done" ? <Check size={24} strokeWidth={3} /> : s.status === "locked" ? <Lock size={18} /> : KIND[s.kind].icon}
                </span>
                <span className="pt-lbl"><b>{shortTitle(s)}</b><small>{s.status === "now" ? "Today's stop" : KIND[s.kind].label}</small></span>
              </button>
              {i === nowI && (
                <div className={"pt-guide" + (flip ? " flip" : "")} style={flip ? { right: `calc(${100 - p.x}% + 44px)`, top: p.y - 64 } : { left: `calc(${p.x}% + 44px)`, top: p.y - 64 }}>
                  <Remy size={84} mood={done ? "happy" : "idle"} className="pt-fox" />
                  <div className="pt-say-side">{say}</div>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
      {picked && <div className="pm-b-detail"><button className="pm-x" onClick={() => setSel("")} aria-label="Close this stop">Close</button><StopDetail s={picked} future={d.future} onPlay={play} /></div>}
      <p className="pm-src">Usual timelines, mostly Texas rules. Each stop links to where it came from; check it and your advisor before you plan around a step.</p>
    </section>
  );
}

/** Remy's line next to today's stop. */
function TodaySay({ d, stop, done }: { d: D; stop?: Stop; done: boolean }) {
  const s = d.streak;
  return (
    <div className="pt-say" data-testid="path-today">
      {done
        ? <p><b>Done for today.</b> {s.days > 1 ? `That's ${s.days} days in a row.` : "Streak started."} New cards at 4 AM.</p>
        : <p><b>Today's stop{stop ? `: ${shortTitle(stop)}` : ""}.</b> Three one-minute cards. {s.todayDone ? "Your streak is safe; keep going for XP." : s.days ? `Keeps your ${s.days}-day streak.` : "Starts your streak."}</p>}
      <button className="btn btn-primary pt-go" onClick={play} data-testid="button-start-round">{done ? "Play again" : d.today.length ? "Keep going" : "Start"} <ArrowRight size={15} /></button>
    </div>
  );
}

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
            <span className="pt-qb"><b>{q.title}</b><span className="pt-qbar"><i style={{ width: `${(q.n / q.of) * 100}%` }} /></span></span>
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

/* ------------------------------------------------------------------ your field */

/** The merged view: the field's roles with their forecast, plus its skills and certifications, behind one switch. */
function FieldView({ d }: { d: D }) {
  const [tab, setTab] = useState<"roles" | "skills" | "certs">("roles");
  const [open, setOpen] = useState("");
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
    <section className="pm-field" aria-label="Your field">
      <header className="pm-field-head">
        <div><h3>Your field: {d.road?.label.toLowerCase() || d.careers?.[0]?.field}</h3>{f0 && <p><b>{f0.fasterThanAverage} of {f0.total}</b> jobs grow faster than the average job (+{avg}%) by 2035.</p>}</div>
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


export function PathBoard() {
  const d = usePathData();
  const [field, setField] = useState(false);
  if (!d.careers || !d.future) return <div className="card card-pad row"><Spinner /> <span className="muted">Laying out your trail…</span></div>;
  return (
    <div className="pm pt" data-testid="path-board">
      <Hud d={d} />
      <div className="pt-body">
        <Trail d={d} />
        <div className="pt-rail">
          <Quests d={d} />
          <BigMove d={d} />
          <button className="pt-card pt-fieldbtn" onClick={() => setField(!field)} aria-expanded={field} data-testid="button-your-field">
            <TrendingUp size={20} aria-hidden="true" /><span><b>Your field</b><small>Roles, pay, skills and certifications</small></span><ArrowRight size={16} className={field ? "turn" : ""} />
          </button>
        </div>
      </div>
      {field && <FieldView d={d} />}
    </div>
  );
}
