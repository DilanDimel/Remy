// One experience told as a story (Julio's user testing, Nov 27): the approved lines become a new resume entry.
// Shared so the website and the app add it the same way.
import type { BuilderItem, ResumeDoc } from "./types";

/** Which resume section each kind of experience feeds. Languages and certificates become skill lines instead. */
export const SECTION_OF: Record<string, string> = {
  job: "Experience", internship: "Experience", care: "Experience", family: "Experience", hustle: "Experience",
  club: "Leadership & Activities", sports: "Leadership & Activities", faith: "Leadership & Activities", arts: "Leadership & Activities", greek: "Leadership & Activities",
  volunteer: "Community Service", project: "Projects", research: "Projects", award: "Honors & Awards",
};

const id = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Adds the approved lines as a new entry at the top of its section, creating the section after Education. */
export function addStoryEntry(doc: ResumeDoc, item: Pick<BuilderItem, "kind" | "org" | "role" | "start" | "end" | "city">, lines: string[]): ResumeDoc {
  const heading = SECTION_OF[item.kind] || "Experience";
  const entry = {
    id: id("e"), org: item.org.trim(), role: item.role.trim(), location: item.city.trim(),
    dates: [item.start, item.end].map((x) => x.trim()).filter(Boolean).join(" – "),
    bullets: lines.map((t) => t.trim()).filter(Boolean).map((text) => ({ id: id("b"), text })),
  };
  const sections = doc.sections.map((s) => ({ ...s, entries: [...s.entries] }));
  const at = sections.find((s) => s.heading.trim().toLowerCase() === heading.toLowerCase());
  if (at) at.entries.unshift(entry);
  else sections.splice(sections.findIndex((s) => /education/i.test(s.heading)) + 1, 0, { id: id("s"), heading, entries: [entry] });
  return { ...doc, sections };
}
