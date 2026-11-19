import type { ResumeDoc } from "@shared/types";

/** The resume lines a story can come from: things the student did. Not course lists, GPA or honors lines, skills or
 *  certifications (audit, Nov 17: Chris got "Relevant coursework" as a story). Class projects under Education count. */
export function storyLines(doc: ResumeDoc): { where: string; text: string }[] {
  return doc.sections
    // Only headings that are nothing but a list (skills, certifications, courses): "Leadership, Skills & Activities"
    // or "Coursework & Projects" hold real experience and stay.
    .filter((s) => !/^\s*(?:technical\s+|relevant\s+|computer\s+|additional\s+)?(?:skills?|certifications?|course\s*work|courses|technical\s+proficienc\w*|proficienc\w*|languages?|interests|tools|software)(?:\s*(?:&|and|,)\s*(?:skills?|certifications?|interests|tools|languages?|software))*\s*$/i.test(s.heading))
    .flatMap((s) => s.entries.flatMap((e) => e.bullets
      .filter((b) => !/^\s*(?:relevant\s+)?(?:course\s*work|courses)\b|^\s*(?:gpa|dean'?s list)\b|^\s*(?:honou?rs|awards?|skills?|technical skills|certifications?|interests|languages?|tools|software)\s*[:\-–]/i.test(b.text))
      .map((b) => ({ where: [e.role, e.org].filter(Boolean).join(" at "), text: b.text }))));
}
