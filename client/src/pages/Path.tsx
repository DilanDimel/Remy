import { useEffect, useState } from "react";
import { Check, Compass, HelpCircle, Plus, RotateCcw, Search, Sparkles, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { FIELD_GROUPS } from "@shared/fields";
import { NEED_LABEL, ROADS, roadFor, YEARS, yearNumber } from "@shared/roads";
import type { PathPlan, Task, Workspace } from "@shared/types";
import { api, fmtDate, rid, useStore } from "../lib/store";
import { go } from "../lib/router";
import { AiUnavailableNote, Empty, Remy, Spinner } from "../components/common";

type Tab = "academic" | "career" | "skills" | "future" | "road";

export default function PathPage({ query }: { query: URLSearchParams }) {
  const { ws, setWs, run, config } = useStore();
  const w = ws!;
  // Decided once per visit: adding a role from "Start here" mustn't make the card jump while the student is using it.
  const [unsure] = useState(() => !!w.onboarding.exploring || !w.profile.targetRoles.trim());
  const tab = (query.get("tab") as Tab) || "career";
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
      <div className="page-head">
        <div>
          <span className="eyebrow">My Path</span>
          <h1>Explore. Prepare. Pursue.</h1>
          <p>Suggestions grounded in your background — with clear labels for what's sourced and what's illustrative.</p>
        </div>
        {knows && <button className="btn btn-secondary" onClick={generate} disabled={busy || !config?.ai.available} data-testid="button-refresh-path">{busy ? <Spinner /> : w.plan ? <RotateCcw size={16} /> : <Sparkles size={16} />} {w.plan ? "Refresh suggestions" : "Build my path"}</button>}
      </div>
      {!config?.ai.available && <AiUnavailableNote />}
      <div className="tabs" role="tablist">
        {([["career", "Career exploration"], ["road", "Your field's road"], ["future", "Future of your field"], ["skills", "Skills & certifications"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(`/path?tab=${k}`)} data-testid={`tab-path-${k}`}>{l}</button>
        ))}
      </div>
      {busy && <div className="card card-pad row"><Remy size={40} mood="think" /><span className="muted">Building suggestions from your resume and answers…</span></div>}
      {tab === "future" ? <Future /> : tab === "road" ? <FieldRoad /> : !w.plan && !busy ? (
        <div className="card">{knows
          ? <Empty title="No path yet" body="Remy will suggest roles that fit your resume and goals, with skills and next steps for each." action={<button className="btn btn-primary" onClick={generate} disabled={!config?.ai.available}>Build my path</button>} />
          : <Empty title="Tell Remy about yourself first" body="Your path is built from your resume and goals. Upload your resume, or add your major and the roles you want, and Remy will suggest roles, skills and next steps." action={<a className="btn btn-primary" href="/resume">Upload your resume</a>} />}</div>
      ) : w.plan && !busy ? (
        <>
          <p className="xs muted">Made {fmtDate(w.plan.generatedAt)}. Changing your profile won't silently rewrite this — refresh when you're ready.</p>
          {tab === "career" && unsure && <Explore above />}
          {tab === "career" && <Careers plan={w.plan} />}
          {(tab === "skills" || tab === "academic") && <><Skills plan={w.plan} /><YourTerms plan={w.plan} /></>}

        </>
      ) : null}
      {/* Directions built from the student's own resume come first; general exploration follows. A student who said
          they're not sure what they want gets "Start here" first instead (it was three screens down). */}
      {tab === "career" && (!unsure || !(w.plan && !busy)) && <Explore />}
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

function Careers({ plan }: { plan: PathPlan }) {
  const { ws, save, run } = useStore();
  const add = useAddTask();
  // The toast says exactly what happened: which jobs Remy now searches for and how many steps were added.
  const choose = (id?: string) => {
    const c = plan.careers.find((x) => x.id === id);
    const added = c && ws ? c.steps.filter((s) => !ws.tasks.some((t) => t.title === s)).slice(0, 3).length : 0;
    return run(() => pick(id), c ? `Remy will now look for ${c.title} openings${added ? ` · ${added} step${added > 1 ? "s" : ""} added to your to-dos` : ""}` : "Removed from your search picks. Your target roles stay as they are (edit them in Profile)");
  };
  const pick = async (id?: string) => {
    const c = plan.careers.find((x) => x.id === id);
    if (c && ws) {
      // Choosing a direction does something: Remy searches for it, and its next steps go on the to-do list.
      const roles = ws.profile.targetRoles.split(/,\s*/).filter(Boolean);
      if (!roles.some((r) => r.toLowerCase() === c.title.toLowerCase())) await save("profile", { ...ws.profile, targetRoles: [...roles, c.title].join(", ") });
      const have = new Set(ws.tasks.map((t) => t.title));
      const steps = c.steps.filter((s) => !have.has(s)).slice(0, 3);
      if (steps.length) await save("tasks", [...steps.map((title) => ({ id: rid("t"), title, why: `Step toward ${c.title}`, due: "", category: "Explore" as const, done: false, source: "Added from My Path" })), ...ws.tasks]);
    }
    return save("plan", { ...plan, chosenCareerId: id });
  };
  return (
    <section id="directions" className="stack">
    <div className="stack-sm">
      <h3 className="row"><Compass size={18} /> Directions that fit your resume</h3>
      <p className="small muted">Pick one and Remy searches openings for that job and puts its first steps on your to-dos.</p>
    </div>
    <div className="grid-3" style={{ alignItems: "start" }}>
      {plan.careers.map((c) => {
        const chosen = plan.chosenCareerId === c.id;
        return (
          <div key={c.id} className="card card-pad stack" style={chosen ? { borderColor: "var(--plum)", boxShadow: "0 0 0 1px var(--plum) inset" } : undefined} data-testid="card-career">
            <div className="row-between"><h3>{c.title}</h3>{chosen && <span className="chip"><Compass size={12} /> In your search</span>}</div>
            <p className="small muted">{c.what}</p>
            <div className="stack-sm"><span className="eyebrow">Fit · from your resume</span>{c.fit.map((f, i) => <span key={i} className="small row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}><Check size={14} className="pass" style={{ marginTop: 3 }} />{f}</span>)}</div>
            <div className="stack-sm"><span className="eyebrow">Gaps</span>{c.gaps.map((f, i) => <span key={i} className="small">• {f}</span>)}</div>
            <div className="stack-sm"><span className="eyebrow">Next steps · illustrative</span>
              {c.steps.map((s, i) => (
                <div key={i} className="row small" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}><span style={{ flex: 1 }}>{s}</span><button className="icon-btn" onClick={() => add(s, `Step toward ${c.title}`, "Explore")} aria-label="Add to to-dos" title="Add to to-dos"><Plus size={15} /></button></div>
              ))}
            </div>
            <button className={"btn btn-sm " + (chosen ? "btn-secondary" : "btn-primary")} onClick={() => choose(chosen ? undefined : c.id)} data-testid="button-choose-career">{chosen ? "Remove from my search" : "Search for these jobs + add steps"}</button>
          </div>
        );
      })}
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
                <div className="row" style={{ gap: 8 }}><b>{c.name}</b>{!/^No license needed/.test(c.name) && <span className={"chip " + (c.need === "required" ? "chip-setup" : c.need === "optional" ? "chip-plain" : "chip-live")}>{NEED_LABEL[c.need]}</span>}</div>
                <p className="small">{c.who}</p>
                {c.why && <p className="small muted"><strong>Why people get it: </strong>{c.why}</p>}
                {c.learn && <p className="small muted"><strong>What you learn: </strong>{c.learn}</p>}
                {c.when && <p className="xs muted"><strong>When: </strong>{c.when}{c.source ? <> · <a className="src-link" href={c.source} target="_blank" rel="noreferrer">Source</a></> : null}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="xs muted">These are usual timelines, mostly Texas rules. Rules change, so check the source and your advisor before you plan around a step.</p>
    </section>
  );
}

type FutureOcc = { title: string; change: number; openings: number | null; wage: number | null; education: string; aiShare: number | null; link: string };
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
    </li>
  );
  return (
    <div className="stack">
      <p className="small muted">How jobs in your field are expected to change from 2025 to 2035. All U.S. jobs are projected to grow {data.allJobsGrowth}%.</p>
      {data.fields.map((f) => (
        <div key={f.field} className="card card-pad stack-sm" data-testid="card-future">
          <h3 style={{ textTransform: "capitalize" }}>{f.field}</h3>
          <p className="small muted">{f.fasterThanAverage} of {f.total} {f.field} jobs are expected to grow faster than average.</p>
          {f.growing.length > 0 && <><b className="row small"><TrendingUp size={15} /> Growing</b><ul className="rows" style={{ margin: 0, padding: 0, listStyle: "none" }}>{f.growing.map(row)}</ul></>}
          {f.shrinking.length > 0 && <><b className="row small"><TrendingDown size={15} /> Shrinking</b><ul className="rows" style={{ margin: 0, padding: 0, listStyle: "none" }}>{f.shrinking.map(row)}</ul></>}
        </div>
      ))}
      <div className="notice"><div className="small"><b>What "AI tools can speed up" means:</b> the share of a job's tasks where AI could cut the time in half or more, from research by Eloundou, Manning, Mishkin and Rock (2023). It doesn't mean the job goes away. It means people in that job who use AI well will have an edge, so it's worth learning those tools now.</div></div>
      <p className="xs muted">Source: {data.source}. Click a job for the government's full guide to it.</p>
    </div>
  );
}

type Explained = { title: string; known?: boolean; what: string; day: string[]; entry: string[]; majors: string[]; startNow: string[]; downside: string; official: FutureOcc | null };
const facts = (o: FutureOcc) => [o.wage ? `$${o.wage.toLocaleString("en-US")} median pay` : "", o.openings ? `about ${Math.round(o.openings * 1000).toLocaleString("en-US")} openings a year` : "", o.change ? `${o.change > 0 ? "+" : ""}${o.change}% by 2035` : "", o.education].filter(Boolean).join(" · ");

/** For students who have a major but no idea what jobs it leads to, or who've heard a job title but don't know what the work is. */
function Explore({ above = false }: { above?: boolean }) {
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
    <div className="card card-pad stack" data-testid="explore-careers">
      <div className="stack-sm">
        <h3 className="row"><HelpCircle size={18} /> Not sure what you want to do? Start here</h3>
        {ws!.plan?.careers.length ? <button className="xs" style={{ alignSelf: "flex-start", color: "var(--fox)", fontWeight: 700, padding: 0 }} onClick={() => document.getElementById("directions")?.scrollIntoView({ behavior: "smooth" })} data-testid="link-directions">See {ws!.plan.careers.length === 1 ? "the direction" : `the ${ws!.plan.careers.length} directions`} Remy suggests for you {above ? "↓" : "↑"}</button> : null}
        <p className="small muted">{browse ? `Jobs in ${browse.toLowerCase()} that hire the most people.` : p.major ? `Jobs people with your major (${p.major}) often go into, the ones that hire the most first.` : "Pick an area to see the jobs in it."} Tap one to see what the work is really like.</p>
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
      {data?.map((f) => (
        <div key={f.field} className="stack-sm">
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
  );
}
