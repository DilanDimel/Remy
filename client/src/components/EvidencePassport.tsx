import { BadgeCheck, CircleDashed } from "lucide-react";
import type { MemoryFact, ResumeDoc } from "@shared/types";
import { splitList } from "@shared/words";

/** Evidence Passport: each skill on the resume next to the line that proves it (a bullet, a role, or an approved
 *  fact), or "no example yet". Missing data isn't missing experience, so it asks rather than judges. */
export function EvidencePassport({ doc, memory }: { doc: ResumeDoc; memory: MemoryFact[] }) {
  const lines = [
    ...doc.sections.flatMap((s) => s.entries.flatMap((e) => [[e.role, e.org].filter(Boolean).join(", "), ...e.bullets.map((b) => b.text)])),
    ...memory.filter((m) => m.status === "approved").map((m) => m.text),
  ].filter(Boolean);
  // "Excel (pivot tables, VLOOKUP)" is one skill, Excel; "R (beginner)" is R (one-letter languages count).
  const skills = [...new Set(doc.skills.flatMap((k) => splitList(k.items)).map((x) => x.replace(/\(.*?\)/g, "").trim()).filter((x) => x.length > 1 || /^[A-Z]$/.test(x)))].slice(0, 16);
  if (!skills.length) return null;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const proof = (skill: string) => lines.find((l) => new RegExp(`(^|[^a-z0-9])${esc(skill.toLowerCase())}($|[^a-z0-9])`).test(l.toLowerCase()));
  const rows = skills.map((s) => ({ s, p: proof(s) }));
  const backed = rows.filter((r) => r.p).length;
  return (
    <section className="card card-pad stack-sm" data-testid="evidence-passport">
      <h3>Evidence passport</h3>
      <p className="xs muted">{backed} of {rows.length} skills have an example on your resume. Recruiters trust a skill more when a bullet shows you using it. For the rest, add a bullet only if it's true, or tell Remy about it in chat.</p>
      <div className="stack-sm">
        {rows.map(({ s, p }) => (
          <div key={s} className="row small" style={{ gap: 8, flexWrap: "nowrap", alignItems: "flex-start" }}>
            {p ? <BadgeCheck size={16} className="pass" style={{ flex: "none", marginTop: 2 }} /> : <CircleDashed size={16} className="muted" style={{ flex: "none", marginTop: 2 }} />}
            <span style={{ minWidth: 120, fontWeight: 700 }}>{s}</span>
            <span className={p ? "" : "muted"}>{p ? `“${p.length > 110 ? p.slice(0, 110) + "…" : p}”` : "No example saved yet"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
