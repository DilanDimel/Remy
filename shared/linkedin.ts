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
    { label: "Profile photo", ok: null, tip: "Remy can't see your photo: LinkedIn leaves it out of the PDF. If you have a clear, friendly headshot, you're set." },
  ];
}

/** LinkedIn changes faster than a resume: ask for a fresh PDF once a month. */
export const LINKEDIN_RECHECK_DAYS = 30;

// ---- What the LinkedIn PDF itself shows (headline, web address, top skills, About), so the coach can be specific.
// The PDF's text comes out as: Contact … Top Skills … Languages/Certifications/Honors … Name, Headline (may wrap),
// Location, Summary, Experience … Nothing here is guessed: a part that can't be read for sure is left empty (null).
const LEFT_HEADINGS = /^(contact|top skills|languages|certifications|honors-awards|publications|patents|courses)$/i;
const MAIN_HEADINGS = /^(summary|experience|education)$/i;
// "Fort Worth, Texas, United States", "Dallas-Fort Worth Metroplex", "Greater Houston", "United States".
const LOCATION = /,|\bunited states\b|\bmetroplex\b|\barea\b|^greater\s/i;
export type LinkedInParsed = { slug: string; topSkills: string[]; headline: string | null; about: string };

const fold = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z\s'-]/g, " ").replace(/\s+/g, " ").trim();
/** Same person's name: first and last words match (middle names/initials, accents and "(She/Her)" ignored). */
function sameName(a: string, b: string) {
  const x = fold(a).split(" "), y = fold(b).split(" ");
  return x.length >= 2 && y.length >= 2 && x[0] === y[0] && x[x.length - 1] === y[y.length - 1];
}

export function parseLinkedin(text: string, names: string[]): LinkedInParsed {
  const lines = text.replace(/&amp;/g, "&").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^page \d+ of \d+$/i.test(l));
  // Web address: may wrap onto following lines (no spaces in them) until "(LinkedIn)".
  let slug = "";
  const u = lines.findIndex((l) => /linkedin\.com\/in\//i.test(l));
  if (u >= 0) {
    let s = lines[u].replace(/^.*linkedin\.com\/in\//i, "");
    for (let i = u + 1; !/\(LinkedIn\)/i.test(s) && i < Math.min(lines.length, u + 4); i++) {
      const next = lines[i].replace(/\s*\(LinkedIn\).*$/i, "");
      if (LEFT_HEADINGS.test(lines[i]) || /\s/.test(next)) break;
      s += lines[i];
    }
    slug = s.replace(/\s*\(LinkedIn\).*$/i, "").replace(/\s+/g, "").replace(/\/$/, "");
  }
  const n = lines.findIndex((l) => names.some((nm) => nm && sameName(nm, l)));
  const t = lines.findIndex((l) => /^top skills$/i.test(l));
  const topSkills: string[] = [];
  if (t >= 0) for (let i = t + 1; i < lines.length && i !== n && !LEFT_HEADINGS.test(lines[i]) && !MAIN_HEADINGS.test(lines[i]) && !/\|/.test(lines[i]) && topSkills.length < 3; i++) topSkills.push(lines[i]);
  // Headline: the lines between the student's name and their location (the line before Summary/Experience).
  let headline: string | null = null;
  const end = n >= 0 ? lines.findIndex((l, i) => i > n && MAIN_HEADINGS.test(l)) : -1;
  if (n >= 0 && end > n) {
    const between = lines.slice(n + 1, end);
    const hasLoc = between.length >= 2 || (between.length === 1 && LOCATION.test(between[0]) && !/[|@]/.test(between[0]));
    headline = (hasLoc ? between.slice(0, -1) : between).join(" ").replace(/\s+\|/g, " |").replace(/\s+/g, " ").trim();
  }
  let about = "";
  const s = lines.findIndex((l) => /^summary$/i.test(l));
  if (s >= 0) { const e = lines.findIndex((l, i) => i > s && /^(experience|education)$/i.test(l)); about = lines.slice(s + 1, e > s ? e : undefined).join(" ").replace(/\s+/g, " ").trim(); }
  return { slug, topSkills, headline, about };
}

export type LinkedInTip = { key: "headline" | "url" | "skills" | "about"; ok: boolean; title: string; detail: string; suggestion?: string };
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Specific coaching from what the PDF shows. `facts` come only from the student's resume and profile; `role` is a
 *  current role the resume reader didn't guess (or ""). */
export function linkedinTips(p: LinkedInParsed, facts: { major: string; school: string; role: string; resumeSkills: string[] }): LinkedInTip[] {
  const tips: LinkedInTip[] = [];
  const pieces = [facts.major && facts.school ? `${facts.major} student at ${facts.school}` : "", facts.role].filter(Boolean);
  const suggestion = pieces.length === 2 ? pieces.join(" | ").slice(0, 220) : undefined;
  if (p.headline === null) {
    // Couldn't read it for sure: say so, never "you have no headline".
    if (suggestion) tips.push({ key: "headline", ok: false, title: "Remy couldn't read your headline from the PDF", detail: "If it's just “Student at …”, a specific one helps you show up in recruiter searches. An idea from your resume:", suggestion });
  } else {
    // Generic: empty, or only "Student"/"Student at X"/"Aspiring X" with no role or org named.
    const generic = !p.headline || (/^(aspiring\b|student\b|.{0,40}\bstudent( at .{0,60})?$)/i.test(p.headline) && !/[|@]/.test(p.headline));
    tips.push(generic
      ? { key: "headline", ok: false, title: p.headline ? `Your headline is generic: “${p.headline}”` : "Your headline is empty", detail: "It's the line recruiters see next to your name in search. Say what you study and one role you hold. Edit it to sound like you.", suggestion }
      : { key: "headline", ok: true, title: `Headline: “${p.headline.length > 90 ? p.headline.slice(0, 88) + "…" : p.headline}”`, detail: "Specific: people can tell what you do." });
  }
  // Web address: LinkedIn's default ends in a random code like "-3a9f21b7" (letters and digits mixed).
  if (p.slug) {
    const code = p.slug.match(/-([0-9a-z]{6,})$/i)?.[1] || "";
    const random = /\d/.test(code) && /[a-z]/i.test(code);
    tips.push(random
      ? { key: "url", ok: false, title: `Your web address looks like LinkedIn's default: linkedin.com/in/${p.slug}`, detail: "A clean one looks better on your resume. On LinkedIn: your profile → Edit public profile & URL → Edit your custom URL (e.g. your first and last name)." }
      : { key: "url", ok: true, title: `Web address: linkedin.com/in/${p.slug}`, detail: "Easy to put on your resume." });
  }
  // Top skills: only 3 show on the profile and in the PDF.
  if (p.topSkills.length) {
    const top = new Set(p.topSkills.map((x) => x.toLowerCase()));
    const pin = facts.resumeSkills.filter((x) => !top.has(x.toLowerCase())).slice(0, 5);
    tips.push({ key: "skills", ok: true, title: `Top skills recruiters see first: ${p.topSkills.join(", ")}`, detail: pin.length ? `Pick the 3 that fit the roles you want. From your resume you could pin: ${pin.join(", ")}. On LinkedIn: Skills → the three dots → Reorder.` : "Make sure these fit the roles you want (Skills → the three dots → Reorder)." });
  }
  // About: only the first two lines (about 250 characters) show before "see more".
  if (p.about) {
    const opening = p.about.length > 200 ? p.about.slice(0, 200).replace(/\s+\S*$/, "") + "…" : p.about;
    const majors = facts.major.split(/\s*[,/&]\s*|\s+and\s+/i).map((m) => m.trim().split(/\s+/)[0]).filter((w) => w && w.length >= 3);
    const head = p.about.slice(0, 250);
    const leads = majors.some((w) => new RegExp(`\\b${esc(w)}\\b`, "i").test(head));
    tips.push({ key: "about", ok: leads, title: "Your About section opens with:", detail: `“${opening}” Only about two lines show before “see more”.${leads ? " It says what you study up front, good." : " Lead with what you study, one thing you've done, and what you want next, so people see it without clicking."}` });
  } else tips.push({ key: "about", ok: false, title: "No About section", detail: "Two to four sentences in your own words: what you study, what you've done, what you want next. Remy can draft one from your resume for you to edit." });
  return tips;
}
