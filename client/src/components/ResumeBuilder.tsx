import { FitTextarea } from "./FitTextarea";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import type { BuilderItem, ResumeBuilder as Builder, Workspace } from "@shared/types";
import { api, rid, useStore } from "../lib/store";
import { Remy, Spinner } from "./common";
import { nameConcern } from "@shared/junk";

// The buttons a student taps. Labels are what freshmen recognize as "experience".
const GROUPS: [string, [string, string][]][] = [
  ["Work", [["job", "Had a job"], ["internship", "An internship"], ["care", "Babysitting, tutoring or pet sitting"], ["family", "Family business"], ["hustle", "My own side hustle"]]],
  ["School", [["project", "A big class project"], ["research", "Research"], ["award", "An award, honor or dean's list"]]],
  ["Activities", [["club", "A club or organization"], ["sports", "A sports team"], ["faith", "Church or youth group"], ["volunteer", "Volunteering"], ["arts", "Music, theater or art"], ["greek", "Greek life"]]],
  ["Skills", [["language", "A language besides English"], ["certificate", "A certificate (CPR, Excel…)"]]],
];
const LABEL = Object.fromEntries(GROUPS.flatMap(([, ks]) => ks));
const NAME_ONLY = new Set(["language", "certificate"]);
const STEPS = ["About you", "What you've done", "Tell me more", "A few details", "Your resume"];
const YEARS = ["First-year", "Sophomore", "Junior", "Senior"];
const BLANK = /\[[^\]]*\]/;

function start(w: Workspace, email: string): Builder {
  const p = w.profile;
  return {
    step: 0, items: [], skills: [],
    basics: { name: p.name, email: p.email || email, phone: "", city: p.location, school: p.school, major: p.major, graduation: p.graduation, classYear: p.classYear, gpa: p.gpa || "", highSchool: "", highSchoolYear: "" },
  };
}

/** "Build my resume with Remy" for students with no resume or LinkedIn. Every line comes from what they say here. */
export function ResumeBuilder({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { ws, me, save, run, setWs } = useStore();
  const w = ws!;
  const [b, setB] = useState<Builder>(() => w.builder || start(w, me?.email || ""));
  const [busy, setBusy] = useState(false);
  const [typingName, setTypingName] = useState(false); // the name note waits until the student leaves the field
  const set = (patch: Partial<Builder>) => setB((x) => ({ ...x, ...patch }));
  const basics = (k: keyof Builder["basics"], v: string) => set({ basics: { ...b.basics, [k]: v } });
  const item = (id: string, patch: Partial<BuilderItem>) => set({ items: b.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  const add = (kind: string) => set({ items: [...b.items, { id: rid(), kind, stage: b.basics.classYear === "First-year" ? "high school" : "college", org: "", role: "", start: "", end: "", city: "", about: "", followups: [] }] });
  const lower = /first|soph/i.test(b.basics.classYear) || !b.basics.classYear;

  // Save, then optionally ask the server for the next part (questions or the draft).
  const go = async (step: number, call?: string) => {
    setBusy(true);
    const next = { ...b, step };
    let saved = await run(() => save("builder", next));
    if (saved && call) saved = await run(() => api<Workspace>("POST", call));
    if (saved) { setWs(saved); setB(saved.builder || next); }
    setBusy(false);
  };
  const finish = async () => {
    setBusy(true);
    const saved = (await run(() => save("builder", b))) && (await run(() => api<Workspace>("POST", "/api/builder/save"), "Your resume is ready"));
    setBusy(false);
    if (saved) { setWs(saved); onDone(); }
  };

  const valid = [
    !!(b.basics.name.trim() && b.basics.school.trim() && b.basics.classYear),
    b.items.length > 0,
    b.items.every((i) => i.org.trim() && (NAME_ONLY.has(i.kind) || i.about.trim().length >= 10)),
    true,
    !Object.values(b.draft || {}).flat().some((x) => BLANK.test(x.text)),
  ][b.step];

  return (
    <div className="stack-lg" data-testid="resume-builder">
      <div className="remy-prompt">
        <Remy size={44} mood={busy ? "think" : "wave"} />
        <div className="stack-sm">
          <span className="eyebrow">Build your resume · {b.step + 1} of {STEPS.length} · {STEPS[b.step]}</span>
          <p><b>Remy:</b> {[
            "No resume yet? No problem. Most students start here. I only write what you tell me, never anything made up.",
            "Tap everything you've done, in high school or college. More of this counts than you think.",
            "A few words about each. A sentence or two is plenty; I'll do the wording.",
            "Just a couple of specifics so your lines stand out. Skip any you're not sure about.",
            "Here's your resume, built only from your answers. Pick the wording you like and fill any blanks.",
          ][b.step]}</p>
        </div>
      </div>

      {b.step === 0 && (
        <div className="grid-2">
          {([["name", "Full name"], ["email", "Email"], ["phone", "Phone (optional)"], ["city", "City, state"], ["school", "College"], ["major", "Major (or intended major)"], ["graduation", "Expected graduation", "e.g. May 2029"], ["gpa", "GPA (optional)", "Career centers suggest listing it if it's 3.0 or higher"]] as [keyof Builder["basics"], string, string?][]).map(([k, l, hint]) => (
            <label key={k} className="field"><span>{l}</span><input className="input" value={b.basics[k]} onChange={(e) => basics(k, e.target.value)} onFocus={() => k === "name" && setTypingName(true)} onBlur={() => setTypingName(false)} data-testid={`input-builder-${k}`} />{k === "name" && !typingName && nameConcern(b.basics.name) && <span className="xs field-warn" role="note">{nameConcern(b.basics.name)}</span>}{hint && <span className="xs muted">{hint}</span>}</label>
          ))}
          <label className="field"><span>Class year</span>
            <select className="select" value={b.basics.classYear} onChange={(e) => basics("classYear", e.target.value)} data-testid="select-builder-year">
              <option value="">Choose…</option>{YEARS.map((y) => <option key={y}>{y}</option>)}
            </select>
          </label>
          {lower && <>
            <label className="field"><span>High school</span><input className="input" value={b.basics.highSchool} onChange={(e) => basics("highSchool", e.target.value)} data-testid="input-builder-highSchool" /></label>
            <label className="field"><span>High school graduation year</span><input className="input" value={b.basics.highSchoolYear} onChange={(e) => basics("highSchoolYear", e.target.value)} placeholder="e.g. 2025" /></label>
          </>}
        </div>
      )}

      {b.step === 1 && (
        <div className="stack">
          {GROUPS.map(([g, kinds]) => (
            <div key={g} className="stack-sm">
              <b className="small">{g}</b>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {kinds.map(([k, l]) => {
                  const n = b.items.filter((i) => i.kind === k).length;
                  return <button key={k} type="button" className={"chip " + (n ? "chip-student" : "chip-plain")} aria-pressed={!!n} onClick={() => (n ? set({ items: b.items.filter((i) => i.kind !== k) }) : add(k))} data-testid={`chip-${k}`}>{n ? "✓ " : ""}{l}</button>;
                })}
              </div>
            </div>
          ))}
          <p className="xs muted">Nothing here yet? Tap "A big class project" or "A club or organization". Almost every student has one.</p>
        </div>
      )}

      {b.step === 2 && (
        <div className="stack">
          {b.items.map((i) => (
            <div key={i.id} className="card card-pad stack-sm" data-testid="builder-card">
              <div className="row-between" style={{ flexWrap: "nowrap" }}><b>{LABEL[i.kind]}</b>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  {!NAME_ONLY.has(i.kind) && <select className="select" style={{ width: "auto" }} value={i.stage} onChange={(e) => item(i.id, { stage: e.target.value as BuilderItem["stage"] })} aria-label="When"><option value="high school">In high school</option><option value="college">In college</option></select>}
                  <button className="icon-btn" onClick={() => set({ items: b.items.filter((x) => x.id !== i.id) })} aria-label="Remove"><Trash2 size={16} /></button>
                </div>
              </div>
              {NAME_ONLY.has(i.kind) ? (
                <input className="input" value={i.org} onChange={(e) => item(i.id, { org: e.target.value })} placeholder={i.kind === "language" ? "e.g. Spanish (conversational)" : "e.g. CPR and First Aid, American Red Cross"} data-testid="input-card-org" />
              ) : (<>
                <div className="grid-2">
                  <input className="input" value={i.org} onChange={(e) => item(i.id, { org: e.target.value })} placeholder={i.kind === "award" ? "Award name" : "Where (place, team or organization)"} data-testid="input-card-org" />
                  <input className="input" value={i.role} onChange={(e) => item(i.id, { role: e.target.value })} placeholder={i.kind === "award" ? "Who gave it (optional)" : "Your role (e.g. Member, Cashier)"} data-testid="input-card-role" />
                  <input className="input" value={i.start} onChange={(e) => item(i.id, { start: e.target.value })} placeholder="Start (e.g. Jun 2024)" />
                  <input className="input" value={i.end} onChange={(e) => item(i.id, { end: e.target.value })} placeholder="End (or Present)" />
                </div>
                <textarea className="textarea" value={i.about} onChange={(e) => item(i.id, { about: e.target.value })} placeholder="What did you do there? A sentence or two is fine." data-testid="input-card-about" />
              </>)}
            </div>
          ))}
          <div className="row" style={{ flexWrap: "wrap" }}>
            {Array.from(new Set(b.items.map((i) => i.kind))).map((k) => <button key={k} className="btn btn-ghost btn-sm" onClick={() => add(k)}><Plus size={14} /> Another {LABEL[k].toLowerCase()}</button>)}
          </div>
        </div>
      )}

      {b.step === 3 && (
        <div className="stack">
          {b.items.filter((i) => i.followups.length).map((i) => (
            <div key={i.id} className="stack-sm">
              <b className="small">{i.org}</b>
              {i.followups.map((f, n) => (
                <label key={n} className="field"><span className="small">{f.q}</span>
                  <input className="input" value={f.a} placeholder="Skip if you're not sure" onChange={(e) => item(i.id, { followups: i.followups.map((x, m) => (m === n ? { ...x, a: e.target.value } : x)) })} data-testid="input-followup" />
                </label>
              ))}
            </div>
          ))}
          {!b.items.some((i) => i.followups.length) && <p className="small muted">No questions needed. You gave Remy plenty to work with.</p>}
        </div>
      )}

      {b.step === 4 && (
        <div className="stack">
          {b.draftedBy === "rules" && <div className="notice small"><div>The AI writer wasn't available, so these lines are your own words, tidied up. Edit them however you like.</div></div>}
          {b.items.filter((i) => !NAME_ONLY.has(i.kind) && (!upper(b) || b.keepHighSchool || i.stage !== "high school")).map((i) => (
            <div key={i.id} className="card card-pad stack-sm">
              <b>{i.role ? `${i.role}, ` : ""}{i.org} <span className="xs muted">{[i.start, i.end].filter(Boolean).join(" – ")}</span></b>
              {(b.draft?.[i.id] || []).map((x) => {
                const setText = (text: string) => set({ draft: { ...b.draft, [i.id]: b.draft![i.id].map((y) => (y.id === x.id ? { ...y, text } : y)) } });
                return (
                  <div key={x.id} className="stack-sm" data-testid="builder-bullet">
                    <div className="row">
                      <FitTextarea className="textarea" style={{ minHeight: 56, flex: 1, ...(BLANK.test(x.text) ? { borderColor: "var(--amber)" } : {}) }} value={x.text} onChange={(e) => setText(e.target.value)} aria-label="Resume line" />
                      <button className="icon-btn" aria-label="Delete line" onClick={() => set({ draft: { ...b.draft, [i.id]: b.draft![i.id].filter((y) => y.id !== x.id) } })}><Trash2 size={16} /></button>
                    </div>
                    {BLANK.test(x.text) && <span className="xs" style={{ color: "var(--amber)" }}>Replace the [blank] with the real number, or delete it.</span>}
                    {x.options.length > 1 && <div className="row" style={{ flexWrap: "wrap" }}>{x.options.map((o, n) => <button key={n} className={"chip " + (o === x.text ? "chip-student" : "chip-plain")} onClick={() => setText(o)}>Wording {n + 1}</button>)}</div>}
                    <span className="xs muted">From your words: “{x.source.slice(0, 160)}”</span>
                  </div>
                );
              })}
            </div>
          ))}
          {upper(b) && b.items.some((i) => i.stage === "high school") && (
            <label className="row small"><input type="checkbox" checked={!!b.keepHighSchool} onChange={(e) => set({ keepHighSchool: e.target.checked })} /> Keep high school activities (usually left off by junior year)</label>
          )}
          <div className="stack-sm">
            <b className="small">Skills: tick only what you can really use</b>
            <div className="row" style={{ flexWrap: "wrap" }}>
              {(b.skillSuggestions || []).map((s) => {
                const on = b.skills.includes(s);
                return <button key={s} type="button" className={"chip " + (on ? "chip-student" : "chip-plain")} aria-pressed={on} onClick={() => set({ skills: on ? b.skills.filter((x) => x !== s) : [...b.skills, s] })}>{on ? "✓ " : ""}{s}</button>;
              })}
            </div>
          </div>
        </div>
      )}

      <div className="row-between">
        <button className="btn btn-ghost" disabled={busy} onClick={() => (b.step === 0 ? onCancel() : set({ step: b.step - 1 }))}><ArrowLeft size={16} /> {b.step === 0 ? "Upload a resume instead" : "Back"}</button>
        <button className="btn btn-primary" disabled={busy || !valid} data-testid="button-builder-next"
          onClick={() => (b.step === 2 ? go(3, "/api/builder/followups") : b.step === 3 ? go(4, "/api/builder/draft") : b.step === 4 ? finish() : go(b.step + 1))}>
          {busy && <Spinner />} {b.step === 4 ? "Use this resume" : b.step === 3 ? "Write my resume" : "Next"} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

const upper = (b: Builder) => /junior|senior/i.test(b.basics.classYear);
