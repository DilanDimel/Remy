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
  const [busy, setBusy] = useState(false);
  const w = ws as Workspace;
  const due = insiderSurveyDue(w, config?.today || new Date().toISOString().slice(0, 10));
  if (hidden || !(insiderEligible(w) || due)) return null;
  const join = async () => {
    setBusy(true);
    const r = await run(() => api<Workspace>("POST", "/api/insider"), "You're a Beta Insider. Check your pins on Rewards.");
    setBusy(false);
    if (r) setWs(r);
  };
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
          : <button className="btn btn-primary btn-sm" onClick={join} disabled={busy} data-testid="button-insider-join">{busy && <Spinner />} Join Beta Insider</button>}
      </div>
      {survey && <Survey onClose={() => setSurvey(false)} />}
    </section>
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
