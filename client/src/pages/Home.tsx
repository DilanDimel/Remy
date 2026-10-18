import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import type { Job, Task } from "@shared/types";
import { daysUntil, fmtDate, useStore } from "../lib/store";
import { go } from "../lib/router";
import { kindLabel, useJobs } from "../lib/jobs";
import { StatusChip } from "../components/common";

type Tab = "todos" | "events" | "opps";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const { ws, save } = useStore();
  const w = ws!;
  const { jobs, fits } = useJobs();
  const [tab, setTab] = useState<Tab>("todos");
  const [open, setOpen] = useState<string>("");
  const name = w.profile.preferredName || w.profile.name.split(" ")[0] || "there";

  const next = useMemo(() => {
    const pending = w.applications.find((a) => a.changes.some((c) => c.status === "pending"));
    if (!w.resume) return { title: "Upload your resume", why: "Everything Offer Ready suggests is grounded in your real experience. It starts here.", link: "/resume", cta: "Upload resume" };
    if (!w.resume.confirmedAt) return { title: "Confirm your base resume", why: "Check that every line was read correctly. Tailored versions are built only from what you confirm.", link: "/resume?tab=base", cta: "Review resume" };
    if (pending) {
      const j = jobs?.find((x) => x.id === pending.jobId);
      return { title: `Finish reviewing your ${j?.company || ""} application`, why: `${pending.changes.filter((c) => c.status === "pending").length} suggested change(s) are waiting for your accept, edit or reject.`, link: `/resume?tab=tailor&app=${pending.id}`, cta: "Continue review" };
    }
    if (!w.applications.length && jobs?.length) {
      const best = [...jobs].filter((j) => !j.deadline || (daysUntil(j.deadline) ?? 1) >= 0).sort((a, b) => (fits[b.id]?.matched.length || 0) - (fits[a.id]?.matched.length || 0))[0];
      if (best) return { title: `Tailor your resume for ${best.company}`, why: fits[best.id]?.why || "This is your closest fit among current openings.", link: `/resume?tab=tailor&job=${best.id}`, cta: "Start tailoring" };
    }
    if (w.plan) return { ...w.plan.nextAction, cta: "Open" };
    return { title: "Explore openings that fit you", why: "Save a few to compare deadlines and eligibility.", link: "/opportunities", cta: "Browse" };
  }, [w, jobs, fits]);

  const todos = w.tasks.filter((t) => !t.done).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 3);
  const active = (jobs || []).filter((j) => !w.hiddenJobIds.includes(j.id) && (!j.deadline || (daysUntil(j.deadline) ?? 0) >= 0));
  const events = active.filter((j) => j.kind === "event").slice(0, 3);
  const opps = active.filter((j) => j.kind !== "event").sort((a, b) => (fits[b.id]?.matched.length || 0) - (fits[a.id]?.matched.length || 0)).slice(0, 3);
  const toggleTask = (t: Task) => save("tasks", w.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
  const moreLink = tab === "todos" ? "/progress?tab=todos" : tab === "events" ? "/opportunities?kind=event" : "/opportunities?kind=jobs";

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Home</span>
          <h1 data-testid="text-greeting">{greeting()}, {name}.</h1>
          <p>Here's the one thing worth doing next, and a few things that matter this week.</p>
        </div>
      </div>

      <section className="hero" aria-label="Next action">
        <div>
          <span className="eyebrow">Your next step</span>
          <h2 data-testid="text-next-action">{next.title}</h2>
          <p>{next.why}</p>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-light btn-lg" onClick={() => go(next.link)} data-testid="button-next-action">{next.cta} <ArrowRight size={16} /></button>
          </div>
        </div>
        <div className="hero-side">
          <span className="eyebrow">Where things stand</span>
          {[
            ["Base resume", w.resume ? (w.resume.confirmedAt ? "Confirmed" : "Needs review") : "Not uploaded"],
            ["Applications", `${w.applications.filter((a) => a.versions.length).length} approved · ${w.applications.filter((a) => !a.versions.length).length} in progress`],
            ["Tracked", `${w.tracker.length} opening(s)`],
            ["AI memory", `${w.memory.filter((m) => m.status === "approved").length} approved facts`],
          ].map(([k, v]) => (
            <div key={k} className="row-between small"><span style={{ color: "rgba(255,255,255,.75)" }}>{k}</span><strong style={{ color: "#fff" }}>{v}</strong></div>
          ))}
        </div>
      </section>

      <section className="card card-pad">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <div className="seg" role="group" aria-label="Show">
            {([["todos", "To-Dos"], ["events", "Events"], ["opps", "Opportunities"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); setOpen(""); }} data-testid={`tab-home-${k}`}>{l}</button>
            ))}
          </div>
          <a href={"#" + moreLink} className="btn btn-ghost btn-sm" data-testid="link-view-more">View more <ArrowUpRight size={14} /></a>
        </div>
        {tab === "todos" && (todos.length ? todos.map((t) => (
          <div key={t.id} className="item">
            <button className="check" role="checkbox" aria-checked={t.done} onClick={() => toggleTask(t)} aria-label={`Mark ${t.title} done`} data-testid="checkbox-task">{t.done && <Check size={13} />}</button>
            <div className="item-main">
              <button style={{ textAlign: "left", padding: 0, fontWeight: 700 }} onClick={() => setOpen(open === t.id ? "" : t.id)}>{t.title}</button>
              <div className="why">{t.why}</div>
              {open === t.id && (
                <div className="row" style={{ marginTop: 8 }}>
                  <span className="chip chip-plain">{t.category}</span>
                  <span className="xs muted">Source: {t.source}</span>
                  {t.link && <button className="btn btn-secondary btn-sm" onClick={() => go(t.link!)}>Go <ArrowRight size={14} /></button>}
                </div>
              )}
            </div>
            {t.due && <span className="chip chip-plain">{fmtDate(t.due)}</span>}
            <button className="icon-btn" onClick={() => setOpen(open === t.id ? "" : t.id)} aria-label="Details">{open === t.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
          </div>
        )) : <p className="muted small" style={{ padding: "14px 0" }}>No open to-dos. Your plan in My Path can suggest a few.</p>)}
        {tab !== "todos" && ((tab === "events" ? events : opps).length ? (tab === "events" ? events : opps).map((j) => (
          <JobRow key={j.id} j={j} why={fits[j.id]?.why} open={open === j.id} onToggle={() => setOpen(open === j.id ? "" : j.id)} />
        )) : <p className="muted small" style={{ padding: "14px 0" }}>{jobs ? "Nothing here yet." : "Loading…"}</p>)}
      </section>
    </>
  );
}

function JobRow({ j, why, open, onToggle }: { j: Job; why?: string; open: boolean; onToggle: () => void }) {
  const d = daysUntil(j.deadline);
  return (
    <div className="item">
      <div className="item-main">
        <div className="row"><span className="xs muted">{j.company} · {kindLabel[j.kind]}</span><StatusChip label={j.label} /></div>
        <button style={{ textAlign: "left", padding: 0, fontWeight: 700 }} onClick={onToggle}>{j.title}</button>
        <div className="why">{why}</div>
        {open && (
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <span className="small row"><MapPin size={14} /> {j.location}</span>
            <span className="small">{j.deadlineText}</span>
            <div className="row">
              <button className="btn btn-primary btn-sm" onClick={() => go(`/opportunities?kind=${j.kind === "event" ? "event" : "jobs"}&id=${j.id}`)}>Details</button>
              {j.kind !== "event" && <button className="btn btn-secondary btn-sm" onClick={() => go(`/resume?tab=tailor&job=${j.id}`)}>Tailor resume</button>}
              <a className="btn btn-ghost btn-sm" href={j.applyUrl} target="_blank" rel="noreferrer">{j.kind === "event" ? "Register" : "Apply"} <ArrowUpRight size={14} /></a>
            </div>
          </div>
        )}
      </div>
      {j.deadline && <span className={"chip " + (d !== null && d <= 7 ? "chip-setup" : "chip-plain")}>{d !== null && d >= 0 ? `${d}d left` : fmtDate(j.deadline)}</span>}
      <button className="icon-btn" onClick={onToggle} aria-label="Details">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
    </div>
  );
}
