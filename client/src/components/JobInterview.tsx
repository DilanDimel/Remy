// Redesign stage 3 (owners first): "Not every job asks the same questions" (Nov 21 meeting). Practice questions for
// the opening the student is applying to, from the posting's own requirements, with the resume line to answer each.
import { useState } from "react";
import { Briefcase, ChevronDown, ChevronUp } from "lucide-react";
import { jobQuestions } from "@shared/jobInterview";
import { useStore } from "../lib/store";
import { PracticeOutLoud } from "./PracticeOutLoud";

export function JobInterview() {
  const { ws } = useStore();
  const w = ws!;
  // Openings they're applying to first (newest first), then the ones they kept.
  const applying = [...w.applications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => a.jobId);
  const ids = [...new Set([...applying, ...w.savedJobIds])];
  const jobs = ids.map((id) => w.jobs.find((j) => j.id === id)).filter((j): j is NonNullable<typeof j> => !!j && j.kind !== "event");
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
  return (
    <section className="card card-pad stack-sm" data-testid="job-interview">
      <h3 className="row"><Briefcase size={18} /> Questions {job.company} may ask</h3>
      {jobs.length > 1 && (
        <label className="xs muted row" style={{ gap: 6 }}>For
          <select className="input" style={{ width: "auto", maxWidth: "min(360px, 100%)", minWidth: 0 }} value={job.id} onChange={(e) => { setPick(e.target.value); setOpen(0); }} aria-label="Opening to practice for" data-testid="select-interview-job">
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.company}: {j.title}</option>)}
          </select>
        </label>
      )}
      <p className="xs muted">From the {job.title} posting's own requirements. Every job is different, so practice these out loud with your real stories.</p>
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
