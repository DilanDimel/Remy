import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Compass, HelpCircle, Plus, RotateCcw, Search, Sparkles, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { FIELD_GROUPS, FIELD_MAJORS } from "@shared/fields";
import { NEED_LABEL, ROADS, roadFor, YEARS, yearNumber } from "@shared/roads";
import type { PathPlan, Task, Workspace } from "@shared/types";
import { api, fmtDate, rid, useOwnerView, useStore } from "../lib/store";
import { go } from "../lib/router";
import { useJobs } from "../lib/jobs";
import { shownForRole } from "@shared/roleMatch";
import { AiUnavailableNote, Empty, Example, Remy, Spinner } from "../components/common";
import { DailyHeader, RoadMap, Round } from "../components/DailyPath";
import { MissionBoard, useGameRecord } from "../components/Game";

type Tab = "academic" | "career" | "skills" | "future" | "road";

export default function PathPage({ query }: { query: URLSearchParams }) {
  const { ws, setWs, run, config } = useStore();
  const w = ws!;
  // Decided once per visit: adding a role from "Start here" mustn't make the card jump while the student is using it.
  const [unsure] = useState(() => !!w.onboarding.exploring || !w.profile.targetRoles.trim());
  const stage4 = useOwnerView(); // redesign stage 4 (owners first): Future of your field folds into the career tab
  const asked = (query.get("tab") as Tab) || (stage4 ? "road" : "career");
  // Redesign stage 7 (owners first): the daily round takes the page; the weekly career quest keeps its record here.
  const play = stage4 && query.get("play") === "1";
  useGameRecord(w, stage4);
  const tab: Tab = stage4 && asked === "future" ? "career" : asked;
  const [busy, setBusy] = useState(false);
  // Same rule as the server: no path until Remy knows something about the student.
  const knows = !!(w.resume || w.profile.major.trim() || w.profile.targetRoles.trim());
  const generate = async () => {
    setBusy(true);
    const r = await run(() => api<Workspace>("POST", "/api/ai/plan"), "Your path was refreshed");
    if (r) setWs(r);
    setBusy(false);
  };
  return (
    <>
      {!play && <div className="page-head">
        <div>
          <span className="eyebrow">My Path</span>
          <h1><span className="title-slogan">Explore. Prepare. Pursue.</span><span className="title-plain">My Path</span></h1>
          <p>Suggestions grounded in your background — with clear labels for what's sourced and what's illustrative.</p>
        </div>
        {knows && <button className="btn btn-secondary" onClick={generate} disabled={busy || !config?.ai.available} data-testid="button-refresh-path">{busy ? <Spinner /> : w.plan ? <RotateCcw size={16} /> : <Sparkles size={16} />} {w.plan ? "Refresh suggestions" : "Build my path"}</button>}
      </div>}
      {play ? <Round onClose={() => go("/path")} /> : <>
      {stage4 && <DailyHeader onPlay={() => go("/path?play=1")} />}
      {!config?.ai.available && !(stage4 && tab === "road") && <AiUnavailableNote />}
      {stage4 && tab === "career" && knows && <PathCheck />}
      <div className="tabs" role="tablist">
        {(stage4 ? [["road", "Your field's road"], ["career", "Career exploration"], ["skills", "Skills & certifications"]] as [Tab, string][] : [["career", "Career exploration"], ["road", "Your field's road"], ["future", "Future of your field"], ["skills", "Skills & certifications"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(`/path?tab=${k}`)} data-testid={`tab-path-${k}`}>{l}</button>
        ))}
      </div>
      {busy && <div className="card card-pad row"><Remy size={40} mood="think" /><span className="muted">Building suggestions from your resume and answers…</span></div>}
      {tab === "future" ? <Future /> : tab === "road" ? (stage4 ? <><RoadMap onPlay={() => go("/path?play=1")} /><MissionBoard w={w} /></> : <FieldRoad />) : !w.plan && !busy ? (
        <div className="card">{knows
          ? stage4 ? (
            <div className="card-pad stack-sm" data-testid="path-empty-example">
              <h3>No path yet</h3>
              <Example>
                <b className="example-role">Financial Analyst</b>
                <p className="small muted">Fits your finance major and the Excel work on your resume. Next: learn SQL basics, then ask one analyst for a coffee chat.</p>
              </Example>
              <div><button className="btn btn-primary" onClick={generate} disabled={!config?.ai.available}>Build my path</button></div>
            </div>
          ) : <Empty title="No path yet" body="Remy will suggest roles that fit your resume and goals, with skills and next steps for each." action={<button className="btn btn-primary" onClick={generate} disabled={!config?.ai.available}>Build my path</button>} />
          : <Empty title="Tell Remy about yourself first" body="Your path is built from your resume and goals. Upload your resume, or add your major and the roles you want, and Remy will suggest roles, skills and next steps." action={<a className="btn btn-primary" href="/resume">Upload your resume</a>} />}</div>
      ) : w.plan && !busy ? (
        <>
          <p className="xs muted">Made {fmtDate(w.plan.generatedAt)}. Changing your profile won't silently rewrite this — refresh when you're ready.</p>
          {tab === "career" && <div id="path-explore"><Directions plan={w.plan} unsure={unsure} /></div>}
          {(tab === "skills" || tab === "academic") && <><Skills plan={w.plan} /><YourTerms plan={w.plan} /></>}

        </>
      ) : null}
      {/* No path yet: exploring by major still works. */}
      {tab === "career" && !(w.plan && !busy) && <div className="card card-pad" id="path-explore"><Explore /></div>}
      </>}
    </>
  );
}

function useAddTask() {
  const { ws, save, run } = useStore();
  return (title: string, why: string, category: Task["category"]) => {
    if (ws!.tasks.some((t) => t.title === title)) return run(async () => { throw new Error("That's already on your to-do list."); });
    return run(() => save("tasks", [{ id: rid("t"), title, why, due: "", category, done: false, source: "Added from My Path" }, ...ws!.tasks]), "Added to your to-dos");
  };
}

/** Career exploration (owner feedback #61, Nov 19-20: the three tall cards "didn't do anything", and "not sure" sat in a
 *  dropdown at the bottom). Directions are short rows with real numbers (openings Remy shows for that kind of job,
 *  steps done); the one picked opens beside them. "Not sure" is a row like the others and opens the same way. */
function Directions({ plan, unsure }: { plan: PathPlan; unsure: boolean }) {
  const { ws, save, run } = useStore();
  const w = ws!;
  const { jobs, fits } = useJobs();
  const add = useAddTask();
  // A pick from before "Refresh suggestions" may name a direction that's gone: then nothing is picked.
  const chosenId = plan.careers.some((x) => x.id === plan.chosenCareerId) ? plan.chosenCareerId : undefined;
  const [sel, setSel] = useState<string>(() => (unsure && !chosenId ? "explore" : chosenId || plan.careers[0]?.id || "explore"));
  const panel = useRef<HTMLDivElement>(null);
  const open = (id: string) => { setSel(id); if (window.innerWidth < 900) setTimeout(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
  const shown = (title: string) => (jobs ? shownForRole(title, jobs, fits, w.hiddenJobIds) : null);
  const task = (s: string) => w.tasks.find((t) => t.title === s);
  // The toast says exactly what happened: which jobs Remy now searches for and how many steps were added.
  const choose = (id?: string) => {
    const c = plan.careers.find((x) => x.id === id);
    const added = c ? c.steps.filter((s) => !task(s)).slice(0, 3).length : 0;
    return run(() => pick(id), c ? `Remy will now look for ${c.title} openings${added ? ` · ${added} step${added > 1 ? "s" : ""} added to your to-dos` : ""}` : "Removed from your search picks. Your target roles stay as they are (edit them in Profile)");
  };
  const pick = async (id?: string) => {
    const c = plan.careers.find((x) => x.id === id);
    if (c) {
      // Choosing a direction does something: Remy searches for it, and its next steps go on the to-do list.
      const roles = w.profile.targetRoles.split(/,\s*/).filter(Boolean);
      if (!roles.some((r) => r.toLowerCase() === c.title.toLowerCase())) await save("profile", { ...w.profile, targetRoles: [...roles, c.title].join(", ") });
      const steps = c.steps.filter((s) => !task(s)).slice(0, 3);
      if (steps.length) await save("tasks", [...steps.map((title) => ({ id: rid("t"), title, why: `Step toward ${c.title}`, due: "", category: "Explore" as const, done: false, source: "Added from My Path" })), ...w.tasks]);
    }
    return save("plan", { ...plan, chosenCareerId: id });
  };
  const c = plan.careers.find((x) => x.id === sel);
  const roles = w.profile.targetRoles.split(/,\s*/).filter(Boolean);
  const n = c ? shown(c.title) : null;
  const picked = (id: string) => ({ borderColor: "var(--fox)", boxShadow: "0 0 0 1px var(--fox) inset", ...(id === "explore" ? { borderStyle: "solid" } : {}) });
  return (
    <section id="directions" className="stack">
      <div className="stack-sm">
        <h3 className="row"><Compass size={18} /> Where your resume can take you</h3>
        <p className="small muted">Pick a direction: Remy searches openings for it and puts its first steps on your to-dos. Tap one to see why it fits.</p>
      </div>
      <div className="dir-grid">
        <div className="stack-sm">
          {plan.careers.map((x) => {
            const count = shown(x.title)?.length, chosen = chosenId === x.id;
            // Remy searches the student's target roles (Profile), so a direction already there has been searched.
            const searched = chosen || roles.some((r) => r.toLowerCase() === x.title.toLowerCase());
            const done = x.steps.filter((s) => task(s)?.done).length;
            return (
              <button key={x.id} className="card card-pad stack-sm dir-row" aria-pressed={sel === x.id} onClick={() => open(x.id)} style={sel === x.id ? picked(x.id) : undefined} data-testid="card-career">
                <div className="row-between" style={{ gap: 8 }}><b>{x.title}</b>{chosen && <span className="chip chip-live"><Check size={12} /> In your search</span>}</div>
                {x.fit[0] && <span className="xs muted">{x.fit[0]}</span>}
                <div className="row" style={{ gap: 6 }}>
                  {/* 0 for a direction Remy was never asked to search says nothing about the job market: say so instead. */}
                  {count !== undefined && <span className="chip chip-plain" data-testid="dir-openings">{count || searched ? `${count} opening${count === 1 ? "" : "s"} now` : "Not searched yet"}</span>}
                  {chosen ? <span className="chip chip-plain">{done} of {x.steps.length} step{x.steps.length === 1 ? "" : "s"} done</span> : x.gaps.length > 0 && <span className="chip chip-plain">{x.gaps.length} gap{x.gaps.length === 1 ? "" : "s"}</span>}
                </div>
              </button>
            );
          })}
          <button className="card card-pad stack-sm dir-row" aria-pressed={sel === "explore"} onClick={() => open("explore")} style={{ borderStyle: "dashed", ...(sel === "explore" ? picked("explore") : {}) }} data-testid="dir-explore">
            <b className="row"><HelpCircle size={16} /> None of these, or not sure yet?</b>
            <span className="xs muted">See the jobs your major leads to most, or ask what any job is like.</span>
          </button>
        </div>
        <div ref={panel} className="card card-pad stack" data-testid="dir-panel">
          {c ? (
            <>
              <div className="stack-sm" style={{ gap: 4 }}><h2 style={{ margin: 0 }}>{c.title}</h2><span className="small muted">{c.what}</span></div>
              <div className="grid-2" style={{ alignItems: "start" }}>
                <div className="stack-sm"><span className="eyebrow">Why it fits you · from your resume</span>{c.fit.map((f, i) => <span key={i} className="small row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}><Check size={14} className="pass" style={{ marginTop: 3, flex: "none" }} />{f}</span>)}</div>
                {c.gaps.length > 0 && <div className="stack-sm"><span className="eyebrow">What's missing</span>{c.gaps.map((f, i) => <span key={i} className="small">• {f}</span>)}</div>}
              </div>
              <div className="stack-sm"><span className="eyebrow">First steps · suggested</span>
                {c.steps.map((s, i) => { const t = task(s); return (
                  <div key={i} className="row small" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 8 }} data-testid="dir-step">
                    <span style={{ flex: "none", marginTop: 2 }}>{t?.done ? <Check size={15} className="pass" /> : <span className="dir-box" />}</span>
                    <span style={{ flex: 1 }}>{s}</span>
                    {t ? <span className="xs muted" style={{ flex: "none" }}>{t.done ? "Done" : "On your to-dos"}</span> : <button className="icon-btn" onClick={() => add(s, `Step toward ${c.title}`, "Explore")} aria-label="Add to to-dos" title="Add to to-dos"><Plus size={15} /></button>}
                  </div>); })}
              </div>
              <div className="row" style={{ gap: 8 }}>
                {chosenId === c.id
                  ? <><button className="btn btn-primary" onClick={() => go(`/opportunities?role=${encodeURIComponent(c.title)}`)} data-testid="button-see-openings">{n?.length ? `See ${n.length} opening${n.length === 1 ? "" : "s"}` : "See openings"} <ArrowRight size={15} /></button>
                     <button className="btn btn-ghost" onClick={() => choose(undefined)} data-testid="button-choose-career">Remove from my search</button></>
                  : <button className="btn btn-primary" onClick={() => choose(c.id)} data-testid="button-choose-career">Search for these jobs + add steps</button>}
              </div>
              {chosenId === c.id && n?.length === 0 && <span className="xs muted">None in your openings yet. Remy looks for {c.title} openings about once a day; new ones show up here and on Opportunities.</span>}
            </>
          ) : <Explore />}
        </div>
      </div>
    </section>
  );
}

function Skills({ plan }: { plan: PathPlan }) {
  const add = useAddTask();
  return (
    <div className="card card-pad">
      <table className="table skills-table">
        <thead><tr><th>Suggestion</th><th>Why it matters for you</th><th className="hide-sm">Verify</th><th /></tr></thead>
        <tbody>
          {plan.skills.map((s) => (
            <tr key={s.id}>
              <td><strong>{s.name}</strong><div><span className="chip chip-plain">{s.type}</span></div></td>
              <td className="small">{s.why}</td>
              <td className="xs muted hide-sm">{s.verify}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => add(`Look into: ${s.name}`, s.why, "Prepare")}><Plus size={14} /> To-do</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="xs muted" style={{ marginTop: 10 }}>Remy doesn't invent official certifications or university requirements. Confirm costs, eligibility and credit with the provider and your advisor.</p>
    </div>
  );
}

/** The Academic plan tab is gone (Remy can't see degree audits); terms a student typed in are still shown here. */
function YourTerms({ plan }: { plan: PathPlan }) {
  const { save } = useStore();
  const mine = plan.academic.filter((a) => a.note === "Entered by you");
  if (!mine.length) return null;
  return (
    <div className="card card-pad stack-sm">
      <h3>Your course plan</h3>
      <div className="grid-2" style={{ alignItems: "start" }}>
        {mine.map((a) => (
          <div key={a.id} className="stack-sm">
            <div className="row-between"><b>{a.term}</b><button className="icon-btn" onClick={() => save("plan", { ...plan, academic: plan.academic.filter((x) => x.id !== a.id) })} aria-label="Remove term"><Trash2 size={15} /></button></div>
            {a.items.map((i, k) => <span key={k} className="small">• {i}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The usual steps from college to license or first job in the student's field, each with its source. */
function FieldRoad() {
  const { ws } = useStore();
  const add = useAddTask();
  const p = ws!.profile;
  const mine = roadFor(p.major, p.path) || roadFor([p.targetRoles, p.interests].join(" "), p.path);
  const [key, setKey] = useState(mine?.key || "");
  const road = ROADS.find((r) => r.key === key);
  const year = yearNumber(p.classYear);
  return (
    <section className="card card-pad stack" data-testid="field-road">
      <div className="row-between" style={{ gap: 8 }}>
        <div className="stack-sm" style={{ gap: 2 }}>
          <h3>{road ? `The ${road.label.toLowerCase()} road` : "Pick a field"}</h3>
          {road && <span className="small muted">{road.credentials.some((c) => c.need === "required") ? "Has a required exam or license" : road.credentials.some((c) => c.need === "depends") ? "Some jobs in this field need a license" : "No license needed"}</span>}
        </div>
        <select className="input" style={{ width: "auto", maxWidth: "100%" }} value={key} onChange={(e) => setKey(e.target.value)} aria-label="Field" data-testid="select-road">
          {!road && <option value="">Choose a field</option>}
          {ROADS.filter((r) => !r.parent && !ROADS.some((x) => x.parent === r.key)).map((r) => <option key={r.key} value={r.key}>{r.label}{r.key === mine?.key ? " (yours)" : ""}</option>)}
          {/* fields with specialties: the broad road first, then each specialty */}
          {ROADS.filter((r) => ROADS.some((x) => x.parent === r.key)).map((g) => (
            <optgroup key={g.key} label={g.label}>
              {[g, ...ROADS.filter((x) => x.parent === g.key)].map((r) => <option key={r.key} value={r.key}>{r.key === g.key ? `${r.label} (general)` : r.label}{r.key === mine?.key ? " (yours)" : ""}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      {road && (
        <ol className="road road-long">
          {road.steps.map((s) => (
            <li key={s.what} className={s.year < year ? "on" : s.year === year ? "next" : ""} data-testid="road-step">
              <i>{s.year < year && <Check size={12} />}</i>
              <b>Usually {YEARS[s.year].toLowerCase()}{s.year === year ? " · you are here" : ""}{s.optional ? <span className="chip chip-plain" style={{ marginLeft: 8 }}>Optional</span> : null}</b>
              <span>{s.what}. {s.source ? <a href={s.source} target="_blank" rel="noreferrer" className="xs">Source</a> : <span className="xs muted">General advice</span>}
                {s.year >= year && s.year < 5 && <button className="btn btn-ghost btn-sm" onClick={() => add(s.what, `Usually ${YEARS[s.year].toLowerCase()} on the ${road.label.toLowerCase()} road`, "Prepare")} data-testid="button-road-todo"><Plus size={14} /> To-do</button>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {road?.skills?.length ? (
        <div className="stack-sm" data-testid="road-skills">
          <h4 style={{ margin: "6px 0 0" }}>Skills entry-level postings usually ask for</h4>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{road.skills.map((k) => <span key={k} className="chip chip-plain">{k}</span>)}</div>
          {road.skillsSource && <a className="xs src-link" href={road.skillsSource} target="_blank" rel="noreferrer">Source</a>}
        </div>
      ) : null}
      {road && (
        <div className="stack-sm" data-testid="road-credentials">
          <h4 style={{ margin: "6px 0 0" }}>Exams and licenses</h4>
          <ul className="rows cred-list">
            {road.credentials.map((c) => (
              <li key={c.name} className="cred">
                {/* One line per exam (audit Nov 17: four dense cards); tap it for who needs it, why and when. */}
                <details>
                  <summary className="row" style={{ gap: 8, cursor: "pointer" }} data-testid="cred-summary"><b>{c.name}</b>{!/^No license needed/.test(c.name) && <span className={"chip " + (c.need === "required" ? "chip-setup" : c.need === "optional" ? "chip-plain" : "chip-live")}>{NEED_LABEL[c.need]}</span>}</summary>
                  <div className="stack-sm" style={{ marginTop: 6 }}>
                    <p className="small">{c.who}</p>
                    {c.why && <p className="small muted"><strong>Why people get it: </strong>{c.why}</p>}
                    {c.learn && <p className="small muted"><strong>What you learn: </strong>{c.learn}</p>}
                    {c.when && <p className="xs muted"><strong>When: </strong>{c.when}{c.source ? <> · <a className="src-link" href={c.source} target="_blank" rel="noreferrer">Source</a></> : null}</p>}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="xs muted">These are usual timelines, mostly Texas rules. Rules change, so check the source and your advisor before you plan around a step.</p>
    </section>
  );
}

type FutureOcc = { soc: string; title: string; change: number; openings: number | null; wage: number | null; education: string; aiShare: number | null; link: string };
type OccupationDetails = { soc: string; title: string; duties: string[]; ranked: boolean; dutiesSource: { label: string; url: string; attribution: string; licenseUrl: string } | null; outlook: { quote: string; url: string } | null };

/** "What's the job?": a job's most important duties and one line from its outlook, in the government's own words. No AI. */
function JobDetails({ soc }: { soc: string }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<OccupationDetails | "failed" | null>(null);
  const load = () => {
    setD(null);
    api<OccupationDetails>("GET", `/api/occupation/${encodeURIComponent(soc)}`).then(setD, () => setD("failed"));
  };
  const toggle = () => {
    setOpen(!open);
    if (!open && (d === null || d === "failed")) load();
  };
  const shown = d !== null && d !== "failed" && (d.duties.length || d.outlook) ? d : null;
  return (
    <div>
      <button className="xs" style={{ color: "var(--fox)", fontWeight: 700, padding: 0 }} onClick={toggle} aria-expanded={open} data-testid="button-job-details">{open ? "Hide details" : "What's the job?"}</button>
      {open && (
        <div className="notice stack-sm" style={{ marginTop: 6 }} data-testid="job-details">
          {d === null ? <span className="row small muted"><Spinner /> Loading…</span>
            : d === "failed" ? <span className="small muted">Couldn't load the details. <button className="xs" style={{ color: "var(--fox)", fontWeight: 700, padding: 0 }} onClick={load}>Try again</button></span>
            : !shown ? <span className="small muted">The government doesn't publish duties for this exact job. Its name above links to the government's guide.</span>
            : <>
              {shown.duties.length > 0 && <div className="small"><b>What they do</b> <span className="xs muted">{shown.ranked ? "(the tasks the U.S. Department of Labor rates most important, in its words)" : "(examples from the U.S. Department of Labor, in its words; it hasn't rated which matter most)"}</span><ul style={{ margin: "2px 0 0", paddingLeft: 18, listStyle: "disc" }}>{shown.duties.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
              {shown.outlook && <div className="small"><b>From the government's outlook</b> <span className="xs muted">(Bureau of Labor Statistics)</span><p style={{ margin: "2px 0 0" }}>“{shown.outlook.quote}” <a className="xs" href={shown.outlook.url} target="_blank" rel="noreferrer">Read the full outlook</a></p></div>}
              {shown.dutiesSource && <span className="xs muted">{shown.dutiesSource.attribution} <a href={shown.dutiesSource.url} target="_blank" rel="noreferrer">See all tasks</a> · <a href={shown.dutiesSource.licenseUrl} target="_blank" rel="noreferrer">License</a></span>}
            </>}
        </div>
      )}
    </div>
  );
}

type FutureData = { source: string; allJobsGrowth: number; fields: { field: string; growing: FutureOcc[]; shrinking: FutureOcc[]; total: number; fasterThanAverage: number }[] };

/** Official 10-year projections for the student's fields, with how much of each job AI can speed up. */
function Future() {
  const { ws } = useStore();
  const p = ws!.profile;
  const [data, setData] = useState<FutureData | null>(null);
  useEffect(() => {
    let live = true;
    api<FutureData>("GET", "/api/future").then((d) => { if (live) setData(d); }, () => {});
    return () => { live = false; };
  }, [p.major, p.targetRoles, p.interests]);
  if (!data) return <div className="card card-pad row"><Spinner /> <span className="muted">Loading projections…</span></div>;
  if (!data.fields.length) return <div className="card"><Empty title="Add your major or the roles you want" body="Remy shows how jobs in your field are expected to change over the next ten years, from official U.S. government projections." action={<a className="btn btn-primary" href="/accounts?tab=profile">Add to your profile</a>} /></div>;
  const row = (o: FutureOcc) => (
    <li key={o.title} style={{ display: "grid", gap: 3, padding: "10px 0", borderTop: "1px solid var(--line)" }}>
      <div className="row-between" style={{ gap: 8 }}>
        <b>{o.link ? <a href={o.link} target="_blank" rel="noreferrer">{o.title}</a> : o.title}</b>
        <span className={"chip " + (o.change > 0 ? "chip-live" : "chip-bad")} style={{ flex: "none" }}>{o.change > 0 ? "+" : ""}{o.change}% by 2035</span>
      </div>
      <span className="xs muted">
        {[o.wage ? `$${o.wage.toLocaleString("en-US")} median pay` : "", o.openings ? `about ${Math.round(o.openings * 1000).toLocaleString("en-US")} openings a year` : "", o.education].filter(Boolean).join(" · ")}
        {o.aiShare != null && <> · AI tools can speed up about {Math.round(o.aiShare * 100)}% of its tasks</>}
      </span>
      <JobDetails soc={o.soc} />
    </li>
  );
  return (
    <div className="stack">
      <p className="small muted">How jobs in your field are expected to change from 2025 to 2035. All U.S. jobs are projected to grow {data.allJobsGrowth}%.</p>
      {/* Audit Nov 17: the field closest to their major stays open with the top 3 each way; other fields (picked up from
          interests or roles) are one tap away instead of a wall of tables. */}
      {data.fields.map((f, i) => {
        const body = (
          <>
            <p className="small muted">{f.fasterThanAverage} of {f.total} {f.field} jobs are expected to grow faster than average.</p>
            {f.growing.length > 0 && <><b className="row small"><TrendingUp size={15} /> Growing</b><ul className="rows" style={{ margin: 0, padding: 0, listStyle: "none" }}>{f.growing.slice(0, 3).map(row)}</ul></>}
            {f.shrinking.length > 0 && <><b className="row small"><TrendingDown size={15} /> Shrinking</b><ul className="rows" style={{ margin: 0, padding: 0, listStyle: "none" }}>{f.shrinking.slice(0, 3).map(row)}</ul></>}
            {f.growing.length > 3 && <details className="small" data-testid="future-more"><summary style={{ cursor: "pointer", fontWeight: 700 }}>See {f.growing.length - 3} more growing</summary><ul className="rows" style={{ margin: 0, padding: 0, listStyle: "none" }}>{f.growing.slice(3).map(row)}</ul></details>}
          </>
        );
        return i === 0
          ? <div key={f.field} className="card card-pad stack-sm" data-testid="card-future"><h3 style={{ textTransform: "capitalize" }}>{f.field}</h3>{body}</div>
          : <details key={f.field} className="card card-pad stack-sm" data-testid="card-future"><summary style={{ cursor: "pointer" }}><b style={{ textTransform: "capitalize" }}>{f.field}</b> <span className="small muted">· also from your profile</span></summary>{body}</details>;
      })}
      <div className="notice"><div className="small"><b>What "AI tools can speed up" means:</b> the share of a job's tasks where AI could cut the time in half or more, from research by Eloundou, Manning, Mishkin and Rock (2023). It doesn't mean the job goes away. It means people in that job who use AI well will have an edge, so it's worth learning those tools now.</div></div>
      <p className="xs muted">Source: {data.source}. Click a job for the government's full guide to it.</p>
    </div>
  );
}

/** Redesign stage 4 (owners first): My Path opens with Remy checking the direction ("Your resume says finance. Still
 *  where you want to go?") with picture answers, and the Future of your field tab folds in as a short outlook. */
function PathCheck() {
  const { ws, save, run } = useStore();
  const w = ws!;
  const about = [w.profile.major, w.profile.targetRoles].join(" ");
  const field = Object.keys(FIELD_MAJORS).find((f) => FIELD_MAJORS[f].test(about));
  const key = `path-check:${(field || "none").slice(0, 28)}`;
  const seen = w.settings.introsSeen || [];
  const [full, setFull] = useState(false);
  const [data, setData] = useState<FutureData | null>(null);
  useEffect(() => { let live = true; api<FutureData>("GET", "/api/future").then((d) => { if (live) setData(d); }, () => {}); return () => { live = false; }; }, [w.profile.major, w.profile.targetRoles, w.profile.interests]);
  const answer = (then?: () => void) => run(() => save("settings", { ...w.settings, introsSeen: [...seen.filter((x) => !x.startsWith("path-check:")), key].slice(-20) })).then(() => then?.());
  const f0 = data?.fields[0];
  const top = f0?.growing.slice(0, 3) || [];
  return (
    <div className="stack">
      {field && !seen.includes(key) && (
        <div className="card card-pad stack-sm" data-testid="path-check">
          <div className="row" style={{ flexWrap: "nowrap", gap: 12 }}><Remy size={44} mood="wave" /><b>Your resume says {field.toLowerCase()}. Still where you want to go?</b></div>
          <div className="path-pick">
            <button className="path-pick-tile" onClick={() => answer()} data-testid="path-check-yes"><Check size={26} /><span>Yes, {field.toLowerCase()}</span></button>
            <button className="path-pick-tile" onClick={() => answer(() => document.getElementById("path-explore")?.scrollIntoView({ behavior: "smooth" }))} data-testid="path-check-other"><Compass size={26} /><span>Something else</span></button>
            <button className="path-pick-tile" onClick={() => run(() => save("onboarding", { ...w.onboarding, exploring: true })).then(() => answer())} data-testid="path-check-unsure"><HelpCircle size={26} /><span>Not sure yet</span></button>
          </div>
        </div>
      )}
      {f0 && top.length > 0 && (
        <div className="card card-pad stack-sm" data-testid="path-outlook">
          <b className="row small"><TrendingUp size={15} /> Where {f0.field} is heading</b>
          <span className="small">{f0.fasterThanAverage} of {f0.total} {f0.field} jobs are expected to grow faster than average (all U.S. jobs: {data!.allJobsGrowth}%). Growing fastest: {top.map((o) => `${o.title} (+${o.change}%)`).join(", ")}.</span>
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} aria-expanded={full} onClick={() => setFull(!full)} data-testid="button-path-outlook">{full ? "Hide the full outlook" : "See the full outlook"}</button>
          {full && <Future />}
        </div>
      )}
    </div>
  );
}

type Explained = { title: string; known?: boolean; what: string; day: string[]; entry: string[]; majors: string[]; startNow: string[]; downside: string; official: FutureOcc | null };
const facts = (o: FutureOcc) => [o.wage ? `$${o.wage.toLocaleString("en-US")} median pay` : "", o.openings ? `about ${Math.round(o.openings * 1000).toLocaleString("en-US")} openings a year` : "", o.change ? `${o.change > 0 ? "+" : ""}${o.change}% by 2035` : "", o.education].filter(Boolean).join(" · ");

/** For students who have a major but no idea what jobs it leads to, or who've heard a job title but don't know what the work is. */
function Explore() {
  const { ws, save, run, config } = useStore();
  const p = ws!.profile;
  const [browse, setBrowse] = useState("");
  const [data, setData] = useState<{ field: string; jobs: FutureOcc[] }[] | null>(null);
  const [open, setOpen] = useState<Explained | null>(null);
  const [asking, setAsking] = useState("");
  const [typed, setTyped] = useState("");
  useEffect(() => {
    let live = true;
    api<{ field: string; jobs: FutureOcc[] }[]>("GET", "/api/careers" + (browse ? "?field=" + encodeURIComponent(browse) : "")).then((d) => { if (live) setData(d); }, () => {});
    return () => { live = false; };
  }, [browse, p.major, p.targetRoles]);
  const explain = async (title: string) => {
    setAsking(title);
    const r = await run(() => api<Explained>("POST", "/api/careers/explain", { title }));
    if (r) setOpen(r);
    setAsking("");
  };
  const roles = p.targetRoles.split(/,\s*/).filter(Boolean);
  const want = (title: string) => roles.some((r) => r.toLowerCase() === title.toLowerCase());
  const addRole = (title: string) => run(() => save("profile", { ...p, targetRoles: [...roles, title].join(", ") }), `Remy will look for ${title} openings too`);
  return (
    <div className="stack" data-testid="explore-careers">
      <div className="stack-sm" style={{ gap: 4 }}>
        <h2 style={{ margin: 0 }}>{browse ? `Jobs in ${browse.toLowerCase()}` : "Jobs your major leads to"}</h2>
        <p className="small muted">{browse ? `The ones that hire the most people first.` : p.major ? `Jobs people with your major (${p.major}) often go into, the ones that hire the most first.` : "Pick an area below."} Tap one to see what the work is really like.</p>
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (typed.trim().length > 2) explain(typed.trim()); }}>
        <input className="input grow" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Heard of a job but not sure what it is? e.g. actuary, UX researcher" aria-label="Job title to explain" data-testid="input-explain" />
        <button className="btn btn-secondary btn-sm" disabled={typed.trim().length < 3 || !!asking || !config?.ai.available}>{asking && asking === typed.trim() ? <Spinner /> : <Search size={15} />} What is it?</button>
      </form>
      {open && (
        <div className="notice stack-sm" data-testid="career-explained">
          {open.known === false ? <span className="small">Remy couldn't tell what "{open.title}" means. Try the full job title, like "financial analyst".</span> : <>
            <div className="row-between"><b>{open.title}</b><button className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>Close</button></div>
            <p className="small">{open.what}</p>
            <div className="small"><b>A normal day</b><ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>{open.day.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
            {open.entry.length > 0 && <div className="small"><b>Jobs to apply for after college:</b> {open.entry.join(", ")}</div>}
            {open.majors.length > 0 && <div className="small"><b>People usually study:</b> {open.majors.join(", ")}</div>}
            {open.downside && <div className="small"><b>The hard part:</b> {open.downside}</div>}
            <div className="small"><b>Try it out this year</b><ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>{open.startNow.map((d, i) => <li key={i}>{d}</li>)}</ul></div>
            {open.official && <div className="xs muted">Government numbers for {open.official.link ? <a href={open.official.link} target="_blank" rel="noreferrer">{open.official.title}</a> : open.official.title}: {facts(open.official)}</div>}
            <span className="xs muted">The description is written by AI; the numbers come from the U.S. Bureau of Labor Statistics.</span>
            <div>{want(open.title) ? <span className="chip"><Check size={12} /> In your search</span> : <button className="btn btn-primary btn-sm" onClick={() => addRole(open.title)} data-testid="button-add-role">Look for {open.title} openings</button>}</div>
          </>}
        </div>
      )}
      <div className="stack-sm" data-testid="browse-jobs">
      {data?.map((f) => (
        <div key={f.field} className="stack-sm" style={{ marginTop: 10 }}>
          <span className="eyebrow" style={{ textTransform: "capitalize" }}>{f.field}</span>
          <ul className="rows" style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {f.jobs.map((o) => (
              <li key={o.title} className="row-between" style={{ gap: 8, padding: "8px 0", borderTop: "1px solid var(--line)" }}>
                <span className="stack-sm" style={{ gap: 2 }}><b className="small">{o.title}</b><span className="xs muted">{facts(o)}</span></span>
                <button className="btn btn-ghost btn-sm" style={{ flex: "none" }} onClick={() => explain(o.title)} disabled={!!asking || !config?.ai.available} data-testid="button-explain-career">{asking === o.title ? <Spinner /> : null} What's it like?</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="stack-sm">
        {/* one grouped dropdown instead of ~70 small chips */}
        <label className="xs muted" htmlFor="browse-area">Browse another area</label>
        <select id="browse-area" className="input" style={{ maxWidth: 360 }} value={browse} onChange={(e) => setBrowse(e.target.value)} data-testid="select-browse-area">
          <option value="">My major</option>
          {FIELD_GROUPS.map(([g, opts]) => <optgroup key={g} label={g}>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</optgroup>)}
        </select>
      </div>
      </div>
    </div>
  );
}
