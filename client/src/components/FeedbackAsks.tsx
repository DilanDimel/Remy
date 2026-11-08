import { useState } from "react";
import type { Workspace } from "@shared/types";
import { api, useStore } from "../lib/store";
import { Remy, Spinner } from "./common";

// Feedback Remy asks for itself, so five busy founders don't have to interview everyone (launch plan, Nov 8):
// one question at a moment that matters, and a short weekly check-in. Each is asked once; answers go to the owners'
// feedback list under the student's account and are deleted with it.

type Moment = "moment:resume" | "moment:approved" | "moment:day7";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
/** "2026-W46": the ISO week of a YYYY-MM-DD day, so the check-in is asked once a week. */
export function isoWeek(day: string) {
  const d = new Date(day + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow + 3); // the week's Thursday decides its year
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((+d - +jan4) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
const daysSince = (day?: string) => (day ? Math.floor((Date.parse(today() + "T12:00:00Z") - Date.parse(day + "T12:00:00Z")) / 86_400_000) : 0);

/** The day-7 question on Home: after a week with Remy, once. */
export const dayWeekDue = (w: Workspace) => daysSince(w.visits?.[0]) >= 7 && !w.feedbackAsked?.["moment:day7"] && !Object.values(w.feedbackAsked || {}).includes(today());
/** The weekly check-in on Home: from the third day on, once per week, after that week's career check-in, one ask a day. */
export const checkinDue = (w: Workspace) =>
  daysSince(w.visits?.[0]) >= 3 && !dayWeekDue(w) && !w.feedbackAsked?.[`checkin:${isoWeek(today())}`]
  // Never next to the "What did you do this week?" card, and at most one ask a day (skipping one doesn't bring the next).
  && !!w.lastCheckin && daysSince(w.lastCheckin) <= 6 && !Object.values(w.feedbackAsked || {}).includes(today());

/** One question, right after the moment it's about. */
export function MomentAsk({ ask, question }: { ask: Moment; question: string }) {
  const { ws, setWs, run, toast } = useStore();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ws || ws.feedbackAsked?.[ask]) return null;
  const send = async (skip: boolean) => {
    setBusy(true);
    const r = await run(() => api<Workspace>("POST", "/api/feedback/ask", { key: ask, answers: skip ? [] : [{ q: question, a: answer }] }));
    setBusy(false);
    if (r) { setWs(r); if (!skip) toast("Thanks. The founders read every answer."); }
  };
  return (
    <section className="card card-pad stack-sm" data-testid={`ask-${ask.replace(":", "-")}`}>
      <div className="row" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start" }}>
        <Remy size={30} />
        <div className="stack-sm grow">
          <span className="xs muted">Quick question from the Remy team</span>
          <b className="small">{question}</b>
        </div>
      </div>
      <textarea className="textarea" style={{ minHeight: 64 }} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={330} placeholder="A sentence is plenty." aria-label={question} />
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => send(true)} disabled={busy}>Not now</button>
        <button className="btn btn-primary btn-sm" onClick={() => send(false)} disabled={busy || answer.trim().length < 2} data-testid="button-ask-send">{busy ? <Spinner /> : null} Send</button>
      </div>
    </section>
  );
}

const CHECKIN = ["What did you try in Remy this week?", "Where did you get stuck, or what confused you?", "What should Remy do that it doesn't yet?"];

/** Three questions, one at a time; a short or vague answer gets one follow-up from Remy's AI. */
export function WeeklyCheckin() {
  const { ws, setWs, run, toast } = useStore();
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<{ q: string; a: string; fq: string; fa: string }[]>([]);
  const [text, setText] = useState("");
  const [follow, setFollow] = useState(""); // the follow-up being asked, if any
  const [busy, setBusy] = useState(false);
  if (!ws) return null;
  const key = `checkin:${isoWeek(today())}`;
  if (ws.feedbackAsked?.[key]) return null;
  const finish = async (all: typeof answers) => {
    setBusy(true);
    const r = await run(() => api<Workspace>("POST", "/api/feedback/ask", { key, answers: all }));
    setBusy(false);
    if (r) { setWs(r); if (all.length) toast("Thanks. The founders read every answer."); }
  };
  const next = (all: typeof answers) => {
    setAnswers(all);
    // The last answer stays in the box until it's saved, so a failed send can be retried.
    if (i + 1 < CHECKIN.length) { setText(""); setFollow(""); setI(i + 1); } else finish(all);
  };
  const submit = async () => {
    if (follow) { // answering the follow-up
      const all = answers.slice(0, i + 1).map((x, k) => (k === i ? { ...x, fa: text.trim() } : x));
      return next(all);
    }
    const all = [...answers.slice(0, i), { q: CHECKIN[i], a: text.trim(), fq: "", fa: "" }]; // a retried send doesn't add it twice
    setBusy(true);
    const r = await api<{ followup: string }>("POST", "/api/feedback/followup", { q: CHECKIN[i], a: text.trim() }).catch(() => ({ followup: "" }));
    setBusy(false);
    if (r.followup) { setAnswers(all.map((x, k) => (k === all.length - 1 ? { ...x, fq: r.followup } : x))); setFollow(r.followup); setText(""); }
    else next(all);
  };
  const skipOne = () => {
    if (follow) return next(answers);
    next([...answers.slice(0, i), { q: CHECKIN[i], a: "", fq: "", fa: "" }]);
  };
  return (
    <section className="card card-pad stack-sm" data-testid="weekly-checkin">
      <div className="row" style={{ gap: 10, flexWrap: "nowrap", alignItems: "flex-start" }}>
        <Remy size={30} />
        <div className="stack-sm grow">
          <span className="xs muted">Weekly check-in · {started ? `${i + 1} of ${CHECKIN.length}` : "about 2 minutes"}</span>
          <b className="small">{!started ? "Help us make Remy better for you" : follow || CHECKIN[i]}</b>
          {!started && <span className="xs muted">Three short questions. Remy's AI may ask one follow-up; the founders read your answers. Nothing here changes your resume or profile.</span>}
        </div>
      </div>
      {!started ? (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => finish([])} disabled={busy} data-testid="button-checkin-skip-week">Not this week</button>
          <button className="btn btn-primary btn-sm" onClick={() => setStarted(true)} data-testid="button-checkin-start">Start</button>
        </div>
      ) : (
        <>
          <textarea className="textarea" style={{ minHeight: 64 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={330} placeholder={follow ? "An example helps most." : "A sentence is plenty."} aria-label={follow || CHECKIN[i]} autoFocus />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-ghost btn-sm" onClick={skipOne} disabled={busy}>Skip</button>
            <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy || text.trim().length < 2} data-testid="button-checkin-next">{busy ? <Spinner /> : null} {i + 1 === CHECKIN.length && (follow || !busy) ? "Send" : "Next"}</button>
          </div>
        </>
      )}
    </section>
  );
}
