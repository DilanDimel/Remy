import type { ResumeDoc } from "@shared/types";

/** The resume lines a story can come from: things the student did. Not course lists, GPA or honors lines, skills or
 *  certifications (audit, Nov 17: Chris got "Relevant coursework" as a story). Class projects under Education count. */
export function storyLines(doc: ResumeDoc): { where: string; text: string }[] {
  return doc.sections
    // Only headings that are nothing but a list (skills, certifications, courses): "Leadership, Skills & Activities"
    // or "Coursework & Projects" hold real experience and stay.
    .filter((s) => !s.heading.split(/\s*(?:&|\band\b|,|\/|\|)\s*/i).filter(Boolean).every((part) => /^(?:technical\s+|relevant\s+|computer\s+|additional\s+)?(?:skills?|certifications?|licen[cs]es?|training|course\s*work|courses|proficienc\w*|languages?|interests|tools|software|expertise|abilities|awards?|honou?rs)$/i.test(part.trim())))
    .flatMap((s) => s.entries.flatMap((e) => e.bullets
      .filter((b) => b.text.trim() && !/^\s*(?:relevant\s+)?(?:course\s*work|courses)\b|^\s*(?:gpa|dean'?s list)\b|^\s*(?:honou?rs|awards?|(?:computer\s+|technical\s+)?skills?|certifications?|interests|languages?|tools|software|programming)\s*[:\-–]/i.test(b.text))
      .map((b) => ({ where: [e.role, e.org].filter(Boolean).join(" at "), text: b.text }))));
}
