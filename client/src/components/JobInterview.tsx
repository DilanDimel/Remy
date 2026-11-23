// Redesign stage 3 (owners first): "Not every job asks the same questions" (Nov 21 meeting). Practice questions for
// the opening the student is applying to, from the posting's own requirements, with the resume line to answer each.
import { useState } from "react";
import { Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { jobQuestions } from "@shared/jobInterview";
import { hospitalFirst } from "@shared/employer";
import { useOwnerView, useStore } from "../lib/store";
import { useJobs } from "../lib/jobs";
import { PracticeOutLoud } from "./PracticeOutLoud";

/** The openings to practice for: ones they're applying to (newest first), then kept ones, else the best fits. */
export function useInterviewJobs() {
  const w = useStore().ws!;
  // Openings they're applying to first (newest first), then the ones they kept.
  const applying = [...w.applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => a.jobId);
  const ids = [...new Set([...applying, ...w.savedJobIds])];
  const owner = useOwnerView();
  const mine = ids.map((id) => w.jobs.find((j) => j.id === id)).filter((j): j is NonNullable<typeof j> => !!j && j.kind !== "event").map((j) => owner ? hospitalFirst(j) : j); // owners: the hospital, not "Tenet Healthcare"
  // Nothing saved or started yet: practice for the best-fitting openings instead of a "save one first" note.
  const { jobs: all, fits } = useJobs();
  const best = (all || []).filter((j) => j.kind !== "event" && !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false).sort((x, y) => (fits[y.id]?.score ?? 0) - (fits[x.id]?.score ?? 0)).slice(0, 8);
  return { mine, jobs: mine.length ? mine : best };
}

export function JobInterview() {
  const { ws } = useStore();
  const owner = useOwnerView(); // owners: Remy's peach practice card (no dark bands, Dilan Nov 22)
  const w = ws!;
  const { mine, jobs } = useInterviewJobs();
  const [pick, setPick] = useState(jobs[0]?.id || "");
  const [open, setOpen] = useState<number | null>(0);
  const job = jobs.find((j) => j.id === pick) || jobs[0];
  if (!job) return (
    <section className="card card-pad stack-sm" data-testid="job-interview">
      <h3 className="row"><Briefcase size={18} /> Questions for your next interview</h3>
      <p className="small muted">Save an opening or start tailoring for one, and Remy lists the questions that job is likely to ask, from its own posting.</p>
    </section>
  );
  const qs = jobQuestions(job, w.resume?.doc);
  const picker = jobs.length > 1 && (
    <label className="xs muted row" style={{ gap: 6 }}>For
      <select className="input" style={{ width: "auto", maxWidth: "min(360px, 100%)", minWidth: 0 }} value={job.id} onChange={(e) => { setPick(e.target.value); setOpen(0); }} aria-label="Opening to practice for" data-testid="select-interview-job">
        {jobs.map((j) => <option key={j.id} value={j.id}>{j.company}: {j.title}{j.location ? ` (${j.location.split(",")[0]})` : ""}</option>)}
      </select>
    </label>
  );
  // Owners (tabs redesign, Nov 23): the practice set as numbered steps, one question open at a time, with a Next button.
  if (owner) {
    const i = open ?? 0, q = qs[i];
    return (
      <section className="op-card stack-sm" data-testid="job-interview">
        <span className="op-kick">Practice set · {job.company}</span>
        <h2 className="iv-title">Questions {job.company} will likely ask</h2>
        <p className="small muted">{!mine.length && "Top match for you until you save or tailor for an opening. "}Picked from the {job.title} posting. Answer out loud with your real stories.</p>
        {picker}
        <div className="iv-play">
        <ol className="iv-steps">{qs.map((x, n) => (
          <li key={x.q}><button className={n === i ? "on" : ""} onClick={() => setOpen(n)} aria-current={n === i} data-testid="job-question"><small>{n + 1}</small><b>{x.q}</b></button></li>
        ))}</ol>
        {q && <div className="iv-q stack-sm" data-testid="job-question-open">
          <span className="op-kick">Question {i + 1} of {qs.length}</span>
          <b className="iv-q-t">{q.q}</b>
          <span className="small muted">{q.why}</span>
          {q.line && <span className="small" data-testid="job-question-line">Your line: “{q.line}”</span>}
          <span className="small">{q.tip}</span>
          <PracticeOutLoud key={q.q} goal={[45, 120]} label="Answer out loud" />
          {i < qs.length - 1 && <button className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(i + 1)} data-testid="button-next-question">Next question →</button>}
        </div>}
        </div>
      </section>
    );
  }
  return (
    <section className="card card-pad stack-sm" data-testid="job-interview">
      <h3 className="row"><Briefcase size={18} /> Questions {job.company} may ask</h3>
      {picker}
      <p className="xs muted">{!mine.length && "Top matches for you until you save or tailor for an opening. "}From the {job.title} posting's own requirements. Every job is different, so practice these out loud with your real stories.</p>
      {qs.map((q, i) => (
        <div key={q.q} className="card card-pad stack-sm" style={{ boxShadow: "none", padding: 10 }} data-testid="job-question">
          <button className="row-between small" style={{ textAlign: "left", gap: 8, flexWrap: "nowrap" }} onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <b>{q.q}</b>{open === i ? <ChevronUp size={16} style={{ flex: "none" }} /> : <ChevronDown size={16} style={{ flex: "none" }} />}
          </button>
          {open === i && <>
            <span className="xs muted">{q.why}</span>
            {q.line && <span className="xs" data-testid="job-question-line">Your line: “{q.line}”</span>}
            <span className="xs">{q.tip}</span>
            <PracticeOutLoud goal={[45, 120]} label="Answer out loud" />
          </>}
        </div>
      ))}
    </section>
  );
}
