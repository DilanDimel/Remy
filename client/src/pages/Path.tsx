import { useState } from "react";
import { Check, Compass, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import type { PathPlan, Task, Workspace } from "@shared/types";
import { api, fmtDate, rid, useStore } from "../lib/store";
import { go } from "../lib/router";
import { AiUnavailableNote, Empty, Remy, Spinner } from "../components/common";

type Tab = "academic" | "career" | "skills";

export default function PathPage({ query }: { query: URLSearchParams }) {
  const { ws, setWs, run, config } = useStore();
  const w = ws!;
  const tab = (query.get("tab") as Tab) || "career";
  const [busy, setBusy] = useState(false);
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
        <button className="btn btn-secondary" onClick={generate} disabled={busy || !config?.ai.available} data-testid="button-refresh-path">{busy ? <Spinner /> : w.plan ? <RotateCcw size={16} /> : <Sparkles size={16} />} {w.plan ? "Refresh suggestions" : "Build my path"}</button>
      </div>
      {!config?.ai.available && <AiUnavailableNote />}
      <div className="tabs" role="tablist">
        {([["career", "Career exploration"], ["skills", "Skills & certifications"], ["academic", "Academic plan"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(`/path?tab=${k}`)} data-testid={`tab-path-${k}`}>{l}</button>
        ))}
      </div>
      {busy && <div className="card card-pad row"><Remy size={40} mood="think" /><span className="muted">Building suggestions from your resume and answers…</span></div>}
      {!w.plan && !busy ? (
        <div className="card"><Empty title="No path yet" body="Remy will suggest roles, skills and next steps based on your resume and goals." action={<button className="btn btn-primary" onClick={generate} disabled={!config?.ai.available}>Build my path</button>} /></div>
      ) : w.plan && !busy ? (
        <>
          <p className="xs muted">Generated {fmtDate(w.plan.generatedAt)} by {w.plan.generatedBy}. Changing your profile won't silently rewrite this — refresh when you're ready.</p>
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
  const { save, run } = useStore();
  const [term, setTerm] = useState("");
  const [items, setItems] = useState("");
  const addTerm = () => run(() => save("plan", { ...plan, academic: [...plan.academic, { id: rid("ac"), term, items: items.split("\n").map((s) => s.trim()).filter(Boolean), note: "Entered by you" }] }), "Term added").then(() => { setTerm(""); setItems(""); });
  return (
    <div className="stack">
      <div className="notice notice-warn"><div><strong>Not an official degree plan.</strong> Remy can't see TCU's degree audit. Use Stellic and your academic advisor for requirements and graduation status — paste your plan here to keep it alongside your career steps.</div></div>
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
