// Career quest (owners only while it's tested, Nov 19): the left-menu level + streak, and Home's weekly missions.
// Logic lives in shared/game.ts; this only shows it and keeps the week's record (starting counts, finished missions).
import { useEffect, useState } from "react";
import { ArrowRight, Award, Check, Flame, Lock, Snowflake, Star, Zap } from "lucide-react";
import type { Workspace } from "@shared/types";
import { CHECKIN_KINDS } from "@shared/checkin";
import { ALL_DONE_BONUS, WIN, winThisWeek, badges, counters, doneThisWeek, levelOf, missionsOf, streak, weekKey, weekMissions, xpOf, type GameState } from "@shared/game";
import { api, useStore } from "../lib/store";
import { count } from "../lib/signals";
import { go } from "../lib/router";

const stateOf = (w: Workspace): GameState => w.game || { weeks: {} };

/** Keeps this week's record: the counts at the start (first visit of the week) and missions as they finish. */
export function useGameRecord(w: Workspace | null | undefined, on: boolean) {
  const { save } = useStore();
  const key = weekKey();
  const g = w ? stateOf(w) : { weeks: {} };
  const now = w ? counters(w) : {};
  const done = w ? [...doneThisWeek(w, g, key, now), ...(winThisWeek(w, key) ? [WIN.key] : [])] : [];
  const lvl = w ? levelOf(xpOf(w, g), g.bestLevel).n : 1;
  const sig = JSON.stringify([key, done, !!g.weeks[key], lvl]);
  useEffect(() => {
    if (!on || !w) return;
    const week = g.weeks[key];
    // Counted for the owners' test (council, Nov 19): weeks played, missions finished, levels reached.
    if (!week) { count("quest:week"); save("game", { weeks: { ...trim(g.weeks), [key]: { base: now, done: [], missions: weekMissions(w, key).map((m) => m.key) } }, bestLevel: lvl }).catch(() => {}); return; }
    const fresh = done.filter((k) => !week.done.includes(k));
    if (fresh.length) { fresh.forEach((k) => count(`quest:done:${k}`)); save("game", { weeks: { ...g.weeks, [key]: { ...week, done } }, bestLevel: Math.max(lvl, g.bestLevel || 1) }).catch(() => {}); return; }
    if (lvl > (g.bestLevel || 1)) { count(`quest:level:${lvl}`); save("game", { weeks: g.weeks, bestLevel: lvl }).catch(() => {}); }
  }, [on, sig]);
}
// Two years of weeks at most (the server keeps 110).
const trim = (weeks: GameState["weeks"]) => Object.fromEntries(Object.entries(weeks).sort(([a], [b]) => b.localeCompare(a)).slice(0, 104));

export function GameSidebar({ w }: { w: Workspace }) {
  const g = stateOf(w), key = weekKey();
  const lv = levelOf(xpOf(w, g), g.bestLevel), s = streak(g, key);
  const pct = lv.max ? 100 : Math.max(0, Math.round((100 * (xpOf(w, g) - lv.floor)) / Math.max(1, lv.next - lv.floor)));
  return (
    <button onClick={() => go("/#missions")} className="game-side" data-testid="game-sidebar" title="Career quest (owners only while we test it)">
      <div className="row-between">
        <span className="row" style={{ gap: 6 }}><span className="game-lv">{lv.n}</span><b className="small">{lv.name}</b></span>
        <span className="row xs" style={{ gap: 3, color: "#e8590c", fontWeight: 800 }}><Flame size={15} fill={s.weeks ? "#ff922b" : "none"} /> {s.weeks} wk</span>
      </div>
      <div className="game-bar"><div style={{ width: `${pct}%` }} /></div>
      <div className="row-between xs muted"><span>{xpOf(w, g)}{lv.max ? "" : ` / ${lv.next}`} XP</span><span className="row" style={{ gap: 3 }}><Snowflake size={12} /> {s.freezeUsed ? "freeze holding" : "1 freeze"}</span></div>
    </button>
  );
}

export function MissionBoard({ w }: { w: Workspace }) {
  const g = stateOf(w), key = weekKey();
  const missions = missionsOf(w, g, key);
  const done = doneThisWeek(w, g, key, counters(w));
  const s = streak(g, key), lv = levelOf(xpOf(w, g), g.bestLevel);
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
      <LogWin w={w} weekKey={key} done={winThisWeek(w, key) || !!g.weeks[key]?.done.includes(WIN.key)} />
      <div className="row-between" style={{ borderTop: "1px solid var(--line)", paddingTop: 12, flexWrap: "wrap", gap: 8 }}>
        <span className="small"><b>Real wins</b> <span className="muted">· badges only for things that matter</span></span>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {badges(w).map((b) => <span key={b.label} className={"chip xs row game-badge" + (b.done ? " on" : "")}>{b.done ? <Award size={12} /> : <Lock size={12} />}{b.label}</span>)}
        </div>
      </div>
    </section>
  );
}

/** Bonus: one sentence about your week becomes a resume line you approve (council, Nov 19). Optional, so nobody types
 *  junk to save a streak; Remy uses only the student's words (server/checkin.ts checks the draft). */
function LogWin({ w, weekKey: key, done }: { w: Workspace; weekKey: string; done: boolean }) {
  const { run, setWs, save } = useStore();
  const [kind, setKind] = useState("");
  const [said, setSaid] = useState("");
  const [draft, setDraft] = useState<{ fact: string; bullet: string; linkedin: unknown } | null>(null);
  const [busy, setBusy] = useState(false);
  if (done) return <div className="game-win ok row small" data-testid="mission-win"><span className="game-ico"><Check size={16} /></span><b>Win logged this week</b><span className="muted">· +{WIN.xp} XP · the line is in your to-dos</span></div>;
  const make = async () => { setBusy(true); const r = await run(() => api<{ fact: string; bullet: string; linkedin: unknown }>("POST", "/api/ai/checkin", { kind, said })); setBusy(false); if (r) setDraft(r); };
  // The win is recorded in the game itself too, so the same sentence as an earlier week (no new fact) still counts.
  const keep = async () => {
    setBusy(true);
    const r = await run(() => api<Workspace>("POST", "/api/checkin", { kind, said, ...draft }), "The line is in your to-dos");
    if (r) {
      const week = (r.game?.weeks || {})[key] || { base: counters(r), done: [], missions: weekMissions(r, key).map((m) => m.key) };
      const saved = await run(() => save("game", { weeks: { [key]: { ...week, done: [...new Set([...week.done, WIN.key])] } } }));
      setWs(saved || r); setDraft(null);
    }
    setBusy(false);
  };
  return (
    <div className="game-win stack-sm" data-testid="mission-win">
      <div className="row-between"><span className="small"><b>Bonus · {WIN.title}</b> <span className="muted">· one sentence about your week becomes a resume line you approve</span></span><span className="chip chip-plain xs" style={{ fontWeight: 800 }}>+{WIN.xp} XP</span></div>
      {!draft ? (
        <>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{CHECKIN_KINDS.map((k) => <button key={k} className={"btn btn-sm " + (kind === k ? "btn-primary" : "btn-secondary")} onClick={() => setKind(k)}>{k}</button>)}</div>
          {kind && <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 220 }} value={said} maxLength={600} onChange={(e) => setSaid(e.target.value)} placeholder="e.g. Ran the tabling shift for my club's spring recruitment" data-testid="input-win" />
            <button className="btn btn-primary btn-sm" disabled={busy || said.trim().length < 8} onClick={make} data-testid="button-win-draft">Make it a resume line</button>
          </div>}
        </>
      ) : (
        <>
          {draft.bullet ? (
            <>
              <span className="small">“{draft.bullet}”</span>
              <span className="xs muted">Only your words. Change your sentence if something's off.</span>
              <div className="row" style={{ gap: 8 }}><button className="btn btn-primary btn-sm" disabled={busy} onClick={keep} data-testid="button-win-keep">Keep it</button><button className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Change my sentence</button></div>
            </>
          ) : (
            // No resume line from only their words: never show a sentence as if it were one (skeptic review).
            <>
              <span className="small">Remy couldn't make a resume line from only your words. Add a detail, like what you did, for whom, or how many.</span>
              <div className="row"><button className="btn btn-secondary btn-sm" onClick={() => setDraft(null)} data-testid="button-win-retry">Change my sentence</button></div>
            </>
          )}
        </>
      )}
    </div>
  );
}
