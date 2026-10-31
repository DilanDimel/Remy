import { Check } from "lucide-react";
import type { Workspace } from "@shared/types";
import { go } from "../lib/router";

// Milestones a recruiter would recognize, each read from what the student actually did. No points or streaks.
export function milestones(w: Workspace) {
  const applied = w.tracker.filter((t) => !["Saved", "Withdrawn"].includes(t.status)).length;
  const stories = (w.stories || []).length;
  const interviewing = w.tracker.some((t) => t.status === "Interview" || t.status === "Offer") || w.calendar.some((c) => c.kind === "Interview");
  return [
    { label: "Resume ready", done: !!w.resume?.confirmedAt, detail: w.resume?.confirmedAt ? "Confirmed" : w.resume ? "Check and confirm it" : "Upload or build one", link: "/resume?tab=base" },
    { label: "Openings picked", done: w.savedJobIds.length >= 3, detail: `${w.savedJobIds.length} of 3 saved`, link: "/opportunities" },
    { label: "First application", done: applied > 0, detail: applied ? `${applied} sent` : "Tailor and apply to one", link: "/opportunities" },
    { label: "Reached out", done: w.outreach.length > 0, detail: w.outreach.length ? `${w.outreach.length} message${w.outreach.length > 1 ? "s" : ""} drafted` : "Message one person", link: "/community" },
    { label: "Interview stories", done: stories >= 2, detail: `${Math.min(stories, 2)} of 2 ready`, link: "/resume?tab=base" },
    { label: "Interviewing", done: interviewing, detail: interviewing ? "You're in" : "Comes from the steps above", link: "/progress" },
  ];
}

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
