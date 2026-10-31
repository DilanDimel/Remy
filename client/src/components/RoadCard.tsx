import { Check } from "lucide-react";
import type { Workspace } from "@shared/types";
import { milestones } from "@shared/progress";
import { go } from "../lib/router";
import { careerTimeLabel } from "./CareerTime";

/** Home: the student's road to an offer, with the next milestone one tap away. */
export function RoadCard({ w }: { w: Workspace }) {
  const m = milestones(w);
  const done = m.filter((x) => x.done).length;
  const next = m.find((x) => !x.done);
  return (
    <section className="card card-pad stack-sm" aria-label="Road to an offer" data-testid="road-card">
      <div className="row-between">
        <div className="stack-sm" style={{ gap: 2 }}>
          <span className="eyebrow">Road to an offer</span>
          <strong data-testid="road-progress">{done === m.length ? "Every milestone done. Keep going!" : `${done} of ${m.length} milestones`}</strong>
          {(() => { const c = w.settings.careerTime; if (!c) return <button className="xs" style={{ textAlign: "left", color: "var(--fox)", fontWeight: 700, padding: 0 }} onClick={() => go("/accounts?tab=settings")}>Pick a weekly career time</button>;
            return <span className="xs muted">{new Date().getDay() === c.day ? `Today is your career time (${careerTimeLabel(c).split(" at ")[1]})` : `Your career time: ${careerTimeLabel(c)}`}</span>; })()}
        </div>
        {next && <button className="btn btn-secondary btn-sm" onClick={() => go(next.link)} data-testid="button-road-next">Next: {next.label}</button>}
      </div>
      <ol className="road">
        {m.map((x) => (
          <li key={x.label} className={x.done ? "on" : x === next ? "next" : ""}>
            <i>{x.done && <Check size={12} />}</i>
            <b>{x.label}</b>
            <span>{x.detail}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
