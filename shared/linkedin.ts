import type { ResumeDoc } from "./types";

// LinkedIn coach: what's on the resume but not on the student's LinkedIn PDF, with the exact words to paste.
// No AI: every value comes from the student's own resume, and fields the resume reader guessed are left blank.
export type LinkedInGap = { section: string; title: string; fields: { label: string; value: string }[] };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sectionOf = (heading: string) =>
  /volunt|service|community/i.test(heading) ? "Volunteering" : /project/i.test(heading) ? "Projects" : /honou?r|award/i.test(heading) ? "Honors & awards"
    : /certif|licen/i.test(heading) ? "Licenses & certifications" : /educat/i.test(heading) ? "Education"
    : /leader|activit|organi[sz]|involve|club|extracurric/i.test(heading) ? "Organizations" : "Experience";

export function linkedinGaps(doc: ResumeDoc, li: string): LinkedInGap[] {
  const hay = " " + norm(li) + " ";
  const out: LinkedInGap[] = [];
  for (const s of doc.sections) {
    if (/skill/i.test(s.heading)) continue;
    const section = sectionOf(s.heading);
    for (const e of s.entries) {
      const org = e.unverified?.includes("org") ? "" : e.org.trim(), role = e.unverified?.includes("role") ? "" : e.role.trim();
      const key = norm(org || role);
      // Already on LinkedIn when the organization (or, without one, the title) appears anywhere in the PDF. Either half of
      // "TCU NABA (National Association of Black Accountants)" counts; a short part like "TCU" alone is too common to.
      const parts = (org || role).split(/[–—()|,]/).map(norm).filter((x) => x.length >= 6);
      if (key.length < 3 || [key, ...parts].some((k) => hay.includes(" " + k + " "))) continue;
      const desc = e.bullets.map((b) => "• " + b.text.trim()).filter((b) => b.length > 2).join("\n");
      const f = (label: string, value: string) => ({ label, value });
      const fields = {
        Experience: [f("Title", role), f("Company or organization", org), f("Location", e.location), f("Dates", e.dates), f("Description", desc)],
        Volunteering: [f("Organization", org), f("Role", role), f("Dates", e.dates), f("Description", desc)],
        Projects: [f("Project name", role || org), f("Dates", e.dates), f("Description", desc)],
        "Honors & awards": [f("Title", role || org), f("Issued by", role ? org : ""), f("Date", e.dates), f("Description", desc)],
        "Licenses & certifications": [f("Name", role || org), f("Issuing organization", role ? org : ""), f("Issue date", e.dates)],
        Organizations: [f("Organization", org), f("Position held", role), f("Dates", e.dates), f("Description", desc)],
        Education: [f("School", org), f("Degree", role), f("Dates", e.dates)],
      }[section]!.filter((x) => x.value.trim());
      out.push({ section, title: [role, org].filter(Boolean).join(", "), fields });
    }
  }
  return out;
}

/** The profile basics LinkedIn's PDF can show: an About section, skills and experience. Null = the PDF can't tell (photo). */
export function linkedinBasics(li: string): { label: string; ok: boolean | null; tip: string }[] {
  const has = (re: RegExp) => re.test(li);
  return [
    { label: "About section", ok: has(/^\s*(summary|about)\s*$/im), tip: "Two or three sentences in your own words: what you study, what you've done, what you want next." },
    { label: "Skills listed", ok: has(/^\s*(top skills|skills)\s*$/im), tip: "Add at least 5 skills that are also on your resume." },
    { label: "Experience listed", ok: has(/^\s*experience\s*$/im), tip: "Add your jobs, internships and leadership roles; the list below has the words ready." },
    { label: "Profile photo", ok: null, tip: "The PDF doesn't show photos, so check this one yourself: a clear, friendly headshot." },
  ];
}

/** LinkedIn changes faster than a resume: ask for a fresh PDF once a month. */
export const LINKEDIN_RECHECK_DAYS = 30;
