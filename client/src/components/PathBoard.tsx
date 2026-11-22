// My Path for owners (redesign stage 7, layout B picked by Dilan, Nov 22 2026): today's round and the streak on top,
// the whole road as a four-year board, and one "Your field" view that merges career exploration, skills and
// certifications and the forecast. Every stop and number comes from data Remy already has (DailyPath.tsx buildStops).
import { useMemo, useState } from "react";
import { ArrowRight, Award, Briefcase, Check, Compass, DollarSign, Flag, Flame, Lock, Mountain, MountainSnow, Snowflake, Tent, TrendingDown, TrendingUp, Wrench, Zap } from "lucide-react";
import { ROADS, roadFor, YEARS, yearNumber, NEED_LABEL } from "@shared/roads";
import { levelOf, weekKey, weekMissions, doneThisWeek, counters, xpOf } from "@shared/game";
import { CARD_LABEL, dailyStreak, dayKey, weekDots, type DailyCard } from "@shared/daily";
import { useStore } from "../lib/store";
import { go } from "../lib/router";
import { Spinner } from "./common";
import { buildStops, KIND, money, shortTitle, stateOf, StopDetail, useFieldData, type Occ } from "./DailyPath";

const CARDS: DailyCard[] = ["openings", "role", "forecast"];
const play = () => go("/path?play=1");
const STEP: Record<DailyCard, [string, string]> = { openings: ["Look", "Keep or pass new ones"], role: ["Decode", "Guess it from its duties"], forecast: ["Guess", "Which job grows more"] };
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
  const streak = dailyStreak(g), dots = weekDots(g);
  const xp = xpOf(w, g), lv = levelOf(xp, g.bestLevel);
  const wk = weekKey(), missions = weekMissions(w, wk), done = doneThisWeek(w, g, wk, counters(w));
  return { w, mine, setKey, road, stops, year, careers, future, today, streak, dots, xp, lv, missions, done };
}
type D = ReturnType<typeof usePathData>;

/* ------------------------------------------------------------------ shared small pieces */

function RoundCard({ d }: { d: D }) {
  const left = CARDS.filter((c) => !d.today.includes(c)).length;
  return (
    <section className="pm-round">
      <div className="pm-round-head"><span className="pm-kicker">Today's round</span><span className="pm-faint">{left ? `${3 - left} of 3 · about ${left} min` : "Done for today"}</span></div>
      <ol className="pm-round-cards">{CARDS.map((c, i) => <li key={c} className={d.today.includes(c) ? "on" : ""}>
        <i>{d.today.includes(c) ? <Check size={12} strokeWidth={3.5} /> : i + 1}</i>
        <span><small>{STEP[c][0]}</small><b>{CARD_LABEL[c]}</b><em>{STEP[c][1]}</em></span>
      </li>)}</ol>
      <div className="pm-round-go"><span>{left ? (d.streak.todayDone ? "Your streak is safe today" : "Keeps your streak alive tonight") : "All 3 done. Nice."}</span>
        <button className="btn btn-primary pm-go" onClick={play}>{left === 3 ? "Start today's round" : left ? "Keep going" : "Play again"} <ArrowRight size={16} /></button></div>
    </section>
  );
}

function StreakCard({ d }: { d: D }) {
  const s = d.streak, now = dayKey();
  const played = Object.keys(stateOf(d.w).days || {}).length;
  return (
    <section className="pm-streak">
      <div className="pm-streak-n"><Flame size={30} className={s.days ? "lit" : ""} fill="currentColor" /><b>{s.days}</b>
        <span><strong>day streak</strong>{s.todayDone ? "Done today. See you tomorrow" : s.days ? `Finish today to make it ${s.days + 1}` : "Play today to start one"}</span></div>
      <ol className="pm-dots">{d.dots.map((x) => <li key={x.key} className={x.status + (x.key === now && x.status !== "done" ? " today" : "")}><i>{x.status === "done" ? <Check size={11} strokeWidth={3.5} /> : x.status === "freeze" ? <Snowflake size={11} /> : null}</i>{x.key === now ? "Today" : x.label}</li>)}</ol>
      <div className="pm-splits"><div><b>{s.best}</b><span>Best streak</span></div><div><b>{played}</b><span>Days played</span></div><div><b>{s.freezes}</b><span>{s.freezes === 1 ? "Freeze" : "Freezes"} left</span></div></div>
    </section>
  );
}

/** Phone only: the streak as one line, so the round and the road fit on the first screen. */
function MiniStreak({ d }: { d: D }) {
  return <div className="pm-mini"><Flame size={18} className={d.streak.days ? "lit" : ""} fill="currentColor" /><b>{d.streak.days}</b><span>day streak · best {d.streak.best}</span><ol className="pm-dots">{d.dots.map((x) => <li key={x.key} className={x.status}><i>{x.status === "done" ? <Check size={9} strokeWidth={3.5} /> : null}</i></li>)}</ol></div>;
}

function QuestCard({ d }: { d: D }) {
  return (
    <section className="pm-quest">
      <div className="pm-round-head"><span className="pm-kicker dark">This week's big moves</span><span className="pm-faint"><Zap size={12} /> Lv {d.lv.n} {d.lv.name} · {d.done.length} of {d.missions.length}</span></div>
      <ul>{d.missions.map((m) => <li key={m.key} className={d.done.includes(m.key) ? "on" : ""}><i>{d.done.includes(m.key) ? <Check size={12} strokeWidth={3.5} /> : null}</i><span>{m.title}</span><em>+{m.xp}</em></li>)}</ul>
    </section>
  );
}

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

/* ------------------------------------------------------------------ the four-year board */

function Board({ d }: { d: D }) {
  // Four chapters; after-college stops fold into the last one unless the student is already there.
  const fold = d.year < 5;
  const years = [1, 2, 3, 4, 5].filter((y) => (fold ? y < 5 : true) && d.stops.some((s) => s.year === y));
  const after = fold ? d.stops.filter((s) => s.year === 5) : [];
  const [sel, setSel] = useState("");
  const [more, setMore] = useState(false); // columns show 5 stops until opened, so short years don't leave empty columns
  const [tab, setTab] = useState(d.year); // phone: one chapter at a time
  const picked = d.stops.find((s) => s.id === sel);
  const total = d.stops.length, done = d.stops.filter((s) => s.status === "done").length;
  const of = (y: number) => d.stops.filter((s) => s.year === y && s.kind !== "checkpoint");
  const shownTab = years.includes(tab) ? tab : years[years.length - 1];
  const chip = (s: (typeof d.stops)[number]) => (
    <li key={s.id}><button className={`pm-chip ${s.status}${sel === s.id ? " sel" : ""}`} onClick={() => setSel(sel === s.id ? "" : s.id)} aria-pressed={sel === s.id} title={s.title}>
      <i>{s.status === "done" ? <Check size={10} strokeWidth={3.5} /> : s.status === "locked" ? <Lock size={8} /> : null}</i>
      <span><b>{shortTitle(s)}</b><small>{KIND[s.kind].label}</small></span>
      {s.status === "now" && <em>Next</em>}
    </button></li>
  );
  return (
    <section className="pm-board" aria-label="Your road">
      <header className="pm-board-head">
        <h3>Your {d.road?.label.toLowerCase() || "field's"} road</h3>
        <div className="pm-progress" aria-hidden="true"><i style={{ width: `${(done / Math.max(1, total)) * 100}%` }} /></div>
        <span className="pm-count"><b>{done}</b> of {total} stops</span>
        <select className="input pm-select" value={d.road?.key || ""} onChange={(e) => { d.setKey(e.target.value); setSel(""); }} aria-label="Field">
          {ROADS.map((r) => <option key={r.key} value={r.key}>{r.label}{r.key === d.mine?.key ? " (yours)" : ""}</option>)}
        </select>
      </header>
      <div className="pm-ytabs" role="tablist" aria-label="Class year">
        {years.map((y) => { const ys = of(y), n = ys.filter((s) => s.status === "done").length, [name, G] = CHAPTER[y]; return (
          <button key={y} role="tab" aria-selected={shownTab === y} className={y === d.year ? "here" : ""} onClick={() => setTab(y)}>
            <G size={20} aria-hidden="true" /><b>{name}</b><small>{y === 5 ? "After" : `Year ${y}`} · {n}/{ys.length}</small><i><u style={{ width: `${(n / Math.max(1, ys.length)) * 100}%` }} /></i>
          </button>); })}
      </div>
      <div className="pm-cols" style={{ ["--n" as string]: years.length }}>
        {years.map((y) => {
          const ys = of(y), n = ys.filter((s) => s.status === "done").length, [name, G] = CHAPTER[y];
          const past = y < d.year, last = y === years[years.length - 1];
          return (
            <div key={y} className={"pm-col" + (y === d.year ? " here" : past ? " past" : "") + (y === shownTab ? " shown" : "")}>
              <div className="pm-col-head">
                <span className="pm-glyph"><G size={17} aria-hidden="true" /></span>
                <div><b>{name}</b><small>{YEARS[y]}</small></div>
                {y === d.year ? <em className="pm-you">You</em> : <span className="pm-cnt">{n}/{ys.length}</span>}
              </div>
              <ul>{(more ? ys : ys.filter((s, i) => i < 5 || s.status === "now")).map(chip)}{!more && ys.length > 5 && <li><button className="pm-more" onClick={() => setMore(true)}>+{ys.filter((s, i) => i >= 5 && s.status !== "now").length} more</button></li>}</ul>
              {past && n > 0 && <p className="pm-say">{n === ys.length ? "Chapter done." : `${n} of ${ys.length} done here.`}</p>}
              {last && after.length > 0 && (
                <div className="pm-after"><b>After college <span>{after.filter((s) => s.status === "done").length}/{after.length}</span></b>
                  <div>{after.map((s) => <button key={s.id} className={sel === s.id ? "sel" : ""} onClick={() => setSel(sel === s.id ? "" : s.id)} aria-pressed={sel === s.id}>{shortTitle(s)}</button>)}</div></div>
              )}
            </div>
          );
        })}
      </div>
      {picked && <div className="pm-b-detail"><button className="pm-x" onClick={() => setSel("")} aria-label="Close this stop">Close</button><StopDetail s={picked} future={d.future} onPlay={play} /></div>}
      <p className="pm-src">Usual timelines, mostly Texas rules. Each stop links to where it came from; check it and your advisor before you plan around a step.</p>
    </section>
  );
}

export function PathBoard() {
  const d = usePathData();
  if (!d.careers || !d.future) return <div className="card card-pad row"><Spinner /> <span className="muted">Laying out your road…</span></div>;
  return (
    <div className="pm" data-testid="path-board">
      <MiniStreak d={d} />
      <div className="pm-b-top"><RoundCard d={d} /><StreakCard d={d} /></div>
      <Board d={d} />
      <FieldView d={d} />
      <QuestCard d={d} />
    </div>
  );
}
