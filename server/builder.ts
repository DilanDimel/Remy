// "Build my resume with Remy": turns what a student tells the builder into a one-page base resume.
// Every bullet must come from the student's own words; the honesty checker enforces it.
import type { BuilderBullet, BuilderItem, ResumeBuilder, ResumeDoc, Section } from "@shared/types";
import { aiJson } from "./ai";
import { claimCheck } from "./claims";
import { uid } from "./ids";

/** Which resume section each button feeds. Languages and certificates become skill lines instead. */
const SECTION_OF: Record<string, string> = {
  job: "Experience", internship: "Experience", care: "Experience", family: "Experience", hustle: "Experience",
  club: "Leadership & Activities", sports: "Leadership & Activities", faith: "Leadership & Activities", arts: "Leadership & Activities", greek: "Leadership & Activities",
  volunteer: "Community Service", project: "Projects", research: "Projects", award: "Honors & Awards",
};
const ORDER = ["Education", "Experience", "Leadership & Activities", "Community Service", "Projects", "Honors & Awards"];
const SKILL_LINES: Record<string, string> = { language: "Languages", certificate: "Certifications" };
export const FOLLOWUP_BUDGET = 10;

const BLANK = /\[[^\]]*\]/g;
export const hasBlank = (s: string) => /\[[^\]]*\]/.test(s);
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Juniors and up leave high school off by default (career-center guidance). */
export const upperClass = (classYear: string) => /junior|senior|grad/i.test(classYear);
const showHighSchool = (b: ResumeBuilder) => !upperClass(b.basics.classYear) || !!b.keepHighSchool;

/** Everything the student said about one item: the only evidence its bullets may use. */
export function evidenceOf(item: BuilderItem): string {
  return [item.org, item.role, item.start, item.end, item.city, item.about, ...item.followups.map((f) => f.a)].filter(Boolean).join("\n");
}

/** Honesty check for one bullet against the student's words. Blanks are the student's to fill, so they're ignored.
 *  Strict: every word must come from what the student said (rewording verbs aside), as in check-ins. */
export function bulletFlags(text: string, item: BuilderItem) {
  // The student's sentences are the "original"; org, role and dates are evidence but not things they said they did.
  const said = [item.about, ...item.followups.map((f) => f.a)].filter(Boolean).join("\n");
  return claimCheck(text.replace(BLANK, " "), evidenceOf(item), { original: said, strict: true });
}

/** Without AI: the student's own sentences, lightly tidied. Always honest, never fancy. */
export function ruleBullets(item: BuilderItem): BuilderBullet[] {
  const said = [item.about, ...item.followups.map((f) => f.a)].join(". ");
  return said
    .split(/(?<=[.!?])\s+|\n+|\.\s*\.+/)
    .map((s) => s.replace(/^[\s\-•.]+|[\s.]+$/g, "").replace(/^I\s+/i, ""))
    .filter((s) => s.split(/\s+/).length >= 3)
    .slice(0, 4)
    .map((s) => ({ id: uid("bb"), text: upperFirst(s), options: [], source: s }));
}

/** Without AI: at most two plain questions per item, spent first on experience. */
export function ruleFollowups(items: BuilderItem[]): { itemId: string; q: string }[] {
  const out: { itemId: string; q: string }[] = [];
  const ranked = [...items].filter((i) => !SKILL_LINES[i.kind]).sort((a, b) => ORDER.indexOf(SECTION_OF[a.kind]) - ORDER.indexOf(SECTION_OF[b.kind]));
  for (const i of ranked) {
    if (!/\d/.test(i.about)) out.push({ itemId: i.id, q: `About how many people, customers or hours a week did ${i.org || "this"} involve? Skip if you're not sure.` });
    if (i.about.length < 140) out.push({ itemId: i.id, q: `What are you proud of from ${i.org || "this"}, or what changed because of you?` });
  }
  return out.slice(0, FOLLOWUP_BUDGET);
}

const ABOUT_ITEMS = (items: BuilderItem[]) =>
  items.filter((i) => !SKILL_LINES[i.kind]).map((i) => ({
    id: i.id, type: i.kind, when: i.stage, org: i.org, role: i.role, dates: [i.start, i.end].filter(Boolean).join(" – "), said: i.about,
    answers: i.followups.filter((f) => f.a.trim()).map((f) => `${f.q} → ${f.a}`),
  }));

export async function aiFollowups(b: ResumeBuilder): Promise<{ itemId: string; q: string }[]> {
  const r = await aiJson<{ questions: { itemId: string; q: string }[] }>(
    `You help a college student (often a freshman) write their first resume. Ask short follow-up questions that pull out the specifics a resume line needs:
scope (how many people, customers, hours, how often), result (what changed, what they're proud of), or tools (software, equipment).
Rules: at most 2 questions per item and at most ${FOLLOWUP_BUDGET} in total; spend them first on jobs and internships, then on what matters for their major.
Never ask for something they already said. Plain, friendly words a freshman understands. One sentence each.`,
    `Major: ${b.basics.major || "not given"}\nItems:\n${JSON.stringify(ABOUT_ITEMS(b.items))}\nReturn {"questions":[{"itemId":"","q":""}]}`,
    1500,
  );
  const ids = new Set(b.items.map((i) => i.id));
  const per = new Map<string, number>();
  return (r.questions || [])
    .filter((x) => ids.has(x.itemId) && typeof x.q === "string" && x.q.trim() && (per.set(x.itemId, (per.get(x.itemId) || 0) + 1).get(x.itemId)! <= 2))
    .slice(0, FOLLOWUP_BUDGET)
    .map((x) => ({ itemId: x.itemId, q: x.q.trim().slice(0, 200) }));
}

/** AI draft, then every wording is checked against the student's words. Anything flagged is dropped; an item left empty falls back to its rule bullets. */
export async function aiDraft(b: ResumeBuilder): Promise<Record<string, BuilderBullet[]>> {
  const r = await aiJson<{ items: { id: string; bullets: { options: string[]; source: string }[] }[] }>(
    `You write resume bullets for a college student, using ONLY what they said. Never add a number, title, organization, award, tool, skill or result they didn't give.
For each item write 1-3 bullets (up to 4 for a job or internship). Each bullet starts with a strong action verb, past tense unless it's ongoing, no "I", under 25 words.
Give 2-3 "options": different wordings of the SAME facts. "source" is the exact words from the student's answer the bullet is based on (copied, not paraphrased).
If a number would make a bullet stronger but the student didn't give one, put a blank in square brackets for them to fill, like "[how many customers a shift?]". Never guess the number.
Do not say "led", "managed" or "supervised" unless the student did. Plain, specific words beat buzzwords.
Do not add WHEN, WHERE, WHO or WHY details they didn't say: no "summers", "to the class", "to help the community", "for clients", "to improve efficiency".
Keep the student's hedge words with their numbers ("about 6", "around 200"): never make a number sound more exact than they said it.
A shorter true bullet is always better than a longer padded one.`,
    `Student: ${b.basics.classYear || "college student"}, major ${b.basics.major || "undecided"}.\nItems:\n${JSON.stringify(ABOUT_ITEMS(b.items))}\nReturn {"items":[{"id":"","bullets":[{"options":["",""],"source":""}]}]}`,
    3500,
  );
  const out: Record<string, BuilderBullet[]> = {};
  for (const item of b.items) {
    if (SKILL_LINES[item.kind]) continue;
    const ev = evidenceOf(item);
    const got = r.items?.find((x) => x.id === item.id)?.bullets || [];
    const bullets = got
      .map((x) => {
        const options = (x.options || []).map((o) => String(o).trim()).filter((o) => o && o.length < 260 && !bulletFlags(o, item).length);
        const source = typeof x.source === "string" && ev.toLowerCase().includes(x.source.trim().toLowerCase()) ? x.source.trim() : item.about;
        return options.length ? { id: uid("bb"), text: options[0], options, source } : null;
      })
      .filter(Boolean) as BuilderBullet[];
    out[item.id] = bullets.length ? bullets.slice(0, 4) : ruleBullets(item);
  }
  return out;
}

export function ruleDraft(b: ResumeBuilder): Record<string, BuilderBullet[]> {
  return Object.fromEntries(b.items.filter((i) => !SKILL_LINES[i.kind]).map((i) => [i.id, ruleBullets(i)]));
}

/** Skills Remy may suggest: only ones the student mentioned, plus a few everyday tools they can tick. Never added without a tick. */
export function skillSuggestions(b: ResumeBuilder): string[] {
  const said = b.items.map(evidenceOf).join("\n").toLowerCase();
  const mentioned = ["Excel", "PowerPoint", "Word", "Google Sheets", "Google Docs", "Canva", "Photoshop", "Python", "Java", "SQL", "Tableau", "Quickbooks", "Square POS", "Social media"]
    .filter((s) => said.includes(s.toLowerCase()));
  const everyday = ["Microsoft Excel", "Microsoft PowerPoint", "Microsoft Word", "Google Workspace", "Canva"];
  return [...mentioned.filter((m) => !everyday.some((e) => e.toLowerCase().includes(m.toLowerCase()))), ...everyday];
}

/** The finished resume: education first, sections in a fixed order, high school only when it belongs. */
export function buildDoc(b: ResumeBuilder): ResumeDoc {
  const hs = showHighSchool(b);
  const bb = b.basics;
  const edu: Section = { id: uid("s"), heading: "Education", entries: [] };
  if (bb.school) {
    const details = [bb.gpa && `GPA: ${bb.gpa}`].filter(Boolean) as string[];
    edu.entries.push({ id: uid("e"), org: bb.school, role: bb.major ? `Major: ${bb.major}` : "", location: "", dates: bb.graduation ? `Expected ${bb.graduation}` : "", bullets: details.map((t) => ({ id: uid("b"), text: t })) });
  }
  if (hs && bb.highSchool) edu.entries.push({ id: uid("e"), org: bb.highSchool, role: "High School Diploma", location: "", dates: bb.highSchoolYear, bullets: [] });
  const sections = new Map<string, Section>([["Education", edu]]);
  for (const item of b.items) {
    const heading = SECTION_OF[item.kind];
    if (!heading || (item.stage === "high school" && !hs)) continue;
    if (!sections.has(heading)) sections.set(heading, { id: uid("s"), heading, entries: [] });
    sections.get(heading)!.entries.push({
      id: uid("e"), org: item.org, role: item.role, location: item.city,
      dates: [item.start, item.end].filter(Boolean).join(" – "),
      bullets: (b.draft?.[item.id] || []).filter((x) => x.text.trim()).map((x) => ({ id: x.id, text: x.text.trim() })),
    });
  }
  const skillLines = Object.entries(SKILL_LINES)
    .map(([kind, label]) => ({ id: uid("k"), label, items: b.items.filter((i) => i.kind === kind && (hs || i.stage !== "high school")).map((i) => i.org).filter(Boolean).join(", ") }))
    .filter((l) => l.items);
  if (b.skills.length) skillLines.unshift({ id: uid("k"), label: "Skills", items: b.skills.join(", ") });
  return {
    contact: { name: bb.name, email: bb.email, phone: bb.phone, location: bb.city, links: "" },
    sections: ORDER.map((h) => sections.get(h)).filter((s): s is Section => !!s && s.entries.length > 0),
    skills: skillLines,
  };
}
