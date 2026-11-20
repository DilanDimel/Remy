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
const START = "remy-tour-start";
/** "Show me around again": the tutorial starts over from the first step. */
export const tourAgain = (save: ReturnType<typeof useStore>["save"]) => {
  window.dispatchEvent(new Event(START));
  go("/");
  return save("settings", { tour: 0 }).catch(() => {});
};

/** The first match that's actually on screen ("a, b, c": on phones the hidden desktop button comes before the fox). */
const visible = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].find((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed");
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

const PAD = 8;
export function RemyTour() {
  const { ws, save } = useStore();
  const { path } = useRoute();
  const w = ws!;
  // The step lives here and moves right away; the server copy follows. So a slow or failed save can't freeze the
  // tour (or trap the student behind the shade), and another save's reply can't bounce it back a step.
  const [n, setN] = useState<number | "done" | undefined>(w.settings.tour);
  useEffect(() => { const start = () => setN(0); window.addEventListener(START, start); return () => window.removeEventListener(START, start); }, []);
  const active = setupDone(w) && typeof n === "number";
  const i = typeof n === "number" ? Math.min(n, STEPS.length - 1) : -1;
  const step = active && i >= 0 ? STEPS[i] : null;
  // The spot is measured per step and page ("at"), so a new page never shows the last page's spot for a frame.
  const [found, setFound] = useState<{ at: string; b: DOMRect } | null>(null);
  const [missing, setMissing] = useState(false);
  const [waited, setWaited] = useState(""); // the bubble waits briefly for its spot instead of appearing mid-screen and jumping
  const at = `${i}|${path}`;
  const rect = found?.at === at ? found.b : null;
  const bubble = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLButtonElement>(null);
  const [bubbleH, setBubbleH] = useState(180);
  const lastStep = useRef(-1); // a new step means the tour moves pages; the same step on another page means the student left

  const setStep = (to: number | "done") => { setN(to); save("settings", { tour: to }).catch(() => {}); };
  const next = () => setStep(i + 1 >= STEPS.length ? "done" : i + 1);

  // Go to the step's page. If the student leaves it themselves (a nav link, a button, Remy's chat), the tour ends
  // instead of pulling them back.
  useEffect(() => {
    if (!step) return;
    const stepChanged = lastStep.current !== i;
    lastStep.current = i;
    if (path !== step.path) {
      if (stepChanged) go(step.path);
      else setStep("done");
      return;
    }
    setMissing(false);
    let scrolled = false, frame = 0, lostAt = Date.now();
    const wait = setTimeout(() => setWaited(at), 700);
    const find = () => {
      const el = visible(step.spot);
      if (!el) { if (Date.now() - lostAt > 5000) setMissing(true); return; } // gone 5 s in a row: explain it without the spotlight
      lostAt = Date.now();
      setMissing(false);
      if (!scrolled) { el.scrollIntoView({ block: "center" }); scrolled = true; }
      const b = el.getBoundingClientRect();
      setFound((old) => (old && old.at === at && old.b.top === b.top && old.b.left === b.left && old.b.width === b.width && old.b.height === b.height ? old : { at, b }));
    };
    // Every frame, so the spot moves with the page (its slide-in, scrolling, loading) instead of catching up in jumps.
    // State only changes when the spot actually moved.
    const loop = () => { find(); frame = requestAnimationFrame(loop); };
    loop();
    return () => { cancelAnimationFrame(frame); clearTimeout(wait); };
  }, [i, path, active]);

  // A "do it" step moves on when the student does the real thing (listening on the page, so a redrawn button still counts).
  useEffect(() => {
    if (!step?.doIt) return;
    const onClick = (e: MouseEvent) => {
      const hit = (e.target as Element | null)?.closest?.(step.doIt!);
      const area = document.querySelector(step.spot);
      if (hit && (!area || area.contains(hit))) setTimeout(next, 450);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [i, active]);

  useLayoutEffect(() => { if (bubble.current) setBubbleH(bubble.current.offsetHeight); });
  // Keyboard: the bubble's main button gets focus on each step; Escape ends the tour (not while typing in a form).
  // (once the bubble is up: it waits for its spot)
  useEffect(() => { if (step && path === step.path) main.current?.focus({ preventScroll: true }); }, [i, path, !!step, !!rect, waited, missing]);
  useEffect(() => {
    if (!step) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !typing(e.target)) setStep("done"); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [!!step]);

  if (!step) return null;
  const shade = "rgba(12, 10, 8, 0.6)";
  // Moving to the step's page (or still looking for the spot): the page stays dimmed, so it doesn't flash bright between steps.
  const looking = path !== step.path || (!rect && !missing && waited !== at);
  if (looking) return <div className="tour" aria-hidden="true"><div className="tour-shade" style={{ inset: 0, background: shade }} /></div>;
  // The app is drawn at 85% on laptop-size screens (CSS zoom on .shell, which this sits inside): measured positions are
  // on-screen pixels, so they're divided by the zoom to land in the right place.
  const zoom = CSS.supports("zoom", "1") ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-zoom")) || 1 : 1;
  const vw = window.innerWidth / zoom, vh = window.innerHeight / zoom, phone = window.innerWidth < 700;
  const r = rect && !missing ? { top: rect.top / zoom - PAD, left: rect.left / zoom - PAD, width: rect.width / zoom + PAD * 2, height: rect.height / zoom + PAD * 2 } : null;
  // The bubble sits under the spot, or above it when there's no room; on phones it's a sheet at the bottom, or at the
  // top when the spot is in the lower half (the fox button on the last step).
  const bw = Math.min(380, vw - 24);
  const below = r ? r.top + r.height + 14 : 0;
  const pos: React.CSSProperties = phone
    ? (r && r.top + r.height / 2 > vh / 2 ? { left: 12, right: 12, top: 12 } : { left: 12, right: 12, bottom: 12 })
    : !r ? { left: Math.max(12, (vw - bw) / 2), top: Math.max(12, (vh - bubbleH) / 2), width: bw }
    : { width: bw, left: Math.max(12, Math.min(r.left, vw - bw - 12)), top: below + bubbleH < vh - 12 ? below : Math.max(12, r.top - bubbleH - 14) };
  const text = missing && step.doIt ? step.text.replace(/(^| )Tap .*$/, "$1Once you have openings, you can do this right from here.") : step.text;
  return (
    <div className="tour" role="dialog" aria-label={`Remy's tour, step ${i + 1} of ${STEPS.length}: ${step.title}`} data-testid="remy-tour">
      {/* Four panels dim everything around the spot. On explainer steps a clear cover keeps the spot from being clicked
          (so "Tailor resume" isn't started by accident); on do-it steps the spot is live. */}
      {r ? (
        <>
          <div className="tour-shade" style={{ top: 0, left: 0, right: 0, height: Math.max(0, r.top), background: shade }} />
          <div className="tour-shade" style={{ top: r.top + r.height, left: 0, right: 0, bottom: 0, background: shade }} />
          <div className="tour-shade" style={{ top: r.top, left: 0, width: Math.max(0, r.left), height: r.height, background: shade }} />
          <div className="tour-shade" style={{ top: r.top, left: r.left + r.width, right: 0, height: r.height, background: shade }} />
          {!step.doIt && <div className="tour-shade" style={{ top: r.top, left: r.left, width: r.width, height: r.height }} />}
          <div key={at} className="tour-spot" style={{ top: r.top, left: r.left, width: r.width, height: r.height }} />
        </>
      ) : <div className="tour-shade" style={{ inset: 0, background: shade }} />}
      <div key={at} ref={bubble} className="tour-bubble" style={pos} data-testid="tour-bubble">
        <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <Remy size={38} mood="wave" />
          <div className="stack-sm" style={{ flex: 1, gap: 4 }}>
            <div className="row-between"><b>{step.title}</b><span className="xs muted">{i + 1} of {STEPS.length}</span></div>
            <p className="small" style={{ margin: 0 }} aria-live="polite">{text}</p>
          </div>
        </div>
        <div className="tour-dots" aria-hidden="true">{STEPS.map((_, k) => <i key={k} className={k < i ? "done" : k === i ? "on" : ""} />)}</div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep("done")} data-testid="tour-end"><X size={14} /> End tour</button>
          <span style={{ flex: 1 }} />
          {i > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setStep(i - 1)} data-testid="tour-back"><ArrowLeft size={14} /> Back</button>}
          {step.doIt && !missing
            ? <button ref={main} className="btn btn-secondary btn-sm" onClick={next} data-testid="tour-skip">Skip this</button>
            : <button ref={main} className="btn btn-primary btn-sm" onClick={next} data-testid="tour-next">{i + 1 === STEPS.length ? "Let's go" : <>Next <ArrowRight size={14} /></>}</button>}
        </div>
      </div>
    </div>
  );
}
