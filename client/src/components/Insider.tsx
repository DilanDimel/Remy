import { useState } from "react";
import { FlaskConical } from "lucide-react";
import type { Workspace } from "@shared/types";
import { INSIDER_SURVEY, insiderEligible, insiderSurveyDue } from "@shared/beta";
import { api, useStore } from "../lib/store";
import { Modal, Remy, Spinner } from "./common";

const LATER = "remy.insider.later";
const snoozed = () => { try { return Date.now() - Number(localStorage.getItem(LATER) || 0) < 7 * 864e5; } catch { return false; } };

/** Beta Insider (open access, Nov 24): after a few days of use Remy invites the student to be one of his closest testers
 *  (a secret pin; ws.insider is there to open new features to them first); insiders get 3 short questions every two weeks. Home page only. */
export function Insider() {
  const { ws, setWs, run, config } = useStore();
  const [hidden, setHidden] = useState(snoozed);
  const [survey, setSurvey] = useState(false);
  const [joining, setJoining] = useState(false);
  const w = ws as Workspace;
  const due = insiderSurveyDue(w, config?.today || new Date().toISOString().slice(0, 10));
  if (hidden || !(insiderEligible(w) || due)) return null;
  const later = () => { try { localStorage.setItem(LATER, String(Date.now())); } catch {} setHidden(true); };
  return (
    <section className="card row" style={{ gap: 14, padding: "14px 16px", margin: "0 0 16px", flexWrap: "wrap" }} data-testid="insider-card">
      <Remy size={40} mood="happy" />
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <b className="row" style={{ gap: 6 }}><FlaskConical size={16} /> {due ? "Two minutes for Remy?" : "Want to shape what Remy builds next?"}</b>
        <p className="small muted" style={{ margin: "2px 0 0" }}>{due
          ? "Three quick questions about the last two weeks. The team reads every answer."
          : "You've been using Remy for a few days. Join Beta Insider: a secret pin, a real say in what the team builds next, and three quick questions every two weeks."}</p>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={later} data-testid="button-insider-later">Not now</button>
        {due
          ? <button className="btn btn-primary btn-sm" onClick={() => setSurvey(true)} data-testid="button-insider-survey">Answer 3 questions</button>
          : <button className="btn btn-primary btn-sm" onClick={() => setJoining(true)} data-testid="button-insider-join">Join Beta Insider</button>}
      </div>
      {survey && <Survey onClose={() => setSurvey(false)} />}
      {joining && <Join onClose={() => setJoining(false)} />}
    </section>
  );
}

const SOURCES = ["A friend", "Instagram", "LinkedIn", "A class or professor", "Career center", "Somewhere else"];
/** Joining asks what the old Founding Cohort form asked, so the team knows who its insiders are (Nov 24).
 *  Goal and worries come from setup; the student can change them here. Everything is optional. */
function Join({ onClose }: { onClose: () => void }) {
  const { ws, setWs, run } = useStore();
  const p = (ws as Workspace).profile;
  const [a, setA] = useState({ goal: p.goal || "", stuck: p.worries || "", tools: "", source: "" });
  const [busy, setBusy] = useState(false);
  const join = async () => {
    setBusy(true);
    const r = await run(() => api<Workspace>("POST", "/api/insider", { answers: a }), "You're a Beta Insider. Check your pins on Rewards.");
    setBusy(false);
    if (r) { setWs(r); onClose(); }
  };
  return (
    <Modal title="Join Beta Insider" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); join(); }} data-testid="insider-join-form">
        <p className="small muted" style={{ margin: 0 }}>Four quick questions so the team knows what you need. {[p.school, p.major, p.classYear].filter(Boolean).length ? `We'll use ${[p.school, p.major, p.classYear].filter(Boolean).join(", ")} from your profile.` : ""}</p>
        <label className="stack-sm small"><b>What are you trying to land next?</b>
          <input className="input" value={a.goal} onChange={(e) => setA({ ...a, goal: e.target.value })} maxLength={300} placeholder="e.g. A summer internship in finance" data-testid="input-insider-goal" />
        </label>
        <label className="stack-sm small"><b>Where are you stuck right now?</b>
          <input className="input" value={a.stuck} onChange={(e) => setA({ ...a, stuck: e.target.value })} maxLength={300} placeholder="e.g. Getting past the resume screen" data-testid="input-insider-stuck" />
        </label>
        <label className="stack-sm small"><b>What else do you use for your search?</b>
          <input className="input" value={a.tools} onChange={(e) => setA({ ...a, tools: e.target.value })} maxLength={300} placeholder="e.g. LinkedIn, Handshake" data-testid="input-insider-tools" />
        </label>
        <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small"><b>How did you hear about Remy?</b></legend>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {SOURCES.map((s) => <button key={s} type="button" className={"btn btn-sm " + (a.source === s ? "btn-primary" : "btn-secondary")} aria-pressed={a.source === s} onClick={() => setA({ ...a, source: a.source === s ? "" : s })} data-testid={`button-insider-source-${SOURCES.indexOf(s)}`}>{s}</button>)}
          </div>
        </fieldset>
        <p className="xs muted" style={{ margin: 0 }}>Insiders get a secret pin and three quick questions every two weeks. Only the Remy team sees your answers.</p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} data-testid="button-insider-join-cancel">Not now</button>
          <button className="btn btn-primary btn-sm" disabled={busy} data-testid="button-insider-join-confirm">{busy && <Spinner />} Join</button>
        </div>
      </form>
    </Modal>
  );
}

function Survey({ onClose }: { onClose: () => void }) {
  const { setWs, run } = useStore();
  const [a, setA] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const set = (i: number, v: string) => setA((x) => x.map((y, j) => (j === i ? v : y)));
  const send = async (answers: string[]) => {
    setBusy(true);
    const r = await run(() => api<Workspace>("POST", "/api/insider/survey", { answers }), answers.some(Boolean) ? "Thanks! The team reads every answer." : undefined);
    setBusy(false);
    if (r) { setWs(r); onClose(); }
  };
  return (
    <Modal title="Beta Insider check-in" onClose={onClose}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); send(a); }}>
        <fieldset className="stack-sm" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small"><b>{INSIDER_SURVEY[0]}</b></legend>
          <div className="row" style={{ gap: 6 }}>
            {["1", "2", "3", "4", "5"].map((n) => (
              <button key={n} type="button" className={"btn btn-sm " + (a[0] === n ? "btn-primary" : "btn-secondary")} aria-pressed={a[0] === n} onClick={() => set(0, n)} data-testid={`button-insider-rate-${n}`}>{n}</button>
            ))}
          </div>
        </fieldset>
        {[1, 2].map((i) => (
          <label key={i} className="stack-sm small"><b>{INSIDER_SURVEY[i]}</b>
            <textarea className="textarea" value={a[i]} onChange={(e) => set(i, e.target.value)} maxLength={600} style={{ minHeight: 70 }} data-testid={`input-insider-q${i + 1}`} />
          </label>
        ))}
        <div className="row-between">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => send([])} disabled={busy} data-testid="button-insider-skip">Skip this time</button>
          <button className="btn btn-primary btn-sm" disabled={busy || !a.some((x) => x.trim())} data-testid="button-insider-send">{busy && <Spinner />} Send</button>
        </div>
      </form>
    </Modal>
  );
}
