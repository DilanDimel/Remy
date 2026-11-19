import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { Workspace } from "@shared/types";
import { useStore } from "../lib/store";
import { go, useRoute } from "../lib/router";
import { Remy } from "./common";

// Remy's tutorial (Dilan, Nov 19: "it should be a tutorial where Remy leads you through the entire website" — the
// one-time page cards and the small first-win box "did nothing"). Like a game tutorial: Remy moves through the site,
// dims everything but one spot, says what it's for, and where there's something real to do (save an opening, open
// Details) the tutorial moves on when the student does it. Explainer steps have Next. End anytime; replay from the menu.

type Step = {
  path: string;
  /** What's lit up (the first match). */
  spot: string;
  title: string;
  text: string;
  /** Inside the lit-up area: tapping this does the real thing and moves the tutorial on. */
  doIt?: string;
};
const STEPS: Step[] = [
  { path: "/", spot: "[data-testid=button-next-action]", title: "Your next step", text: "Every time you come back, I put the one thing worth doing right here. Everything else can wait." },
  { path: "/", spot: "[data-testid=getting-started]", title: "Getting started", text: "Five real steps to get you ready. They tick themselves off as you do them. Let's do a couple together now." },
  { path: "/opportunities", spot: "[data-testid=card-job]", doIt: "[data-testid=button-save-job]", title: "Openings you can apply to", text: "These are ranked for you, best fit first. Tap Save on one you like." },
  { path: "/opportunities", spot: "[data-testid=card-job]", doIt: "[data-testid=button-job-details]", title: "Why it fits you", text: "Tap Details to see why you qualify, what the posting asks for, and anything you're missing." },
  { path: "/opportunities", spot: "[data-testid=button-tailor-job]", title: "Apply with a tailored resume", text: "When you're ready, Tailor resume writes a version for this posting and a cover letter. Every change shows why, and you approve each one." },
  { path: "/interview", spot: "[data-testid=story-deck]", title: "Interview practice", text: "Interviewers ask \"Tell me about a time when…\". I ask a few short questions and turn your resume into stories you can practice out loud." },
  { path: "/path", spot: "[role=tablist]", title: "Not sure what you want?", text: "My Path suggests directions from your resume, shows the road for your field, and how jobs are changing." },
  { path: "/community", spot: "[data-testid=button-add-contact]", title: "People you know", text: "Met someone at a career fair or in class? Add them here. I'll remind you to say thanks and help you write to them." },
  { path: "/progress", spot: "[role=tablist]", title: "Every application in one place", text: "Track where each one stands. Got an interview invite? Paste it under Email updates and it goes on your calendar." },
  { path: "/", spot: "[data-testid=assistant-panel], [data-testid=button-fab-assistant], [data-testid=button-open-assistant]", title: "And I'm always here", text: "Ask me anything: about an opening, your resume, or what to do next. That's the tour. Let's get you that first offer." },
];

const setupDone = (w: Workspace) => w.onboarding.done;
/** Only for students who finish setup from now on, or who press "Show me around again" (both set a step number). */
export const tourOn = (w: Workspace) => setupDone(w) && typeof w.settings.tour === "number";
/** "Show me around again": the tutorial starts over from the first step. */
export const tourAgain = (save: ReturnType<typeof useStore>["save"]) => { go("/"); return save("settings", { tour: 0 }).catch(() => {}); };

const PAD = 8;
export function RemyTour() {
  const { ws, save } = useStore();
  const { path } = useRoute();
  const w = ws!;
  const n = typeof w.settings.tour === "number" ? Math.min(w.settings.tour, STEPS.length - 1) : -1;
  const step = n >= 0 ? STEPS[n] : null;
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [missing, setMissing] = useState(false);
  const bubble = useRef<HTMLDivElement>(null);
  const [bubbleH, setBubbleH] = useState(180);

  const setStep = (to: number | "done") => save("settings", { tour: to }).catch(() => {});
  const next = () => setStep(n + 1 >= STEPS.length ? "done" : n + 1);

  // Go to the step's page, then find what it lights up (pages load their data first, so look for a few seconds).
  useEffect(() => {
    if (!step) return;
    if (path !== step.path) { go(step.path); return; }
    setRect(null); setMissing(false);
    let tries = 0, scrolled = false;
    const find = () => {
      const el = document.querySelector<HTMLElement>(step.spot);
      if (el && el.offsetParent !== null) {
        if (!scrolled) { el.scrollIntoView({ block: "center" }); scrolled = true; }
        setRect(el.getBoundingClientRect());
        return;
      }
      if (++tries > 25) setMissing(true); // ~5 s: explain it without the spotlight (e.g. no openings yet)
    };
    find();
    const t = setInterval(find, 200); // keeps following the spot as the page settles, scrolls or resizes
    return () => clearInterval(t);
  }, [n, path]);

  // A "do it" step moves on when the student does the real thing. Listening on the whole page (and checking where the
  // tap landed) keeps working when the page redraws the button or the step starts before the page has loaded.
  useEffect(() => {
    if (!step?.doIt) return;
    const onClick = (e: MouseEvent) => {
      const hit = (e.target as Element | null)?.closest?.(step.doIt!);
      const area = document.querySelector(step.spot);
      if (hit && (!area || area.contains(hit))) setTimeout(next, 450);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [n]);

  useLayoutEffect(() => { if (bubble.current) setBubbleH(bubble.current.offsetHeight); });
  useEffect(() => {
    if (!step) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setStep("done"); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [!!step]);

  if (!tourOn(w) || !step || path !== step.path) return null;
  // The app is drawn at 85% on laptop-size screens (CSS zoom on .shell, which this sits inside): measured positions are
  // on-screen pixels, so they're divided by the zoom to land in the right place.
  const zoom = CSS.supports("zoom", "1") ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-zoom")) || 1 : 1;
  const vw = window.innerWidth / zoom, vh = window.innerHeight / zoom, phone = window.innerWidth < 700;
  const r = rect && !missing ? { top: rect.top / zoom - PAD, left: rect.left / zoom - PAD, width: rect.width / zoom + PAD * 2, height: rect.height / zoom + PAD * 2 } : null;
  // The bubble sits under the spot, or above it when there's no room; on phones it's a sheet at the bottom.
  const bw = Math.min(380, vw - 24);
  const below = r ? r.top + r.height + 14 : 0;
  const pos: React.CSSProperties = phone || !r
    ? (phone ? { left: 12, right: 12, bottom: 12 } : { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: bw })
    : { width: bw, left: Math.max(12, Math.min(r.left, vw - bw - 12)), top: below + bubbleH < vh - 12 ? below : Math.max(12, r.top - bubbleH - 14) };
  const shade = "rgba(12, 10, 8, 0.6)";
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label={`Remy's tour, step ${n + 1} of ${STEPS.length}: ${step.title}`} data-testid="remy-tour">
      {/* Four panels dim everything around the spot; the spot itself stays clickable. */}
      {r ? (
        <>
          <div className="tour-shade" style={{ top: 0, left: 0, right: 0, height: Math.max(0, r.top), background: shade }} />
          <div className="tour-shade" style={{ top: r.top + r.height, left: 0, right: 0, bottom: 0, background: shade }} />
          <div className="tour-shade" style={{ top: r.top, left: 0, width: Math.max(0, r.left), height: r.height, background: shade }} />
          <div className="tour-shade" style={{ top: r.top, left: r.left + r.width, right: 0, height: r.height, background: shade }} />
          <div className="tour-spot" style={{ top: r.top, left: r.left, width: r.width, height: r.height }} />
        </>
      ) : <div className="tour-shade" style={{ inset: 0, background: shade }} />}
      <div ref={bubble} className="tour-bubble fade-up" style={pos} data-testid="tour-bubble">
        <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <Remy size={38} mood="wave" />
          <div className="stack-sm" style={{ flex: 1, gap: 4 }}>
            <div className="row-between"><b>{step.title}</b><span className="xs muted">{n + 1} of {STEPS.length}</span></div>
            <p className="small" style={{ margin: 0 }}>{missing && step.doIt ? step.text.replace(/ Tap .*$/, " Once you have openings, you can save them from here.") : step.text}</p>
          </div>
        </div>
        <div className="tour-dots" aria-hidden="true">{STEPS.map((_, i) => <i key={i} className={i < n ? "done" : i === n ? "on" : ""} />)}</div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep("done")} data-testid="tour-end"><X size={14} /> End tour</button>
          <span style={{ flex: 1 }} />
          {n > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setStep(n - 1)} data-testid="tour-back"><ArrowLeft size={14} /> Back</button>}
          {step.doIt && !missing
            ? <button className="btn btn-secondary btn-sm" onClick={next} data-testid="tour-skip">Skip this</button>
            : <button className="btn btn-primary btn-sm" onClick={next} data-testid="tour-next">{n + 1 === STEPS.length ? "Let's go" : <>Next <ArrowRight size={14} /></>}</button>}
        </div>
      </div>
    </div>
  );
}
