import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { go } from "../lib/router";
import { milestones } from "@shared/progress";
import { Remy } from "./common";

const SAY: Record<string, string> = {
  "Resume ready": "Your resume is confirmed. Every tailored version starts from it now.",
  "Openings picked": "Three openings saved. That's a real shortlist.",
  "First application": "Your first application is out. That's the hardest one.",
  "Reached out": "You reached out to someone. Most students never do.",
  "Interview stories": "Two true interview stories, ready when you need them.",
  Interviewing: "You've got an interview. That's what all the work was for.",
};

/** A short, happy moment when a milestone is reached (never on page load, only when it happens). */
export function Celebrate() {
  const { ws } = useStore();
  const prev = useRef<Set<string> | null>(null);
  const [now, setNow] = useState<{ label: string; done: number } | null>(null);
  useEffect(() => {
    if (!ws) return;
    const m = milestones(ws);
    const done = new Set(m.filter((x) => x.done).map((x) => x.label));
    const fresh = prev.current && [...done].find((l) => !prev.current!.has(l));
    prev.current = done;
    if (fresh) setNow({ label: fresh, done: done.size });
  }, [ws]);
  useEffect(() => { if (!now) return; const t = setTimeout(() => setNow(null), 7000); return () => clearTimeout(t); }, [now]);
  if (!now) return null;
  return (
    <div className="celebrate" role="status" aria-live="polite" data-testid="celebrate">
      <div className="burst" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ ["--a" as any]: `${i * 30}deg` }} />)}</div>
      <Remy size={40} mood="happy" outfit="gown" />
      <div className="stack-sm" style={{ gap: 2 }}>
        <b>Milestone: {now.label}</b>
        <span className="small muted">{SAY[now.label]} {now.done} of 6 on your road to an offer.</span>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => { setNow(null); go("/"); }}>See road</button>
    </div>
  );
}
