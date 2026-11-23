import { useEffect, useRef, useState } from "react";
import { useOwnerView, useStore } from "../lib/store";
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
  const [now, setNow] = useState<{ label: string; done: number; moment?: "offer" | "rejected"; company?: string } | null>(null);
  // Owners ("Remy feels alive" #4): an offer gets its own party, and a rejection gets Remy at your side, not confetti.
  const owner = useOwnerView();
  const seenTrack = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!ws || !owner) return;
    const was = seenTrack.current;
    seenTrack.current = new Map(ws.tracker.map((t) => [t.id, t.status]));
    if (!was) return;
    const t = ws.tracker.find((x) => (x.status === "Offer" || x.status === "Rejected") && was.get(x.id) !== x.status);
    if (t) setNow({ label: t.status, done: 0, moment: t.status === "Offer" ? "offer" : "rejected", company: t.company });
  }, [ws?.tracker, owner]);
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
  if (now.moment === "rejected") return (
    <div className="celebrate" role="status" aria-live="polite" data-testid="comfort">
      <Remy size={40} mood="think" />
      <div className="stack-sm" style={{ gap: 2 }}>
        <b>That one stings. I'm sorry.</b>
        <span className="small muted">{now.company} said no this time. It says nothing about the next one. Want me to find two more like it?</span>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => { setNow(null); go("/opportunities"); }} data-testid="button-comfort-more">Find more</button>
    </div>
  );
  if (now.moment === "offer") return (
    <div className="celebrate" role="status" aria-live="polite" data-testid="celebrate-offer">
      <div className="burst" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ ["--a" as any]: `${i * 30}deg` }} />)}</div>
      <Remy size={40} mood="happy" outfit="gown" />
      <div className="stack-sm" style={{ gap: 2 }}>
        <b>An offer from {now.company}!</b>
        <span className="small muted">You did this. Take a breath, then ask me anything about the offer before you answer them.</span>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => setNow(null)} data-testid="button-offer-close">Thanks, Remy</button>
    </div>
  );
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
