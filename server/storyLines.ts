import type { ResumeDoc } from "@shared/types";

/** The resume lines a story can come from: things the student did. Not course lists, GPA or honors lines, skills or
 *  certifications (audit, Nov 17: Chris got "Relevant coursework" as a story). Class projects under Education count. */
export function storyLines(doc: ResumeDoc): { where: string; text: string }[] {
  return doc.sections
    .filter((s) => !/skill|certif|^\s*(?:relevant\s+)?course/i.test(s.heading))
    .flatMap((s) => s.entries.flatMap((e) => e.bullets
      .filter((b) => !/^\s*(?:relevant\s+)?(?:course\s*work|courses)\b|^\s*(?:gpa|dean'?s list|honou?rs)\b/i.test(b.text))
      .map((b) => ({ where: [e.role, e.org].filter(Boolean).join(" at "), text: b.text }))));
}
