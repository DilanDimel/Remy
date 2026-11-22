// My Path for owners (redesign stage 7, layout B picked by Dilan, Nov 22 2026): today's round and the streak on top,
// the whole road as a four-year board, and one "Your field" view that merges career exploration, skills and
// certifications and the forecast. Every stop and number comes from data Remy already has (DailyPath.tsx buildStops).
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Award, Check, Flame, Lock, Snowflake, TrendingDown, TrendingUp, Wrench, Zap } from "lucide-react";
import { ROADS, roadFor, YEARS, yearNumber, NEED_LABEL } from "@shared/roads";
import { levelOf, weekKey, weekMissions, doneThisWeek, counters, xpOf } from "@shared/game";
import { CARD_LABEL, dailyStreak, dayKey, weekDots, type DailyCard } from "@shared/daily";
import { useStore } from "../lib/store";
import { go } from "../lib/router";
import { Spinner } from "./common";
import { buildStops, KIND, money, shortTitle, stateOf, StopDetail, useFieldData, type Occ } from "./DailyPath";

const CARDS: DailyCard[] = ["openings", "role", "forecast"];
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
      <ol className="pm-round-cards">{CARDS.map((c) => <li key={c} className={d.today.includes(c) ? "on" : ""}><i>{d.today.includes(c) ? <Check size={12} strokeWidth={3.5} /> : null}</i>{CARD_LABEL[c]}</li>)}</ol>
      <button className="btn btn-primary pm-go" onClick={play}>{left === 3 ? "Start today's round" : left ? "Keep going" : "Play again"} <ArrowRight size={16} /></button>
    </section>
  );
}

function StreakCard({ d }: { d: D }) {
  const pct = d.lv.max ? 100 : Math.round((100 * (d.xp - d.lv.floor)) / Math.max(1, d.lv.next - d.lv.floor));
  return (
    <section className="pm-streak">
      <div className="pm-streak-n"><Flame size={28} className={d.streak.days ? "lit" : ""} fill="currentColor" /><b>{d.streak.days}</b><span>day streak</span></div>
      <ol className="pm-dots">{d.dots.map((x) => <li key={x.key} className={x.status}><i>{x.status === "done" ? <Check size={10} strokeWidth={3.5} /> : x.status === "freeze" ? <Snowflake size={10} /> : null}</i>{x.label}</li>)}</ol>
      <div className="pm-meta"><span><Snowflake size={13} /> {d.streak.freezes} freezes</span><span><Zap size={13} /> Lv {d.lv.n} {d.lv.name}</span></div>
      <div className="pm-bar"><i style={{ width: `${pct}%` }} /></div>
    </section>
  );
}

/** Phone only: the streak as one line, so the round and the road fit on the first screen. */
function MiniStreak({ d }: { d: D }) {
  return <div className="pm-mini"><Flame size={18} className={d.streak.days ? "lit" : ""} fill="currentColor" /><b>{d.streak.days}</b><span>day streak</span><ol className="pm-dots">{d.dots.map((x) => <li key={x.key} className={x.status}><i>{x.status === "done" ? <Check size={9} strokeWidth={3.5} /> : null}</i></li>)}</ol></div>;
}

function QuestCard({ d }: { d: D }) {
  return (
    <section className="pm-quest">
      <div className="pm-round-head"><span className="pm-kicker dark">This week's big moves</span><span className="pm-faint">{d.done.length} of {d.missions.length}</span></div>
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
  const years = [1, 2, 3, 4, 5].filter((y) => d.stops.some((s) => s.year === y));
  const [sel, setSel] = useState("");
  const [more, setMore] = useState(false); // columns show 5 stops until opened, so short years don't leave empty columns
  const picked = d.stops.find((s) => s.id === sel);
  const total = d.stops.length, done = d.stops.filter((s) => s.status === "done").length;
  // On a phone the board scrolls sideways; open it on the student's own year.
  const cols = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = cols.current?.querySelector<HTMLElement>(".pm-col.here"); if (el && cols.current && cols.current.scrollWidth > cols.current.clientWidth) cols.current.scrollLeft = el.offsetLeft - 8; }, [d.road?.key]);
  return (
    <section className="pm-board" aria-label="Your road">
      <header className="pm-board-head">
        <div><h3>Your {d.road?.label.toLowerCase() || "field's"} road</h3><span className="pm-faint">{done} of {total} stops done · tap a stop to open it</span></div>
        <select className="input pm-select" value={d.road?.key || ""} onChange={(e) => { d.setKey(e.target.value); setSel(""); }} aria-label="Field">
          {ROADS.map((r) => <option key={r.key} value={r.key}>{r.label}{r.key === d.mine?.key ? " (yours)" : ""}</option>)}
        </select>
      </header>
      <div className="pm-progress" aria-hidden="true"><i style={{ width: `${(done / Math.max(1, total)) * 100}%` }} /></div>
      <div className="pm-cols" ref={cols} style={{ ["--n" as string]: years.length }}>
        {years.map((y) => {
          const ys = d.stops.filter((s) => s.year === y && s.kind !== "checkpoint");
          const n = ys.filter((s) => s.status === "done").length;
          return (
            <div key={y} className={"pm-col" + (y === d.year ? " here" : y < d.year ? " past" : "")}>
              <div className="pm-col-head"><b>{YEARS[y]}</b><span>{y === d.year ? "You are here" : `${n}/${ys.length}`}</span></div>
              <ul>{(more ? ys : ys.filter((s, i) => i < 5 || s.status === "now")).map((s) => (
                <li key={s.id}><button className={`pm-chip ${s.status}${sel === s.id ? " sel" : ""}`} onClick={() => setSel(sel === s.id ? "" : s.id)} aria-pressed={sel === s.id} title={s.title}>
                  <i>{s.status === "done" ? <Check size={11} strokeWidth={3.5} /> : s.status === "locked" ? <Lock size={9} /> : null}</i>
                  <span><b>{shortTitle(s)}</b><small>{KIND[s.kind].label}</small></span>
                  {s.status === "now" && <em>Next</em>}
                </button></li>
              ))}{!more && ys.length > 5 && <li><button className="pm-more" onClick={() => setMore(true)}>+{ys.filter((s, i) => i >= 5 && s.status !== "now").length} more</button></li>}</ul>
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
