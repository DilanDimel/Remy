import { CalendarClock } from "lucide-react";
import type { Workspace } from "@shared/types";
import { SEASON_SOURCE, seasonFor } from "@shared/seasons";
import { go } from "../lib/router";
import { useOwnerView } from "../lib/store";

/** When the student's field usually recruits interns, so they know whether to apply now or prepare. */
export function SeasonCard({ w }: { w: Workspace }) {
  const owner = useOwnerView();
  // Internship seasons are a college thing; trade, apprenticeship, high school, working and military paths don't have one.
  // The field is the student's target roles when they named some ("Welding Technology Certificate" isn't tech).
  if (["trade", "apprenticeship", "high-school", "working", "military"].includes(w.profile.path || "")) return null;
  if (/certificate|apprentic|weld|hvac|plumb|electrician|cosmetolog|lineworker|cdl\b/i.test(`${w.profile.major} ${w.profile.targetRoles}`)) return null;
  const s = seasonFor(w.profile.targetRoles) || seasonFor([w.profile.major, w.profile.interests].join(" "));
  if (!s) return null;
  if (owner) return (
    // Owners: a dark band with the countdown up front.
    <section className="season-band" data-testid="season-card">
      <span className="season-cd"><b>{s.open ? "Now" : `~${s.monthsUntil}`}</b>{s.open ? "open" : s.monthsUntil === 1 ? "month" : "months"}</span>
      <span className="grow"><b>{s.open ? `${s.label} internship season is on now` : `${s.label} internship season opens in ${s.opens}`}</b><small>Usually {s.window}. {s.note} <a href={SEASON_SOURCE} target="_blank" rel="noreferrer">Source</a></small></span>
      <button className="btn btn-sm" onClick={() => go(s.open ? "/opportunities" : "/resume?tab=base")}>{s.open ? "See openings" : "Get ready"}</button>
    </section>
  );
  return (
    <section className="card card-pad row season-card" style={{ gap: 12, alignItems: "flex-start" }} data-testid="season-card">
      <CalendarClock size={20} style={{ color: "var(--fox)", flexShrink: 0, marginTop: 2 }} />
      <div className="stack-sm grow" style={{ gap: 4 }}>
        <b className="small">{s.open ? `${s.label} internship season is on now` : `${s.label} internship season usually opens in ${s.opens}${s.monthsUntil === 1 ? ", next month" : ` (in about ${s.monthsUntil} months)`}`}</b>
        <span className="small muted">Usually {s.window}. {s.note} <a href={SEASON_SOURCE} target="_blank" rel="noreferrer" className="xs">Source</a></span>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={() => go(s.open ? "/opportunities" : "/resume?tab=base")}>{s.open ? "See openings" : "Get ready"}</button>
    </section>
  );
}
