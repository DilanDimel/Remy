import { useEffect, useMemo, useState } from "react";
import { ApplyLink } from "../components/ApplyLink";
import { SeasonCard } from "../components/SeasonCard";
import { ApplyNudge } from "../components/ApplyNudge";
import { MissionBoard } from "../components/Game";
import { ArrowRight, ArrowUpRight, Briefcase, CalendarCheck, Check, ChevronDown, ChevronUp, Compass, FileText, Flame, ListChecks, MapPin, Mic } from "lucide-react";
import type { Job, Task, Workspace } from "@shared/types";
import { api, daysUntil, fmtDate, rid, useOwnerView, useStore } from "../lib/store";
import { CAREER_QUEST_ON } from "@shared/game";
import { useCompleting } from "../lib/completing";
import { go } from "../lib/router";
import { kindLabel, shortPlace, useJobs } from "../lib/jobs";
import { Remy, StatusChip } from "../components/common";
import { firstName } from "@shared/names";
import { gettingStarted } from "@shared/progress";
import { many, remyLine } from "@shared/homeLine";
import { nextAction } from "@shared/nextAction";
import { dailyStreak, dayKey, streakDays, weekDots } from "@shared/daily";
import { OrgLogo } from "../components/OrgLogo";

type Tab = "todos" | "events" | "opps";

// A big faint drawing in the corner of the "one thing" card, picked from where the button goes.
const nextArt = (link: string, interview: boolean) => interview || link.startsWith("/interview") ? Mic : link.startsWith("/resume") ? FileText : link.startsWith("/opportunities") ? Briefcase : link.startsWith("/path") ? Compass : link.startsWith("/calendar") ? CalendarCheck : ListChecks;

// A rough time for the one thing, so it feels small (owners).
const etaFor = (link: string, interview: boolean) => interview ? "about 15 min" : link === "/resume?tab=base" ? "about 4 min · unlocks Tailor" : link.startsWith("/resume?tab=tailor") ? "about 5 min" : link.startsWith("/interview") ? "about 10 min" : link.startsWith("/opportunities") ? "about 2 min" : "";

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
  // The rules live in shared/nextAction.ts, so the phone app suggests the same one thing.
  const next = useMemo(() => nextAction(w, jobs, fits, { ownerView }), [w, jobs, fits, ownerView]);

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
    <div key={t.id} className={"item todo-row" + (t.done ? " completing" : "") + (open === t.id ? " open" : "")}>
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
  // Owners (Nov 23 review): an empty "This week" card was dead space, so it offers today's My Path quests instead.
  const rated = Object.values(w.jobFeedback || {}).filter((f) => f.createdAt && dayKey(new Date(f.createdAt)) === dayKey()).length;
  const noTodos = !ownerView ? <p className="muted small" style={{ padding: "14px 0" }}>No open to-dos. Your plan in My Path can suggest a few.</p> : (
    <div data-testid="home-quests">
      <p className="muted small" style={{ margin: "10px 0 2px" }}>No to-dos yet. Today's quests from My Path:</p>
      {([["Keep or pass 3 openings", `${Math.min(3, rated)}/3`, "/opportunities"], ["Decode one job", w.game?.days?.[dayKey()]?.includes("role") ? "1/1" : "0/1", "/path?play=1"]] as const).map(([t, n, link]) => (
        <div key={t} className="item todo-row">
          <div className="item-main"><b>{t}</b><div className="why">{n} today · counts toward your season</div></div>
          <button className="btn btn-secondary btn-sm" onClick={() => go(link)} data-testid="button-home-quest">Go <ArrowRight size={14} /></button>
        </div>
      ))}
    </div>
  );
  const jobRow = (j: Job, i = 0) => <JobRow key={j.id} j={j} why={fits[j.id]?.why} open={open === j.id} onToggle={() => setOpen(open === j.id ? "" : j.id)} mono={ownerView} matched={fits[j.id]?.matched} top={ownerView && i === 0 && j.kind !== "event"} />;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Home</span>
          <h1 data-testid="text-greeting">{greeting()}{name ? `, ${name}` : ""}.</h1>
          {!ownerView && <p className="hide-phone">Here's the one thing worth doing next, and a few things that matter this week.</p>}
          {ownerView && <p className="remy-line" data-testid="remy-line">{remyLine({ day: dayKey(), hour: new Date().getHours(), interviewSoon: !!interview, cheer, done: doneNow, total: starting.length, newJobs, deadlines: soon, pending: w.applications.filter((a) => a.changes.some((c) => c.status === "pending")).length })}</p>}
        </div>
        {ownerView && (() => {
          // Read-only peek at My Path's daily round (#161): the streak, this week's days and today's three cards.
          const g = streakDays(w); // same days as My Path: any real step counts, not only the round's cards
          const st = dailyStreak(g);
          const today = (["openings", "role", "forecast"] as const).every((c) => w.game?.days?.[dayKey()]?.includes(c));
          return (
            <div className={"streak-peek" + (today ? " done" : "")} data-testid="home-streak">
              {/* grey until today's round is done, then it catches fire */}
              <Flame size={22} className="streak-flame" fill={today ? "currentColor" : "none"} aria-label={today ? "Today's round is done" : "Today's round isn't done yet"} data-testid="home-streak-flame" />
              <span className="streak-num">{st.days}</span>
              <span className="streak-lab"><b>day streak</b>{st.best > st.days ? `Best ${st.best}` : st.days ? "Your best yet" : "Start today"}</span>
              <span className="streak-dots" aria-label="This week of your streak">{weekDots(g, undefined, true).map((d) => <i key={d.key} className={d.status} title={new Date(d.key + "T12:00:00").toLocaleDateString(undefined, { weekday: "long" }) + (d.status === "done" ? ": done" : d.status === "today" ? ": today" : d.status === "future" ? ": coming up" : "")}>{d.label}</i>)}</span>
              <button className={"btn btn-sm " + (today ? "btn-secondary" : "btn-primary")} onClick={() => go(today ? "/path" : "/path?play=1")} data-testid="button-todays-round">{today ? "Done for today" : "Today's round"}</button>
            </div>
          );
        })()}
      </div>

      {ownerView && (
        // Redesign stage 2 (owners first, Nov 21): Remy himself says the one thing to do now, with one button.
        <section className={"hero2" + (starting.some((x) => !x.done) ? " has-track" : "")} aria-label="Next action" data-testid="hero2">
          {cheer && <div className="burst" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ ["--a" as any]: `${i * 30}deg` }} />)}</div>}
          <div className="hero2-remy"><Remy size={92} mood={cheer ? "happy" : "wave"} /></div>
          <div className="hero2-bubble">
            {/* a small drawing on a tilted sheet, picked from where the button goes */}
            {(() => { const Art = nextArt(next.link, !!interview); return <span className="hero2-art" aria-hidden="true"><Art size={44} strokeWidth={1.75} /><i><Check size={16} strokeWidth={3} /></i></span>; })()}
            <span className="hero2-label">{cheer ? "Remy: nice, that's done. Next up" : "Remy says: your one thing right now"}</span>
            <h2 data-testid="text-next-action">{next.title}</h2>
            <p>{next.why}</p>
            <div className="hero2-go">
              <button className="btn btn-primary btn-lg" onClick={() => (interview ? addPrep() : go(next.link))} data-testid="button-next-action">{next.cta} <ArrowRight size={16} /></button>
              {etaFor(next.link, !!interview) && <span className="xs muted">{etaFor(next.link, !!interview)}</span>}
            </div>
          </div>
          {starting.some((x) => !x.done) && (
            <div className="hero2-track" data-testid="getting-started">
              <div className="hero2-track-head"><span>Getting started</span><span>{doneNow}/{starting.length}</span></div>
              <ol aria-label={`${doneNow} of ${starting.length} getting-started steps done`}>
                {starting.map((x, i) => { const cur = !x.done && x === starting.find((y) => !y.done); return (
                  <li key={x.label} className={x.done ? "done" : cur ? "cur" : ""}>
                    <span className="ms-box">{x.done ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                    {x.done ? <span className="ms-text">{x.label}</span> : <button className="ms-text" onClick={() => go(x.link)} data-testid="getting-started-item">{x.label}</button>}
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
            <div className="home-list-head"><h2 id="h-week">Coming up</h2>{/* Nov 23 PM review: it listed December to-dos under "This week" */}<a href="/progress?tab=todos" className="btn btn-ghost btn-sm">All to-dos <ArrowUpRight size={14} /></a></div>
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

function JobRow({ j, why, open, onToggle, mono, matched, top }: { j: Job; why?: string; open: boolean; onToggle: () => void; mono?: boolean; matched?: string[]; top?: boolean }) {
  const d = daysUntil(j.deadline);
  const due = j.deadline && <span className={"chip " + (d !== null && d <= 7 ? "chip-setup" : "chip-plain")}>{d !== null && d >= 0 ? (d === 0 ? "Due today" : `${d}d left`) : fmtDate(j.deadline)}</span>;
  return (
    <div className={"item" + (mono ? " job-card" : "") + (top ? " top" : "")}>
      {mono && <OrgLogo company={j.company} url={j.applyUrl} />}
      <div className="item-main">
        {mono ? <span className="xs muted">{j.company} · {kindLabel[j.kind]}</span> : <div className="row"><span className="xs muted">{j.company} · {kindLabel[j.kind]}</span><StatusChip label={j.label} /></div>}
        <button style={{ textAlign: "left", padding: 0, fontWeight: 700 }} onClick={onToggle}>{j.title}</button>
        {mono ? (
          // Owners: the facts as small tags instead of a sentence (live, city, skills you already show, deadline).
          <div className="job-tags"><StatusChip label={j.label} />{j.location && <span className="chip chip-plain">{shortPlace(j.location.replace(/[,(][^;]*/g, ""))}</span>}{!!matched?.length && <span className="chip chip-plain">{matched[0]}{matched.length > 1 ? ` +${matched.length - 1}` : ""}</span>}{due}</div>
        ) : <div className="why">{why}</div>}
        {open && (
          <div className="stack-sm" style={{ marginTop: 8 }}>
            {mono && why && <span className="small muted">{why}</span>}
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
      {mono ? (
        // Skills from the posting you already show: a real count, not a made-up score.
        !!matched?.length && <span className="job-fit" title={`${many(matched.length, "skill")} from this posting are on your resume`}><b>{matched.length}</b>{matched.length === 1 ? "skill" : "skills"}</span>
      ) : <>{due}<button className="icon-btn" onClick={onToggle} aria-label="Details">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></>}
    </div>
  );
}
