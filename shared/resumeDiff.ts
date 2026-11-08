// What changed between two versions of a base resume, so the student sees every edit before saving it
// (a teammate's idea, Nov 7). Matched by id, so a reworded line shows as "changed", not "removed + added".
import type { ResumeDoc } from "./types";

export type ResumeChange = { kind: "added" | "removed" | "changed"; where: string; before: string; after: string };

export function resumeDiff(before: ResumeDoc, after: ResumeDoc): ResumeChange[] {
  const out: ResumeChange[] = [];
  const same = (a: string, b: string) => (a || "").trim() === (b || "").trim();
  const field = (where: string, a: string, b: string) => {
    if (same(a, b)) return;
    out.push({ kind: !a.trim() ? "added" : !b.trim() ? "removed" : "changed", where, before: a.trim(), after: b.trim() });
  };
  const contactLabels: [keyof ResumeDoc["contact"], string][] = [["name", "Name"], ["email", "Email"], ["phone", "Phone"], ["location", "Location"], ["links", "Links"]];
  for (const [k, label] of contactLabels) field(`Contact · ${label}`, before.contact[k] || "", after.contact[k] || "");

  const oldSections = new Map(before.sections.map((s) => [s.id, s]));
  for (const s of after.sections) {
    const o = oldSections.get(s.id);
    if (!o) {
      out.push({ kind: "added", where: "Section", before: "", after: s.heading || "(new section)" });
      for (const e of s.entries) {
        const name = [e.role, e.org].filter(Boolean).join(", ") || s.heading;
        if (name) out.push({ kind: "added", where: s.heading, before: "", after: name });
        for (const b of e.bullets) if (b.text.trim()) out.push({ kind: "added", where: name, before: "", after: b.text.trim() });
      }
      continue;
    }
    field("Section heading", o.heading, s.heading);
    const oldEntries = new Map(o.entries.map((e) => [e.id, e]));
    for (const e of s.entries) {
      const oe = oldEntries.get(e.id);
      const name = [e.role, e.org].filter(Boolean).join(", ") || s.heading;
      if (!oe) { out.push({ kind: "added", where: s.heading, before: "", after: name || "(new entry)" }); for (const b of e.bullets) if (b.text.trim()) out.push({ kind: "added", where: name, before: "", after: b.text.trim() }); continue; }
      field(`${name} · Organization`, oe.org, e.org);
      field(`${name} · Role`, oe.role, e.role);
      field(`${name} · Location`, oe.location, e.location);
      field(`${name} · Dates`, oe.dates, e.dates);
      const oldBullets = new Map(oe.bullets.map((b) => [b.id, b]));
      for (const b of e.bullets) {
        const ob = oldBullets.get(b.id);
        if (!ob) { if (b.text.trim()) out.push({ kind: "added", where: name, before: "", after: b.text.trim() }); }
        else field(name, ob.text, b.text);
      }
      const kept = new Set(e.bullets.map((b) => b.id));
      for (const b of oe.bullets) if (!kept.has(b.id) && b.text.trim()) out.push({ kind: "removed", where: name, before: b.text.trim(), after: "" });
    }
    const keptEntries = new Set(s.entries.map((e) => e.id));
    for (const e of o.entries) if (!keptEntries.has(e.id)) out.push({ kind: "removed", where: s.heading, before: [e.role, e.org].filter(Boolean).join(", ") || "(entry)", after: "" });
  }
  const keptSections = new Set(after.sections.map((s) => s.id));
  for (const s of before.sections) if (!keptSections.has(s.id)) out.push({ kind: "removed", where: "Section", before: s.heading || "(section)", after: "" });

  const oldSkills = new Map(before.skills.map((k) => [k.id, k]));
  for (const k of after.skills) {
    const o = oldSkills.get(k.id);
    if (!o) { if (k.items.trim()) out.push({ kind: "added", where: `Skills · ${k.label || "new line"}`, before: "", after: k.items.trim() }); continue; }
    field("Skills · group name", o.label, k.label);
    field(`Skills · ${k.label || o.label}`, o.items, k.items);
  }
  const keptSkills = new Set(after.skills.map((k) => k.id));
  for (const k of before.skills) if (!keptSkills.has(k.id) && k.items.trim()) out.push({ kind: "removed", where: `Skills · ${k.label}`, before: k.items.trim(), after: "" });
  return out;
}
