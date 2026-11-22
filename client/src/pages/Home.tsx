import { useEffect, useMemo, useState } from "react";
import { ApplyLink } from "../components/ApplyLink";
import { SeasonCard } from "../components/SeasonCard";
import { ApplyNudge } from "../components/ApplyNudge";
import { MissionBoard } from "../components/Game";
import { ArrowRight, ArrowUpRight, Briefcase, CalendarCheck, Check, ChevronDown, ChevronUp, Compass, FileText, ListChecks, MapPin, Mic } from "lucide-react";
import type { Job, Task, Workspace } from "@shared/types";
import { api, daysUntil, fmtDate, rid, useOwnerView, useStore } from "../lib/store";
import { CAREER_QUEST_ON } from "@shared/game";
import { useCompleting } from "../lib/completing";
import { go } from "../lib/router";
import { kindLabel, useJobs } from "../lib/jobs";
import { Remy, StatusChip } from "../components/common";
import { firstName } from "@shared/names";
import { gettingStarted } from "@shared/progress";
import { many, remyLine } from "@shared/homeLine";

type Tab = "todos" | "events" | "opps";

// A big faint drawing in the corner of the "one thing" card, picked from where the button goes.
const nextArt = (link: string, interview: boolean) => interview || link.startsWith("/interview") ? Mic : link.startsWith("/resume") ? FileText : link.startsWith("/opportunities") ? Briefcase : link.startsWith("/path") ? Compass : link.startsWith("/calendar") ? CalendarCheck : ListChecks;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const { ws, save, run, setWs } = useStore();
  const ownerView = useOwnerView();
  const w = ws!;
  const { jobs, fits } = useJobs();
  const [tab, setTab] = useState<Tab>("todos");
  const [open, setOpen] = useState<string>("");
  const name = firstName(w);

  // Since you were last here: the previous visit is kept for this page view; the new one is saved once.
  const [since] = useState(() => w.settings.lastSeenAt || "");
  useEffect(() => { if (!since || Date.now() - Date.parse(since) > 30 * 60_000) save("settings", { lastSeenAt: new Date().toISOString() }).catch(() => {}); }, []);
  const from = since || new Date(Date.now() - 7 * 864e5).toISOString();
  const sinceLabel = since ? (Date.now() - Date.parse(since) < 20 * 3600_000 ? "earlier today" : fmtDate(since)) : "";
  const newJobs = (jobs || []).filter((j) => (j.foundAt || "") > from && !w.hiddenJobIds.includes(j.id) && !fits[j.id]?.excluded && fits[j.id]?.regionMatch !== false).length;
  const updates = w.tracker.filter((t) => t.events.some((e) => e.at > from && !/^Manual/.test(e.source))).length;
  const soon = w.calendar.filter((c) => c.kind === "Deadline" && (daysUntil(c.date) ?? -1) >= 0 && (daysUntil(c.date) ?? 99) <= 7).length;
  const mine = new Set([...w.savedJobIds, ...w.applications.map((a) => a.jobId)]);
  const closedSince = w.jobs.filter((j) => { const c = j.checks?.[0]; return mine.has(j.id) && !!c && c.at > from && (c.result === "closed-signal" || c.httpStatus === 404 || c.httpStatus === 410); }).length;
  const sinceRows: [string, string, string][] = [
    // These open the Openings page with the cards they count first (it shows 10 at a time).
    ...(newJobs ? [[`New openings for you`, String(newJobs), `/opportunities?show=new&since=${encodeURIComponent(from)}`] as [string, string, string]] : []),
    ...(updates ? [[`Application updates`, String(updates), "/progress"] as [string, string, string]] : []),
    // Saved or applied-to openings Remy's background check found closed since the last visit.
    ...(closedSince ? [[`Saved openings that closed`, String(closedSince), `/opportunities?show=closed&since=${encodeURIComponent(from)}`] as [string, string, string]] : []),
    ...(soon ? [[`Deadlines in the next 7 days`, String(soon), "/calendar"] as [string, string, string]] : []),
    ...(w.memory.some((m) => m.status === "suggested") ? [["Facts to approve", String(w.memory.filter((m) => m.status === "suggested").length), "/accounts?tab=memory"] as [string, string, string]] : []),
  ];

  // Interview Tomorrow: an interview in the next two days overrides everything else on Home.
  // Whole calendar days from today (noon to noon, so daylight-saving changes don't shift it).
  const interview = w.calendar.find((c) => { const n = daysUntil(c.date); return c.kind === "Interview" && n !== null && n >= 0 && n <= 2; });
  const addPrep = async () => {
    const who = interview!.title.replace(/^interview( with)?:?\s*/i, "");
    const prep = [
      [`Research ${who}: what they do, recent news, the team`, "Ten minutes of reading gives you a better question to ask at the end."],
      ["Pick two true stories from your resume for this role", "One about a challenge, one about a result. Say what you did, not just the team."],
      ["Test your setup: link, camera, mic, quiet spot", "Or plan your route and arrive 10 minutes early if it's in person."],
    ].filter(([t]) => !w.tasks.some((x) => x.title === t)).map(([title, why]) => ({ id: rid("t"), title, why, due: interview!.date, category: "Prepare" as const, done: false, source: "Interview prep" }));
    if (prep.length) await run(() => save("tasks", [...prep, ...w.tasks]), "Added 3 prep steps to your to-dos");
    go("/progress?tab=todos");
  };
  const next = useMemo(() => {
    if (interview) {
      const d = daysUntil(interview.date);
      return { title: `Prepare for your interview ${d === 0 ? "today" : d === 1 ? "tomorrow" : "in 2 days"}: ${interview.title.replace(/^interview( with)?:?\s*/i, "")}`, why: "Three short steps: research the organization, pick two true stories, and test your setup.", link: "", cta: "Add prep steps" };
    }
    const pending = w.applications.find((a) => a.changes.some((c) => c.status === "pending"));
    if (!w.resume) return { title: "Add your resume", why: "Upload it, or build one with Remy in about 10 minutes (no resume yet is fine). Everything Remy suggests is built on it.", link: "/resume?tab=base", cta: "Add resume" };
    if (!w.resume.confirmedAt) return { title: "Confirm your base resume", why: "Check that every line was read correctly. Tailored versions are built only from what you confirm.", link: "/resume?tab=base", cta: "Review resume" };
    if (pending) {
      const j = jobs?.find((x) => x.id === pending.jobId);
      return { title: `Finish reviewing your ${j?.company || ""} application`, why: ownerView ? (() => { const n = pending.changes.filter((c) => c.status === "pending").length; return `${many(n, "suggested change")} ${n === 1 ? "is" : "are"} waiting for you to accept, edit or reject.`; })() : `${pending.changes.filter((c) => c.status === "pending").length} suggested change(s) are waiting for your accept, edit or reject.`, link: `/resume?tab=tailor&app=${pending.id}`, cta: "Continue review" };
    }
    // An interview coming up (beyond the 2-day prep plan) beats a general suggestion.
    const soon = w.calendar.filter((c) => c.kind === "Interview" && (daysUntil(c.date) ?? -1) > 2 && (daysUntil(c.date) ?? 99) <= 21).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (soon) return { title: `${soon.title.replace(/^interview:?\s*/i, "Your interview with ")} is ${fmtDate(soon.date)}, in ${daysUntil(soon.date)} days`, why: "Start now: build two true stories from your resume and practice them out loud. Remy turns Home into a prep plan two days before.", link: "/interview#story-deck", cta: "Prepare stories" };
    // An opening counts only if it passes every filter (not hidden, in their places, eligible, still open).
    const fitsAll = (j: NonNullable<typeof jobs>[number]) => { const f = fits[j.id]; return !!f && !f.excluded && !f.closed && f.regionMatch !== false && f.eligibility !== "unlikely" && j.kind !== "event" && !w.hiddenJobIds.includes(j.id) && (!j.deadline || (daysUntil(j.deadline) ?? 1) >= 0); };
    // A plan step that names an opening the student can't or won't pursue anymore (hidden, closed, elsewhere, not eligible) is skipped.
    // Hidden openings aren't in the list Home gets, so the student's own saved list is checked too.
    // Skipped only when every posting from the company it names fails (one ineligible BDO posting doesn't block another).
    const blocked = (text: string) => {
      const named = [...(jobs || []), ...w.jobs].filter((j) => j.company.length > 2 && text.toLowerCase().includes(j.company.toLowerCase()));
      return named.length > 0 && named.every((j) => !fitsAll(j));
    };
    const moved = w.tracker.filter((t) => t.status !== "Saved").map((t) => t.company.toLowerCase());
    // The student's own plan comes first: its first to-do they haven't done (they can cross it off), then the plan's written next step.
    const planTodo = w.tasks.find((t) => !t.done && t.source === "AI plan (review)" && !blocked(t.title));
    if (planTodo) return { title: planTodo.title, why: planTodo.why, link: planTodo.link || "/progress?tab=todos", cta: "Open" };
    if (w.plan && !blocked(w.plan.nextAction.title) && !moved.some((c) => c && w.plan!.nextAction.title.toLowerCase().includes(c))) return { ...w.plan.nextAction, cta: "Open" };
    if (!w.applications.length && jobs?.length) {
      const best = [...jobs].filter(fitsAll).sort((a, b) => (fits[b.id]?.score || 0) - (fits[a.id]?.score || 0))[0];
      if (best) return { title: `Tailor your resume for ${best.company}`, why: fits[best.id]?.why || "This is your closest fit among current openings.", link: `/resume?tab=tailor&job=${best.id}`, cta: "Start tailoring" };
    }
    return { title: "Explore openings that fit you", why: "Save a few to compare deadlines and eligibility.", link: "/opportunities", cta: "Browse" };
  }, [w, jobs, fits]);

  const starting = gettingStarted(w);
  // Redesign stage 2 (owners first): a small celebration when a getting-started step gets done since the last visit.
  const doneNow = starting.filter((x) => x.done).length;
  const [cheer, setCheer] = useState(false);
  useEffect(() => {
    const key = "remy.startDone." + w.profile.email;
    let before = -1;
    try { before = Number(localStorage.getItem(key) ?? -1); localStorage.setItem(key, String(doneNow)); } catch {}
    if (before >= 0 && doneNow > before) { setCheer(true); const t = setTimeout(() => setCheer(false), 3500); return () => clearTimeout(t); }
  }, [doneNow]);
  const { isFading, mark } = useCompleting();
  const todos = w.tasks.filter((t) => !t.done || isFading(t.id)).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999")).slice(0, 3);
  // Only places the student chose (Opportunities can still show the rest).
  // Same rules as the Opportunities page: nothing it hides (not eligible, not in their fields, closed) shows here either.
  const active = (jobs || []).filter((j) => !w.hiddenJobIds.includes(j.id) && !fits[j.id]?.excluded && !fits[j.id]?.closed && fits[j.id]?.regionMatch !== false && (!j.deadline || (daysUntil(j.deadline) ?? 0) >= 0));
  const events = active.filter((j) => j.kind === "event").slice(0, 3);
  const opps = active.filter((j) => j.kind !== "event").sort((a, b) => (fits[b.id]?.matched.length || 0) - (fits[a.id]?.matched.length || 0)).slice(0, 3);
  const toggleTask = (t: Task) => { if (!t.done) mark(t.id); return run(() => api<Workspace>("PATCH", `/api/tasks/${t.id}`, { done: !t.done }).then(setWs)); };
  const moreLink = tab === "todos" ? "/progress?tab=todos" : tab === "events" ? "/opportunities?kind=event" : "/opportunities?kind=jobs";

  const todoRow = (t: Task) => (
    <div key={t.id} className={"item todo-row" + (t.done ? " completing" : "")}>
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
  );
  const noTodos = <p className="muted small" style={{ padding: "14px 0" }}>No open to-dos. Your plan in My Path can suggest a few.</p>;
  const jobRow = (j: Job) => <JobRow key={j.id} j={j} why={fits[j.id]?.why} open={open === j.id} onToggle={() => setOpen(open === j.id ? "" : j.id)} mono={ownerView} />;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Home</span>
          <h1 data-testid="text-greeting">{greeting()}{name ? `, ${name}` : ""}.</h1>
          {!ownerView && <p className="hide-phone">Here's the one thing worth doing next, and a few things that matter this week.</p>}
          {ownerView && <p className="remy-line" data-testid="remy-line">{remyLine({ hour: new Date().getHours(), interviewSoon: !!interview, cheer, done: doneNow, total: starting.length, newJobs, deadlines: soon, pending: w.applications.filter((a) => a.changes.some((c) => c.status === "pending")).length })}</p>}
        </div>
      </div>

      {ownerView && (
        // Redesign stage 2 (owners first, Nov 21): Remy himself says the one thing to do now, with one button.
        <section className="hero2" aria-label="Next action" data-testid="hero2">
          {cheer && <div className="burst" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ ["--a" as any]: `${i * 30}deg` }} />)}</div>}
          <div className="hero2-remy"><Remy size={92} mood={cheer ? "happy" : "wave"} /></div>
          <div className="hero2-bubble">
            {(() => { const Art = nextArt(next.link, !!interview); return <Art className="hero2-art" aria-hidden="true" strokeWidth={1.25} />; })()}
            <span className="hero2-label">{cheer ? "Remy: nice, that's done. Next up" : "Remy says: your one thing right now"}</span>
            <h2 data-testid="text-next-action">{next.title}</h2>
            <p>{next.why}</p>
            <button className="btn btn-primary btn-lg" onClick={() => (interview ? addPrep() : go(next.link))} data-testid="button-next-action">{next.cta} <ArrowRight size={16} /></button>
          </div>
          {starting.some((x) => !x.done) && (
            <div className="hero2-steps" data-testid="getting-started">
              <span className="xs muted sroad-head">Getting started · {doneNow} of {starting.length}</span>
              {/* a small road: done steps ticked, the next one glowing, the rest waiting */}
              <ol className="sroad" aria-label={`${doneNow} of ${starting.length} getting-started steps done`}>
                {starting.map((x) => { const cur = !x.done && x === starting.find((y) => !y.done); return (
                  <li key={x.label} className={x.done ? "done" : cur ? "cur" : ""}>
                    <span className="sroad-dot">{x.done && <Check size={11} strokeWidth={3} />}</span>
                    {x.done ? <span className="sroad-text">{x.label}</span> : <button className="sroad-text" onClick={() => go(x.link)} data-testid="getting-started-item">{x.label}</button>}
                  </li>
                ); })}
              </ol>
            </div>
          )}
        </section>
      )}
      {!ownerView && <section className="hero" aria-label="Next action">
        <div>
          <span className="eyebrow">Your next step</span>
          <h2 data-testid="text-next-action">{next.title}</h2>
          <p>{next.why}</p>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-light btn-lg" onClick={() => (interview ? addPrep() : go(next.link))} data-testid="button-next-action">{next.cta} <ArrowRight size={16} /></button>
          </div>
        </div>
        {starting.some((x) => !x.done) ? (
          // Getting started (audit 5C): the first five real steps sit where "This week" goes, until all are done.
          <div className="hero-side" data-testid="getting-started">
            <div className="row-between"><span className="eyebrow">Getting started</span><span className="small" style={{ color: "rgba(255,255,255,.75)" }}>{starting.filter((x) => x.done).length} of 5</span></div>
            {starting.map((x) => (
              <button key={x.label} className="row small start-row" style={{ width: "100%", textAlign: "left", gap: 10 }} onClick={() => go(x.link)} data-testid="getting-started-item" aria-label={`${x.label}${x.done ? " (done)" : ""}`}>
                <span className={"start-box" + (x.done ? " done" : "")}>{x.done && <Check size={12} />}</span>
                <span style={x.done ? { color: "rgba(255,255,255,.5)", textDecoration: "line-through" } : { color: "#fff" }}>{x.label}</span>
                {!x.done && <ArrowRight size={13} style={{ marginLeft: "auto", color: "rgba(255,255,255,.5)" }} />}
              </button>
            ))}
            {sinceRows.map(([k, v, link], i) => <button key={k} className="row-between xs" style={{ width: "100%", textAlign: "left", marginTop: i ? 0 : 6, color: "rgba(255,255,255,.65)" }} onClick={() => go(link)}><span>{k}</span><strong style={{ color: "#fff" }}>{v} →</strong></button>)}
          </div>
        ) : (
        <div className={"hero-side" + (sinceRows.length ? "" : " hide-phone")} data-testid="since-last">
            <span className="eyebrow">{since ? `Since ${sinceLabel}` : "This week"}</span>
            {sinceRows.length ? sinceRows.map(([k, v, link]) => (
              <button key={k} className="row-between small" style={{ width: "100%", textAlign: "left" }} onClick={() => go(link)}><span style={{ color: "rgba(255,255,255,.75)" }}>{k}</span><strong style={{ color: "#fff" }}>{v} →</strong></button>
            )) : <span className="small" style={{ color: "rgba(255,255,255,.75)" }}>Nothing new yet. Remy checks employers' sites about once a day, so new openings will show here.</span>}
          </div>
        )}
      </section>}
      {CAREER_QUEST_ON && ownerView && <MissionBoard w={w} />}

      {ownerView ? (
        // Look polish A (owners first, Nov 22): this week's to-dos and the best openings side by side, nothing behind tabs.
        <div className="home-lists" data-testid="home-lists">
          <section aria-labelledby="h-week">
            <div className="home-list-head"><h2 id="h-week">This week</h2><a href="/progress?tab=todos" className="btn btn-ghost btn-sm">All to-dos <ArrowUpRight size={14} /></a></div>
            {todos.length ? todos.map(todoRow) : noTodos}
          </section>
          <section aria-labelledby="h-opps">
            <div className="home-list-head"><h2 id="h-opps">Openings for you</h2><a href="/opportunities?kind=jobs" className="btn btn-ghost btn-sm">See all <ArrowUpRight size={14} /></a></div>
            {opps.length ? opps.map(jobRow) : <p className="muted small" style={{ padding: "14px 0" }}>{jobs ? "Nothing here yet." : "Loading…"}</p>}
            {events.length > 0 && <><h3 className="home-list-sub">Events</h3>{events.map(jobRow)}</>}
          </section>
        </div>
      ) : (
      <section className="card card-pad">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <div className="seg" role="group" aria-label="Show">
            {([["todos", "To-Dos"], ["events", "Events"], ["opps", "Opportunities"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); setOpen(""); }} data-testid={`tab-home-${k}`}>{l}</button>
            ))}
          </div>
          <a href={moreLink} className="btn btn-ghost btn-sm" data-testid="link-view-more">View more <ArrowUpRight size={14} /></a>
        </div>
        {tab === "todos" && (todos.length ? todos.map(todoRow) : noTodos)}
        {tab !== "todos" && ((tab === "events" ? events : opps).length ? (tab === "events" ? events : opps).map((j) => (
          jobRow(j)
        )) : <p className="muted small" style={{ padding: "14px 0" }}>{jobs ? "Nothing here yet." : "Loading…"}</p>)}
      </section>
      )}
      <ApplyNudge w={w} />
      {/* The weekly check-in, the day-7 question and "What did you do this week?" were removed (Dilan, Nov 19: boxes
          that ask for effort and give nothing back). Remy asks only when something happened (ApplyNudge: interviews, events). */}
      <SeasonCard w={w} />
    </>
  );
}

function JobRow({ j, why, open, onToggle, mono }: { j: Job; why?: string; open: boolean; onToggle: () => void; mono?: boolean }) {
  const d = daysUntil(j.deadline);
  return (
    <div className="item">
      {mono && <span className="job-mono" aria-hidden="true">{j.company.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "•"}</span>}
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
              <ApplyLink j={j} className="btn btn-ghost btn-sm" testid="link-apply-home" />
            </div>
          </div>
        )}
      </div>
      {j.deadline && <span className={"chip " + (d !== null && d <= 7 ? "chip-setup" : "chip-plain")}>{d !== null && d >= 0 ? (d === 0 ? "Due today" : `${d}d left`) : fmtDate(j.deadline)}</span>}
      <button className="icon-btn" onClick={onToggle} aria-label="Details">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
    </div>
  );
}
