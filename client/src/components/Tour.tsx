import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { featureAt } from "@shared/features";
import { useAccess } from "./ComingSoon";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { Workspace } from "@shared/types";
import { useOwnerView, useStore } from "../lib/store";
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
  /** The spot can be used (no cover), but the tour waits for Next. */
  live?: boolean;
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

// Owner view. Nov 23 review: job cards say Keep (not Save), Interview is a mock interview. Nov 23 PM review: the tour
// skipped Resume and Calendar but stopped on Opportunities three times, Details jumped ahead before it could be read,
// and it promised Remy's office walk-through without starting it. Now it ends in the office and starts the walk-through.
const PANEL = STEPS[9].spot;
const OWNER_STEPS: Step[] = [
  STEPS[0],
  { ...STEPS[1], text: "Five real steps to get you ready. They tick themselves off as you do them." },
  { ...STEPS[2], doIt: "[data-testid=button-keep]", text: "These are ranked for you, best fit first. Tap Keep on one you like." },
  { ...STEPS[3], doIt: undefined, live: true, text: "Tap Details to see why you qualify, what the posting asks for and anything you're missing. Press Next when you've read it." },
  { path: "/resume", spot: "[data-testid=button-walk-start], main h1", title: "Your resume, fixed with you", text: "I go through your resume one line at a time, say what's weak and suggest a fix. Nothing changes until you accept it." },
  { path: "/interview", spot: "[data-testid=button-start-mock]", title: "Practice the real interview", text: "I play the interviewer for your top opening and ask the questions its posting points to. Answer out loud, then see how you did." },
  { path: "/calendar", spot: "[data-testid=calendar-week], [data-testid=button-add-event]", title: "Every date in one place", text: "Deadlines, interviews and to-dos land here by themselves. Connect Google Calendar and they show up there too." },
  { ...STEPS[8], text: "Track where each one stands. Got an interview invite? Paste it under Email updates and I'll move it along and add it to your calendar." },
  { path: "/progress", spot: PANEL, title: "And I'm always here", text: "Ask me anything, or tell me to do it: \"fix my resume\", \"add a coffee chat Friday\", \"call me Dee\"." },
  { path: "/path", spot: "[data-testid=path-season]", title: "Your season", text: "Everything you do in Remy earns XP here, and every level adds something to my office. Come in, I'll show you around." },
];
/** The tour's last button on My Path: Remy's office walk-through takes over (PathBoard listens). */
export const PATH_WALK = "remy-path-walk";

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
const shown = (el: HTMLElement) => el.offsetParent !== null || getComputedStyle(el).position === "fixed";
const visible = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].find(shown);
/** Owners: "a, b" means a, else b (a fallback), not whichever comes first on the page. */
const firstOf = (sel: string) => { for (const one of sel.split(",")) { const el = visible(one); if (el) return el; } return undefined; };
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

const PAD = 8;
export function RemyTour() {
  const { ws, save } = useStore();
  const { path } = useRoute();
  const w = ws!;
  const owner = useOwnerView();
  const access = useAccess();
  // A locked or owners-only page (shared/features.ts) has nothing to show yet, so the tour skips it.
  const steps = (owner ? OWNER_STEPS : STEPS).filter((s) => { const f = featureAt(s.path); return !f || access(f.key) === "open"; });
  // Owners: the spot shows only once it has stopped moving, so it never flashes on the wrong thing while a page loads.
  const [settled, setSettled] = useState("");
  // The step lives here and moves right away; the server copy follows. So a slow or failed save can't freeze the
  // tour (or trap the student behind the shade), and another save's reply can't bounce it back a step.
  const [n, setN] = useState<number | "done" | undefined>(w.settings.tour);
  useEffect(() => { const start = () => setN(0); window.addEventListener(START, start); return () => window.removeEventListener(START, start); }, []);
  const active = setupDone(w) && typeof n === "number";
  const i = typeof n === "number" ? Math.min(n, steps.length - 1) : -1;
  const step = active && i >= 0 ? steps[i] : null;
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
  const next = () => {
    if (i + 1 >= steps.length && owner && step?.path === "/path") setTimeout(() => window.dispatchEvent(new Event(PATH_WALK)), 50);
    setStep(i + 1 >= steps.length ? "done" : i + 1);
  };

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
    let scrolled = false, frame = 0, lostAt = Date.now(), movedAt = Date.now(), last = "";
    const wait = setTimeout(() => setWaited(at), 700);
    const find = () => {
      const el = owner ? firstOf(step.spot) : visible(step.spot);
      if (!el) { if (Date.now() - lostAt > 5000) setMissing(true); return; } // gone 5 s in a row: explain it without the spotlight
      lostAt = Date.now();
      setMissing(false);
      if (!scrolled) { el.scrollIntoView({ block: "center" }); scrolled = true; }
      const b = el.getBoundingClientRect();
      const sig = `${b.top}|${b.left}|${b.width}|${b.height}`;
      if (sig !== last) { last = sig; movedAt = Date.now(); } else if (Date.now() - movedAt > 250) setSettled(at);
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
  const looking = path !== step.path || (!rect && !missing && waited !== at) || (owner && rect && !missing && settled !== at);
  if (looking) return <div className="tour" aria-hidden="true" onWheel={scrollUnder}><div className="tour-shade" style={{ inset: 0, background: shade }} /></div>;
  // The app is drawn at 85% on laptop-size screens (CSS zoom on .shell, which this sits inside): measured positions are
  // on-screen pixels, so they're divided by the zoom to land in the right place.
  const zoom = CSS.supports("zoom", "1") ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-zoom")) || 1 : 1;
  const vw = window.innerWidth / zoom, vh = window.innerHeight / zoom, phone = window.innerWidth < 700;
  // Owners: whole pixels, so the four dim panels meet without hairline gaps (Nov 23 PM review).
  const px = owner ? Math.round : (v: number) => v;
  const r = rect && !missing ? { top: px(rect.top / zoom - PAD), left: px(rect.left / zoom - PAD), width: px(rect.width / zoom + PAD * 2), height: px(rect.height / zoom + PAD * 2) } : null;
  // The bubble sits under the spot, or above it when there's no room; on phones it's a sheet at the bottom, or at the
  // top when the spot is in the lower half (the fox button on the last step).
  const bw = Math.min(380, vw - 24);
  const below = r ? r.top + r.height + 14 : 0;
  const pos: React.CSSProperties = phone
    ? (r && r.top + r.height / 2 > vh / 2 ? { left: 12, right: 12, top: 12 } : { left: 12, right: 12, bottom: 12 })
    : owner && r && r.height > vh * 0.5 && r.left > bw + 36 ? { width: bw, left: r.left - bw - 16, top: Math.max(12, Math.min(r.top + 40, vh - bubbleH - 12)) }
    : !r ? { left: Math.max(12, (vw - bw) / 2), top: Math.max(12, (vh - bubbleH) / 2), width: bw }
    : { width: bw, left: Math.max(12, Math.min(r.left, vw - bw - 12)), top: below + bubbleH < vh - 12 ? below : Math.max(12, r.top - bubbleH - 14) };
  const text = missing && step.doIt ? step.text.replace(/(^| )Tap .*$/, "$1Once you have openings, you can do this right from here.") : step.text;
  return (
    <div className="tour" role="dialog" aria-label={`Remy's tour, step ${i + 1} of ${steps.length}: ${step.title}`} data-testid="remy-tour" onWheel={scrollUnder}>
      {/* Four panels dim everything around the spot. On explainer steps a clear cover keeps the spot from being clicked
          (so "Tailor resume" isn't started by accident); on do-it steps the spot is live. */}
      {r ? (
        <>
          <div className="tour-shade" style={{ top: 0, left: 0, right: 0, height: Math.max(0, r.top), background: shade }} />
          <div className="tour-shade" style={{ top: r.top + r.height, left: 0, right: 0, bottom: 0, background: shade }} />
          <div className="tour-shade" style={{ top: r.top, left: 0, width: Math.max(0, r.left), height: r.height, background: shade }} />
          <div className="tour-shade" style={{ top: r.top, left: r.left + r.width, right: 0, height: r.height, background: shade }} />
          {!step.doIt && !step.live && <div className="tour-shade" style={{ top: r.top, left: r.left, width: r.width, height: r.height }} />}
          <div key={at} className="tour-spot" style={{ top: r.top, left: r.left, width: r.width, height: r.height }} />
        </>
      ) : <div className="tour-shade" style={{ inset: 0, background: shade }} />}
      <div key={at} ref={bubble} className="tour-bubble" style={pos} data-testid="tour-bubble">
        <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
          <Remy size={38} mood="wave" />
          <div className="stack-sm" style={{ flex: 1, gap: 4 }}>
            <div className="row-between"><b>{step.title}</b><span className="xs muted">{i + 1} of {steps.length}</span></div>
            <p className="small" style={{ margin: 0 }} aria-live="polite">{text}</p>
          </div>
        </div>
        <div className="tour-dots" aria-hidden="true">{steps.map((_, k) => <i key={k} className={k < i ? "done" : k === i ? "on" : ""} />)}</div>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep("done")} data-testid="tour-end"><X size={14} /> End tour</button>
          <span style={{ flex: 1 }} />
          {i > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setStep(i - 1)} data-testid="tour-back"><ArrowLeft size={14} /> Back</button>}
          {step.doIt && !missing
            ? <button ref={main} className="btn btn-secondary btn-sm" onClick={next} data-testid="tour-skip">Skip this</button>
            : <button ref={main} className="btn btn-primary btn-sm" onClick={next} data-testid="tour-next">{i + 1 === steps.length ? "Let's go" : <>Next <ArrowRight size={14} /></>}</button>}
        </div>
      </div>
    </div>
  );
}

/** The shade catches clicks, but the wheel goes on to the page under it (Dilan, Nov 27: scrolling froze the tour):
 *  the nearest scrollable box under the pointer scrolls, whether it's the page or a panel like an opening's details. */
function scrollUnder(e: { clientX: number; clientY: number; deltaX: number; deltaY: number }) {
  const under = document.elementsFromPoint(e.clientX, e.clientY).find((n) => !n.closest(".tour"));
  for (let n = under as HTMLElement | null; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) { n.scrollBy({ top: e.deltaY, left: e.deltaX }); return; }
  }
  (document.scrollingElement || document.documentElement).scrollBy({ top: e.deltaY, left: e.deltaX });
}
