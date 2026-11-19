import { ArrowRight, X } from "lucide-react";
import type { Workspace } from "@shared/types";
import { gettingStarted } from "@shared/progress";
import { useStore } from "../lib/store";
import { go } from "../lib/router";
import { useJobs } from "../lib/jobs";
import { Remy } from "./common";

// Remy leads (audit section 5, Dilan: "do what's best", Nov 19): right after setup a 3-step first win in Remy's panel,
// then one sentence + one thing to press the first time each page opens. Seen once; "Show me around again" restarts.

/** The one button to press glows for a few seconds and scrolls into view. */
export function highlight(selector: string) {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return false;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("tour-ring");
  setTimeout(() => el.classList.remove("tour-ring"), 4500);
  return true;
}

const setupDone = (w: Workspace) => w.onboarding.done;
/** The first win is offered once, after setup, and not to students already past the first steps. */
export const firstWinPending = (w: Workspace) =>
  setupDone(w) && w.settings.firstWin !== "done"
  && (typeof w.settings.firstWin === "number" || gettingStarted(w).filter((x) => x.done).length < 3); // a number = started or "show me around again"

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const time12 = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`; };

/** "Your first win": three short steps right after setup, each one real thing on the student's own data. */
export function FirstWin({ where }: { where: "panel" | "home" }) {
  const { ws, save } = useStore();
  const { jobs, fits } = useJobs();
  const w = ws!;
  if (!firstWinPending(w)) return null;
  const stepNo = typeof w.settings.firstWin === "number" ? w.settings.firstWin : 0;
  const best = (jobs || [])
    .filter((j) => { const f = fits[j.id]; return !!f && !f.excluded && !f.closed && f.regionMatch !== false && f.eligibility !== "unlikely" && j.kind !== "event" && !w.hiddenJobIds.includes(j.id); })
    .sort((a, b) => (fits[b.id]?.score || 0) - (fits[a.id]?.score || 0))[0];
  const ct = w.settings.careerTime;
  const steps = [
    best
      ? { text: <>Your best opening right now: <b>{best.title}</b> at <b>{best.company}</b>. {fits[best.id]?.why}</>, cta: "Show me this opening", link: `/opportunities?id=${best.id}` }
      : { text: <>I'm still finding openings that fit you. They'll show up on Opportunities as I check employers' sites.</>, cta: "See openings", link: "/opportunities" },
    w.resume?.confirmedAt
      ? { text: <>Next, the one place on your resume I'd make stronger first. Everything I write for you is built from it.</>, cta: "Show me", link: "/resume?tab=base&checks=1" }
      : { text: <>Next, check that I read your resume right. Everything I write for you is built only from what you confirm.</>, cta: "Check my resume", link: "/resume?tab=base" },
    { text: <>I check employers' sites every day and put what's new on Home. {ct ? <>See you <b>{DAYS[ct.day]} at {time12(ct.time)}</b>, your weekly career time.</> : <>Pick a weekly time for career work and I'll remind you.</>}</>, cta: ct ? "Done" : "Pick my weekly time", link: ct ? "" : "/calendar" },
  ];
  const step = steps[Math.min(stepNo, 2)];
  const advance = async () => {
    const next = stepNo >= 2 ? "done" : stepNo + 1;
    await save("settings", { firstWin: next }).catch(() => {});
    if (step.link) go(step.link);
  };
  const skip = () => save("settings", { firstWin: "done" }).catch(() => {});
  const dots = (
    <span className="row" style={{ gap: 4 }} aria-label={`Step ${stepNo + 1} of 3`}>
      {[0, 1, 2].map((i) => <i key={i} style={{ width: 20, height: 5, borderRadius: 3, background: i < stepNo ? "#2f8a5b" : i === stepNo ? "var(--fox)" : "var(--line, #e6e2dd)" }} />)}
    </span>
  );
  const buttons = (
    <div className="row" style={{ gap: 6, flexWrap: "wrap", width: "100%" }}>
      <button className="btn btn-primary btn-sm" onClick={advance} data-testid="button-first-win">{step.cta} {step.link && <ArrowRight size={14} />}</button>
      {stepNo === 2 && !ct && <button className="btn btn-ghost btn-sm" onClick={skip}>Not now</button>}
      <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={skip} data-testid="button-first-win-skip">Skip, I'll look around</button>
    </div>
  );
  // In Remy's panel it takes the welcome's place (centered, no empty space above); on Home it's a card.
  if (where === "panel") return (
    <div className="asst-welcome first-win" data-testid="first-win-panel">
      <Remy size={56} mood="wave" />
      <b>Your first win</b>
      {dots}
      <div className="bubble bubble-ai" style={{ maxWidth: "100%", textAlign: "left" }}>{step.text}</div>
      {buttons}
    </div>
  );
  return (
    <div className="intro-card" style={{ alignItems: "flex-start" }} data-testid="first-win-home">
      <Remy size={30} />
      <div className="stack-sm" style={{ flex: 1, gap: 8 }}>
        <div className="row-between"><b>Your first win</b>{dots}</div>
        <div className="small">{step.text}</div>
        {buttons}
      </div>
    </div>
  );
}

// One sentence and one thing to press, the first time each page opens. Selectors point at that page's main button.
const INTROS: Record<string, { text: string; target?: string }> = {
  "/opportunities": { text: "These are openings you can actually apply to. Tap Details on one to see why it fits you. Found one on Handshake? Paste it with Import and I'll check if you qualify.", target: "[data-testid=button-job-details]" },
  "/resume": { text: "This is what I build everything from. Every change I suggest shows the line of your resume behind it, and you approve each one.", target: "[data-testid=tab-resume-tailor]" },
  "/interview": { text: "Let's build one story together. I'll ask a few short questions; you answer in your own words. It takes about 2 minutes.", target: "[data-testid=input-story-answer], [data-testid=button-make-stories]" },
  "/path": { text: "Not sure what you want yet? Start with these directions from your resume. Pick one and I'll search for it.", target: "[data-testid=button-choose-career], [data-testid=button-refresh-path]" },
  "/community": { text: "The people you know are your best way in. Add one person and I'll help you write to them in your own words.", target: "[data-testid=button-add-contact]" },
  "/calendar": { text: "Your deadlines and interviews in one place. Connect Google Calendar or export them." },
  "/progress": { text: "Every application you send, and where it stands. I move cards when you tell me, or when an email says so." },
};

export function PageIntro({ path }: { path: string }) {
  const { ws, save } = useStore();
  const w = ws!;
  const intro = INTROS[path];
  const seen = w.settings.introsSeen || [];
  // After setup and after the first win, so two Remy cards never stack.
  if (!intro || !setupDone(w) || firstWinPending(w) || seen.includes(path)) return null;
  const close = () => save("settings", { introsSeen: [...seen, path].slice(-20) }).catch(() => {});
  return (
    <div className="intro-card fade-up" role="note" data-testid="page-intro">
      <Remy size={30} />
      <p className="small">{intro.text}</p>
      <div className="row" style={{ gap: 6 }}>
        {intro.target && <button className="btn btn-primary btn-sm" onClick={() => { highlight(intro.target!); close(); }} data-testid="button-intro-show">Show me</button>}
        <button className="btn btn-ghost btn-sm" onClick={close} aria-label="Got it, hide this" data-testid="button-intro-ok">{intro.target ? "Got it" : <><X size={14} /> Got it</>}</button>
      </div>
    </div>
  );
}

/** "Show me around again": the first win and every page intro come back. */
export const tourAgain = (save: ReturnType<typeof useStore>["save"]) => save("settings", { firstWin: 0, introsSeen: [] });
