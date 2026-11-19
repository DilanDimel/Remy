// Career quest (owners only while it's tested, Nov 19): the left-menu level + streak, and Home's weekly missions.
// Logic lives in shared/game.ts; this only shows it and keeps the week's record (starting counts, finished missions).
import { useEffect } from "react";
import { ArrowRight, Award, Check, Flame, Lock, Snowflake, Star, Zap } from "lucide-react";
import type { Workspace } from "@shared/types";
import { ALL_DONE_BONUS, badges, counters, doneThisWeek, levelOf, streak, weekKey, weekMissions, xpOf, type GameState } from "@shared/game";
import { useStore } from "../lib/store";
import { go } from "../lib/router";

const stateOf = (w: Workspace): GameState => w.game || { weeks: {} };

/** Keeps this week's record: the counts at the start (first visit of the week) and missions as they finish. */
export function useGameRecord(w: Workspace | null | undefined, on: boolean) {
  const { save } = useStore();
  const key = weekKey();
  const g = w ? stateOf(w) : { weeks: {} };
  const now = w ? counters(w) : {};
  const done = w ? doneThisWeek(w, g, key, now) : [];
  const sig = JSON.stringify([key, done, !!g.weeks[key]]);
  useEffect(() => {
    if (!on || !w) return;
    const week = g.weeks[key];
    if (!week) { save("game", { weeks: { ...trim(g.weeks), [key]: { base: now, done: [] } } }).catch(() => {}); return; }
    if (done.length > week.done.length) save("game", { weeks: { ...g.weeks, [key]: { ...week, done } } }).catch(() => {});
  }, [on, sig]);
}
// Two years of weeks at most (the server keeps 110).
const trim = (weeks: GameState["weeks"]) => Object.fromEntries(Object.entries(weeks).sort(([a], [b]) => b.localeCompare(a)).slice(0, 104));

export function GameSidebar({ w }: { w: Workspace }) {
  const g = stateOf(w), key = weekKey();
  const lv = levelOf(xpOf(w, g)), s = streak(g, key);
  const pct = lv.max ? 100 : Math.round((100 * (xpOf(w, g) - lv.floor)) / Math.max(1, lv.next - lv.floor));
  return (
    <button onClick={() => go("/#missions")} className="game-side" data-testid="game-sidebar" title="Career quest (owners only while we test it)">
      <div className="row-between">
        <span className="row" style={{ gap: 6 }}><span className="game-lv">{lv.n}</span><b className="small">{lv.name}</b></span>
        <span className="row xs" style={{ gap: 3, color: "#e8590c", fontWeight: 800 }}><Flame size={15} fill={s.weeks ? "#ff922b" : "none"} /> {s.weeks} wk</span>
      </div>
      <div className="game-bar"><div style={{ width: `${pct}%` }} /></div>
      <div className="row-between xs muted"><span>{xpOf(w, g)}{lv.max ? "" : ` / ${lv.next}`} XP</span><span className="row" style={{ gap: 3 }}><Snowflake size={12} /> {s.freezeUsed ? "freeze used" : "1 freeze"}</span></div>
    </button>
  );
}

export function MissionBoard({ w }: { w: Workspace }) {
  const g = stateOf(w), key = weekKey();
  const missions = weekMissions(w, key);
  const done = doneThisWeek(w, g, key, counters(w));
  const s = streak(g, key), lv = levelOf(xpOf(w, g));
  const n = missions.filter((m) => done.includes(m.key)).length;
  return (
    <section id="missions" className="card card-pad stack" data-testid="mission-board">
      <div className="row-between" style={{ flexWrap: "wrap", gap: 10 }}>
        <div>
          <span className="eyebrow">This week's missions <span className="chip chip-plain xs" style={{ marginLeft: 6 }}>Owners only · testing</span></span>
          <h3 style={{ marginTop: 2 }}>{n === 0 ? "One mission keeps your streak alive" : n < 3 ? `${n} of 3 done · your streak is safe this week` : `All 3 done · +${ALL_DONE_BONUS} XP bonus`}</h3>
        </div>
        <div className="row" style={{ gap: 14 }}>
          <span className="row" style={{ gap: 6, fontWeight: 800, color: "#e8590c" }}><Flame size={22} fill={s.weeks ? "#ff922b" : "none"} /> {s.weeks}-week streak</span>
          <span className="row small muted" style={{ gap: 4 }}><Zap size={15} /> Level {lv.n} · {lv.name}</span>
        </div>
      </div>
      <div className="game-missions">
        {missions.map((m) => {
          const ok = done.includes(m.key);
          return (
            <div key={m.key} className={"game-mission stack-sm" + (ok ? " ok" : "")} data-testid={`mission-${m.key}`}>
              <div className="row-between"><span className="game-ico">{ok ? <Check size={16} /> : <Star size={16} />}</span><span className="chip chip-plain xs" style={{ fontWeight: 800 }}>+{m.xp} XP</span></div>
              <b>{m.title}</b>
              <span className="xs muted">{m.mins} min · {m.effect}</span>
              <button className={"btn btn-sm " + (ok ? "btn-ghost" : "btn-primary")} disabled={ok} onClick={() => go(m.link)}>{ok ? "Done" : <>Start <ArrowRight size={13} /></>}</button>
            </div>
          );
        })}
      </div>
      <div className="row-between" style={{ borderTop: "1px solid var(--line)", paddingTop: 12, flexWrap: "wrap", gap: 8 }}>
        <span className="small"><b>Real wins</b> <span className="muted">· badges only for things that matter</span></span>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {badges(w).map((b) => <span key={b.label} className={"chip xs row game-badge" + (b.done ? " on" : "")}>{b.done ? <Award size={12} /> : <Lock size={12} />}{b.label}</span>)}
        </div>
      </div>
    </section>
  );
}
