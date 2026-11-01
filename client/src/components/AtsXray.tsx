import { useState } from "react";
import { CheckCircle2, CircleAlert, ScanSearch } from "lucide-react";
import type { ResumeDoc, ResumeQuality } from "@shared/types";
import { rid, useStore } from "../lib/store";

/** "ATS X-Ray": Remy's own extracted view of the resume (not any employer's screen), with the lines it couldn't place
 *  (and lines from weekly check-ins: the resume inbox) and a one-click way to put each one where it belongs. Edits go into the editor below; nothing saves until Save. */
export function AtsXray({ doc, quality, upd }: { doc: ResumeDoc; quality?: ResumeQuality; upd: (fn: (d: ResumeDoc) => void) => void }) {
  const entries = doc.sections.flatMap((s, si) => s.entries.map((e, ei) => ({ si, ei, label: `${s.heading}: ${[e.role, e.org].filter(Boolean).join(", ") || "entry"}` })));
  const [target, setTarget] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const checks: [string, boolean][] = [
    ["Name", !!doc.contact.name.trim()], ["Email", /@/.test(doc.contact.email)], ["Phone", /\d{3}/.test(doc.contact.phone)],
    ["Education section", doc.sections.some((s) => /educat/i.test(s.heading))], ["Experience section", doc.sections.some((s) => /experien|employ|work/i.test(s.heading))],
    ["Dates on every entry", entries.length > 0 && doc.sections.every((s) => s.entries.every((e) => !!e.dates.trim()))], ["Skills", doc.skills.length > 0],
  ];
  const { ws, save } = useStore();
  const inbox = (ws?.tasks || []).filter((t) => t.source === "Check-in" && t.link?.startsWith("/resume") && !t.done);
  const missing = [...inbox.map((t) => t.why), ...(quality?.missingLines || [])].filter((l) => !placed.includes(l)).slice(0, 8);
  const pct = quality ? Math.round(quality.coverage * 100) : null;
  return (
    <section className="card card-pad stack-sm" data-testid="ats-xray">
      <div className="row" style={{ gap: 8 }}><ScanSearch size={18} /><h3>ATS X-Ray</h3></div>
      <p className="xs muted">What Remy read from your file{pct !== null ? `: ${pct}% of its words landed in a section` : ""}. Applicant tracking systems differ, so treat this as Remy's view, not an employer's screen.</p>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        {checks.map(([label, ok]) => <span key={label} className={"chip " + (ok ? "chip-live" : "chip-setup")}>{ok ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />} {label}</span>)}
      </div>
      {missing.length > 0 && entries.length > 0 && (
        <div className="stack-sm">
          <span className="small"><b>{inbox.length ? "Lines to add." : "Lines Remy couldn't place."}</b> Add the ones that matter to the right entry, then save.</span>
          <label className="xs muted row" style={{ gap: 6 }}>Add to
            <select className="input" style={{ width: "auto", maxWidth: 360 }} value={target} onChange={(e) => setTarget(Number(e.target.value))} aria-label="Entry to add lines to">
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
