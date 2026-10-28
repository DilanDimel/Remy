import { useEffect, useState } from "react";
import { Check, Compass, HelpCircle, Plus, RotateCcw, Search, Sparkles, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { FIELD_GROUPS } from "@shared/fields";
import type { PathPlan, Task, Workspace } from "@shared/types";
import { api, fmtDate, rid, useStore } from "../lib/store";
import { go } from "../lib/router";
import { AiUnavailableNote, Empty, Remy, Spinner } from "../components/common";
import { atTcu } from "../components/SchoolVerify";

type Tab = "academic" | "career" | "skills" | "future";

export default function PathPage({ query }: { query: URLSearchParams }) {
  const { ws, setWs, run, config } = useStore();
  const w = ws!;
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
        {([["career", "Career exploration"], ["future", "Future of your field"], ["skills", "Skills & certifications"], ["academic", "Academic plan"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(`/path?tab=${k}`)} data-testid={`tab-path-${k}`}>{l}</button>
        ))}
      </div>
      {busy && <div className="card card-pad row"><Remy size={40} mood="think" /><span className="muted">Building suggestions from your resume and answers…</span></div>}
      {tab === "career" && <Explore />}
      {tab === "future" ? <Future /> : !w.plan && !busy ? (
        <div className="card">{knows
          ? <Empty title="No path yet" body="Remy will suggest roles that fit your resume and goals, with skills and next steps for each." action={<button className="btn btn-primary" onClick={generate} disabled={!config?.ai.available}>Build my path</button>} />
          : <Empty title="Tell Remy about yourself first" body="Your path is built from your resume and goals. Upload your resume, or add your major and the roles you want, and Remy will suggest roles, skills and next steps." action={<a className="btn btn-primary" href="/resume">Upload your resume</a>} />}</div>
      ) : w.plan && !busy ? (
        <>
          <p className="xs muted">Made {fmtDate(w.plan.generatedAt)}. Changing your profile won't silently rewrite this — refresh when you're ready.</p>
          {tab === "career" && <Careers plan={w.plan} />}
          {tab === "skills" && <Skills plan={w.plan} />}
          {tab === "academic" && <Academic plan={w.plan} />}
        </>
      ) : null}
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
  const choose = (id?: string) => run(() => save("plan", { ...plan, chosenCareerId: id }), id ? "Direction set — you can change it anytime" : "Direction cleared");
  return (
    <div className="grid-3" style={{ alignItems: "start" }}>
      {plan.careers.map((c) => {
        const chosen = plan.chosenCareerId === c.id;
        return (
          <div key={c.id} className="card card-pad stack" style={chosen ? { borderColor: "var(--plum)", boxShadow: "0 0 0 1px var(--plum) inset" } : undefined} data-testid="card-career">
            <div className="row-between"><h3>{c.title}</h3>{chosen && <span className="chip"><Compass size={12} /> Your direction</span>}</div>
            <p className="small muted">{c.what}</p>
            <div className="stack-sm"><span className="eyebrow">Fit · from your resume</span>{c.fit.map((f, i) => <span key={i} className="small row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}><Check size={14} className="pass" style={{ marginTop: 3 }} />{f}</span>)}</div>
            <div className="stack-sm"><span className="eyebrow">Gaps</span>{c.gaps.map((f, i) => <span key={i} className="small">• {f}</span>)}</div>
            <div className="stack-sm"><span className="eyebrow">Next steps · illustrative</span>
              {c.steps.map((s, i) => (
                <div key={i} className="row small" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}><span style={{ flex: 1 }}>{s}</span><button className="icon-btn" onClick={() => add(s, `Step toward ${c.title}`, "Explore")} aria-label="Add to to-dos" title="Add to to-dos"><Plus size={15} /></button></div>
              ))}
            </div>
            <button className={"btn btn-sm " + (chosen ? "btn-secondary" : "btn-primary")} onClick={() => choose(chosen ? undefined : c.id)} data-testid="button-choose-career">{chosen ? "Change direction" : "Explore this direction"}</button>
          </div>
        );
      })}
    </div>
  );
}

function Skills({ plan }: { plan: PathPlan }) {
  const add = useAddTask();
  return (
    <div className="card card-pad">
      <table className="table">
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

function Academic({ plan }: { plan: PathPlan }) {
  const { save, run, ws, me } = useStore();
  const [term, setTerm] = useState("");
  const [items, setItems] = useState("");
  const addTerm = () => run(() => save("plan", { ...plan, academic: [...plan.academic, { id: rid("ac"), term, items: items.split("\n").map((s) => s.trim()).filter(Boolean), note: "Entered by you" }] }), "Term added").then(() => { setTerm(""); setItems(""); });
  return (
    <div className="stack">
      <div className="notice notice-warn"><div><strong>Not an official degree plan.</strong> Remy can't see your school's degree audit. Use {atTcu(me) ? "Stellic" : "your school's degree-planning tool"} and your academic advisor for requirements and graduation status — paste your plan here to keep it alongside your career steps.</div></div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        {plan.academic.map((a) => (
          <div key={a.id} className="card card-pad stack-sm">
            <div className="row-between"><h3>{a.term}</h3><button className="icon-btn" onClick={() => save("plan", { ...plan, academic: plan.academic.filter((x) => x.id !== a.id) })} aria-label="Remove term"><Trash2 size={15} /></button></div>
            {a.items.map((i, k) => <span key={k} className="small">• {i}</span>)}
            <span className={"chip " + (a.note === "Entered by you" ? "chip-student" : "chip-plain")}>{a.note === "Entered by you" ? "Entered by you" : "Illustrative suggestion"}</span>
          </div>
        ))}
        <div className="card card-pad stack-sm">
          <h3>Add a term from your plan</h3>
          <input className="input" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. Spring 2027" aria-label="Term" />
          <textarea className="textarea" value={items} onChange={(e) => setItems(e.target.value)} placeholder="One course or goal per line" aria-label="Courses" />
          <div><button className="btn btn-secondary btn-sm" onClick={addTerm} disabled={!term.trim()}>Add term</button></div>
        </div>
      </div>
    </div>
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
          {f.growing.length > 0 && <><b className="row small"><TrendingUp size={15} /> Growing</b><ul style={{ margin: 0, padding: 0, listStyle: "none" }}>{f.growing.map(row)}</ul></>}
          {f.shrinking.length > 0 && <><b className="row small"><TrendingDown size={15} /> Shrinking</b><ul style={{ margin: 0, padding: 0, listStyle: "none" }}>{f.shrinking.map(row)}</ul></>}
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
    <div className="card card-pad stack" data-testid="explore-careers">
      <div className="stack-sm">
        <h3 className="row"><HelpCircle size={18} /> Not sure what you want to do? Start here</h3>
        <p className="small muted">{browse ? `Jobs in ${browse.toLowerCase()} that hire the most people.` : p.major ? `Jobs people with your major (${p.major}) often go into, the ones that hire the most first.` : "Pick an area to see the jobs in it."} Tap one to see what the work is really like.</p>
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (typed.trim().length > 2) explain(typed.trim()); }}>
        <input className="input grow" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Heard of a job but not sure what it is? e.g. actuary, UX researcher" aria-label="Job title to explain" data-testid="input-explain" />
        <button className="btn btn-secondary btn-sm" disabled={typed.trim().length < 3 || !!asking || !config?.ai.available}>{asking === typed.trim() ? <Spinner /> : <Search size={15} />} What is it?</button>
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
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
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
        <span className="xs muted">Browse another area:</span>
        <div className="row" style={{ gap: 6 }}>
          {browse && <button className="chip" onClick={() => setBrowse("")}>My major</button>}
          {FIELD_GROUPS.flatMap(([, opts]) => opts).map((o) => <button key={o} className={"chip" + (browse === o ? " chip-live" : "")} onClick={() => setBrowse(o)}>{o}</button>)}
        </div>
      </div>
    </div>
  );
}
