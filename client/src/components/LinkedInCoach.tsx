import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Linkedin, Plus } from "lucide-react";
import { LINKEDIN_RECHECK_DAYS, linkedinBasics, linkedinGaps } from "@shared/linkedin";
import { daysUntil, rid, useStore } from "../lib/store";
import { CopyButton } from "./common";
import { ProfileImport } from "./Uploaders";

/** LinkedIn coach: what's on the resume but not on LinkedIn, with each field ready to paste.
 *  LinkedIn doesn't let apps edit profiles, so the student pastes; Remy never signs in for them. */
export function LinkedInCoach() {
  const { ws, save, run } = useStore();
  const w = ws!;
  const [open, setOpen] = useState<number | null>(null);
  const li = w.linkedin;
  const doc = w.resume?.doc;
  const age = li ? -(daysUntil(li.at) ?? 0) : 0;
  const upload = <ProfileImport kind="LinkedIn profile (PDF)" hint="On LinkedIn (on a computer): your profile → Resources → Save to PDF. Then upload Profile.pdf here." />;
  if (!doc) return null;
  if (!li) return (
    <section className="card card-pad stack-sm" data-testid="linkedin-coach">
      <h3 className="row"><Linkedin size={18} /> LinkedIn coach</h3>
      <p className="small muted">Upload your LinkedIn PDF and Remy lists what's on your resume but missing from LinkedIn, with the words ready to paste.</p>
      {upload}
    </section>
  );
  const gaps = linkedinGaps(doc, li.text);
  const basics = linkedinBasics(li.text);
  const addTodo = (title: string, why: string) => w.tasks.some((t) => t.title === title && !t.done)
    ? run(async () => { throw new Error("That's already on your to-do list."); })
    : run(() => save("tasks", [{ id: rid("t"), title, why, due: "", category: "Prepare" as const, done: false, source: "LinkedIn coach" }, ...w.tasks]), "Added to your to-dos");
  return (
    <section className="card card-pad stack-sm" data-testid="linkedin-coach">
      <div className="row-between"><h3 className="row"><Linkedin size={18} /> LinkedIn coach</h3><span className="xs muted">Checked {age === 0 ? "today" : `${age} day${age === 1 ? "" : "s"} ago`}</span></div>
      {age >= LINKEDIN_RECHECK_DAYS && <div className="notice small" data-testid="linkedin-stale">It's been over a month. Save a fresh PDF from LinkedIn and upload it to re-check.</div>}
      <div className="stack-sm" style={{ gap: 4 }}>
        {basics.map((b) => (
          <div key={b.label} className="row small" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 8 }}>
            <span style={{ flex: "none", width: 16, marginTop: 2, color: b.ok ? "var(--success, #22a05a)" : b.ok === false ? "var(--amber)" : "var(--muted-text)" }}>{b.ok ? <Check size={14} /> : b.ok === false ? "!" : "?"}</span>
            <span><b>{b.label}</b>{!b.ok && <span className="muted"> · {b.tip}</span>}</span>
          </div>
        ))}
      </div>
      <b className="small" data-testid="linkedin-gap-count">{gaps.length ? `On your resume but not on LinkedIn (${gaps.length})` : "Everything on your resume is on LinkedIn."}</b>
      {gaps.map((g, i) => (
        <div key={g.section + g.title} className="card card-pad stack-sm" style={{ boxShadow: "none", padding: 10 }} data-testid="linkedin-gap">
          <button className="row-between small" style={{ textAlign: "left", gap: 8, flexWrap: "nowrap" }} onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <span><span className="chip chip-plain">{g.section}</span> {g.title}</span>{open === i ? <ChevronUp size={16} style={{ flex: "none" }} /> : <ChevronDown size={16} style={{ flex: "none" }} />}
          </button>
          {open === i && <>
            <span className="xs muted">On LinkedIn: your profile → Add profile section → {g.section}. Paste each field:</span>
            {g.fields.map((f) => (
              <div key={f.label} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 8 }}>
                <span className="xs" style={{ flex: 1, minWidth: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}><b>{f.label}:</b> {f.value}</span>
                <CopyButton text={f.value} />
              </div>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => addTodo(`Add to LinkedIn: ${g.section}: ${g.title}`, g.fields.map((f) => `${f.label}: ${f.value}`).join("\n"))}><Plus size={14} /> Do it later (to-do)</button>
          </>}
        </div>
      ))}
      <details className="xs muted"><summary>Upload a newer LinkedIn PDF</summary>{upload}</details>
      <p className="xs muted">Remy only compares the two. When they disagree, you decide which is right.</p>
    </section>
  );
}
