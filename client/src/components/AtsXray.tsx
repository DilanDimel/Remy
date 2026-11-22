import { useState } from "react";
import { CheckCircle2, CircleAlert, Eye, ScanSearch } from "lucide-react";
import type { ResumeDoc, ResumeQuality } from "@shared/types";
import { rid, useOwnerView, useStore } from "../lib/store";

/** "ATS X-Ray": Remy's own extracted view of the resume (not any employer's screen), with the lines it couldn't place
 *  (and lines from weekly check-ins: the resume inbox) and a one-click way to put each one where it belongs. Edits go into the editor below; nothing saves until Save. */
export function AtsXray({ doc, quality, upd }: { doc: ResumeDoc; quality?: ResumeQuality; upd: (fn: (d: ResumeDoc) => void) => void }) {
  const entries = doc.sections.flatMap((s, si) => s.entries.map((e, ei) => ({ si, ei, label: `${s.heading}: ${[e.role, e.org].filter(Boolean).join(", ") || "entry"}` })));
  const [target, setTarget] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const [glance, setGlance] = useState(false);
  // "May 2024" vs "05/2024" vs "Summer 2024": recruiters notice mixed date styles. "Present" and bare years fit any style.
  const dateStyle = (d: string) => /\d{1,2}\/\d{2,4}/.test(d) ? "numeric" : /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}/i.test(d) ? "month" : /\b(spring|summer|fall|autumn|winter)\b/i.test(d) ? "season" : "";
  const styles = new Set(doc.sections.flatMap((s) => s.entries.map((e) => dateStyle(e.dates))).filter(Boolean));
  const checks: [string, boolean][] = [
    ["Name", !!doc.contact.name.trim()], ["Email", /@/.test(doc.contact.email)], ["Phone", /\d{3}/.test(doc.contact.phone)],
    ["Education section", doc.sections.some((s) => /educat/i.test(s.heading))], ["Experience section", doc.sections.some((s) => /experien|employ|work/i.test(s.heading))],
    ["Dates on every entry", entries.length > 0 && doc.sections.every((s) => s.entries.every((e) => !!e.dates.trim()))], ["Skills", doc.skills.length > 0],
    ["Same date format everywhere", styles.size <= 1],
  ];
  const { ws, save } = useStore();
  const honest = useOwnerView(); // redesign stage 3 (owners first): the ATS check says plainly what it is, with sources
  const inbox = (ws?.tasks || []).filter((t) => t.source === "Check-in" && t.link?.startsWith("/resume") && !t.done);
  const missing = [...inbox.map((t) => t.why), ...(quality?.missingLines || [])].filter((l) => !placed.includes(l)).slice(0, 8);
  const pct = quality ? Math.round(quality.coverage * 100) : null;
  return (
    <section className="card card-pad stack-sm" data-testid="ats-xray">
      <div className="row" style={{ gap: 8 }}><ScanSearch size={18} /><h3>ATS X-Ray</h3></div>
      {honest ? (
        <p className="xs muted" data-testid="ats-honest">
          <b>A general check, not this employer's system.</b> Remy reads your file the way common applicant tracking systems such as Workday pull text into fields (name, sections, dates){pct !== null ? `; ${pct}% of your words landed in a section` : ""}. Each company sets up its own system, so no tool can promise how yours will score. Sources: <a href="https://www.workday.com/en-us/topics/hr/applicant-tracking-system.html" target="_blank" rel="noreferrer">Workday on ATS parsing</a>, <a href="https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/set-up-prospects-and-candidates/hdc1552497830785.html" target="_blank" rel="noreferrer">Workday resume parsing docs</a>.
        </p>
      ) : (
        <p className="xs muted">What Remy read from your file{pct !== null ? `: ${pct}% of its words landed in a section` : ""}. Applicant tracking systems differ, so treat this as Remy's view, not an employer's screen.</p>
      )}
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {checks.map(([label, ok]) => <span key={label} className={"chip " + (ok ? "chip-live" : "chip-setup")}>{ok ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />} {label}</span>)}
      </div>
      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} aria-pressed={glance} onClick={() => setGlance(!glance)} data-testid="button-six-second"><Eye size={14} /> {glance ? "Hide the 6-second view" : "6-second view"}</button>
      {glance && (
        <div className="stack-sm" style={{ borderLeft: "3px solid var(--line)", paddingLeft: 12 }} data-testid="six-second-view">
          <span className="xs muted">Recruiters often decide in about 7 seconds whether to keep reading, and their eyes go to names, titles, employers and dates. If this alone doesn't tell your story, move your strongest title or employer up.</span>
          <b>{doc.contact.name || "Your name"}</b>
          {doc.sections.map((s) => (
            <div key={s.id} className="stack-sm" style={{ gap: 2 }}>
              <span className="xs" style={{ fontWeight: 600, textTransform: "uppercase" }}>{s.heading}</span>
              {s.entries.map((e) => (
                <div key={e.id} className="small">
                  <b>{[e.role, e.org].filter(Boolean).join(", ")}</b>{e.dates && <span className="muted"> · {e.dates}</span>}
                  {e.bullets.length > 0 && <div aria-hidden="true" style={{ filter: "blur(3px)", userSelect: "none" }} className="xs muted">{e.bullets.slice(0, 2).map((b) => b.text).join(" ")}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {!styles.size || styles.size <= 1 ? null : <p className="xs muted">Your dates mix styles ({[...styles].map((x) => (x === "numeric" ? "05/2024" : x === "month" ? "May 2024" : "Summer 2024")).join(", ")}). Pick one and use it everywhere.</p>}
      {missing.length > 0 && entries.length > 0 && (
        <div className="stack-sm">
          <span className="small"><b>{inbox.length ? "Lines to add." : "Lines Remy couldn't place."}</b> Add the ones that matter to the right entry, then save.</span>
          <label className="xs muted row" style={{ gap: 6 }}>Add to
            <select className="input" style={{ width: "auto", maxWidth: "min(360px, 100%)", minWidth: 0 }} value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="Entry to add lines to">
              {entries.map((e, i) => <option key={i} value={i}>{e.label}</option>)}
            </select>
          </label>
          {missing.map((l) => (
            <div key={l} className="row-between small" style={{ gap: 8, flexWrap: "nowrap" }}>
              <span className="quote" style={{ flex: 1 }}>{l}{inbox.some((t) => t.why === l) && <span className="xs muted"> · from your check-in</span>}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const t = entries[target]; upd((d) => { d.sections[t.si].entries[t.ei].bullets.push({ id: rid("b"), text: l.replace(/^[•\-*–]\s*/, ""), verified: true }); }); setPlaced([...placed, l]);
                if (ws && inbox.some((x) => x.why === l)) save("tasks", ws.tasks.map((x) => (x.source === "Check-in" && x.why === l ? { ...x, done: true } : x))).catch(() => {});
              }} data-testid="button-xray-add">Add as bullet</button>
            </div>
          ))}
        </div>
      )}
      {quality?.warnings?.map((w) => <p key={w} className="xs muted">{w}</p>)}
    </section>
  );
}
