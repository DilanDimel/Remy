import { weekly } from "@shared/progress";
import { useStore } from "../lib/store";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** This week: active days against the student's own goal, points for real steps, and the streak in weeks. */
export function WeekCard() {
  const { ws, save } = useStore();
  const w = weekly(ws!);
  const s = ws!.settings;
  const dates = DAYS.map((_, i) => { const d = new Date(w.weekOf + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
  const met = w.days.length >= w.goal;
  return (
    <section className="card card-pad stack-sm" aria-label="This week" data-testid="week-card">
      <div className="row-between" style={{ alignItems: "flex-start" }}>
        <div className="stack-sm" style={{ gap: 2 }}>
          <span className="eyebrow">This week</span>
          <strong data-testid="week-progress">{met ? `Goal met: ${w.days.length} active days` : `${w.days.length} of ${w.goal} active days`}</strong>
          <span className="xs muted">{w.streak ? `${w.streak}-week streak` : "A day counts when you finish a real step: a to-do, a saved opening, an application or an email draft."}{!s.hidePoints && w.points ? ` · ${w.points} points` : ""}</span>
        </div>
        <label className="xs muted row" style={{ gap: 6 }}>Goal
          <select className="input" style={{ width: "auto", padding: "4px 8px" }} value={w.goal} onChange={(e) => save("settings", { weeklyGoal: Number(e.target.value) })} aria-label="Active days per week">
            {[2, 3, 4].map((n) => <option key={n} value={n}>{n} days</option>)}
          </select>
        </label>
      </div>
      <div className="week-dots" role="img" aria-label={`Active on ${w.days.length} day(s) this week`}>
        {DAYS.map((d, i) => <span key={d} className={"week-dot" + (w.days.includes(dates[i]) ? " on" : "")}><i />{d}</span>)}
      </div>
    </section>
  );
}
