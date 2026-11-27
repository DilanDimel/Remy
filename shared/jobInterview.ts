// Redesign stage 3 (owners first): practice questions tied to the job the student is applying for, built from the
// posting's own requirements (no AI). Each question says which line of the posting it comes from and which resume
// line could answer it, or that none does yet.
import type { Job, ResumeDoc } from "./types";
import { boilerplate, isSkill, isSkillKeyword } from "./requirements";
import { skillProof } from "./words";
import { pickProfile } from "./interview";
import { PROFILES } from "./interviewRubric";
import { BANK, SOURCES, bankField, companyFacts, fieldLabel, type Source } from "./questionBank";

/** `from` says where the question comes from, so nothing claims more than we know: "posting" (its own words),
 *  "company" (the employer's own careers page), "role" (a career office's published list for this kind of job),
 *  "always" (asked almost everywhere). `source` is the page it came from. */
export type JobQuestion = { q: string; why: string; line?: string; tip: string; from?: "posting" | "company" | "role" | "always"; source?: Source };

// [the requirement, the question, resume lines that could answer it]
const BEHAVIOR: [RegExp, string, RegExp][] = [
  [/team|collaborat|cross-functional/i, "worked on a team to get something done. What was your part?", /\b(team|collaborat\w*|partner\w*|together)\b/i],
  [/lead|mentor|manag(e|ing) (people|a team)/i, "led others. What did you do, and how did it turn out?", /\b(led|lead\w*|mentor\w*|supervis\w*|trained|captain|president|chair\w*)\b/i],
  [/communicat|present|public speaking|writ/i, "had to explain something clearly to someone. How did you make sure they got it?", /\b(present\w*|explain\w*|wrote|writ\w*|taught|tutor\w*|communicat\w*)\b/i],
  [/problem|analy|critical thinking|troubleshoot/i, "solved a problem nobody handed you the answer to. Walk me through it.", /\b(solv\w*|fix\w*|analy\w*|improv\w*|redesign\w*|built)\b/i],
  [/detail|accura/i, "caught a mistake before it caused trouble.", /\b(accura\w*|audit\w*|reconcil\w*|review\w*|check\w*|error)\b/i],
  [/time management|deadline|prioriti|organiz|multitask/i, "had too much to do at once. How did you decide what came first?", /\b(schedul\w*|organiz\w*|coordinat\w*|while|deadline\w*|balanc\w*)\b/i],
  [/customer|client|patient|guest/i, "helped a difficult customer or client.", /\b(customer\w*|client\w*|patient\w*|guest\w*)\b/i],
  [/adapt|fast-paced|ambigu|learn quickly|change/i, "had to learn something new fast.", /\b(learn\w*|new|adapt\w*|fast)\b/i],
  // Soft skills read as "How have you used creativity?" without these (interview test lab, Nov 27: 1,393 of 16,000).
  [/creativ|innovat/i, "came up with a new idea or a new way to do something. What happened?", /\b(creat\w*|design\w*|idea\w*|launch\w*|started|new)\b/i],
  [/resilien|persever|goal-driven|grit/i, "kept going after a setback or a no. What did you do next?", /\b(despite|again|recover\w*|turned|improv\w*)\b/i],
  [/curio|eager to learn|self-starter|initiative|proactive/i, "taught yourself something nobody asked you to learn. What did you do with it?", /\b(taught|self|research\w*|learn\w*|built)\b/i],
  [/patience|flexib|empath/i, "had to stay patient with someone who was struggling. What did you do?", /\b(tutor\w*|help\w*|support\w*|taught|care\w*)\b/i],
  [/reliab|dependab|punctual|work ethic/i, "people were counting on you to get something done. How did you make sure you did?", /\b(every|weekly|daily|shift\w*|zero)\b/i],
  [/safety/i, "noticed something unsafe. What did you do?", /\b(safety|safe|incident\w*|hazard\w*)\b/i],
  [/confidential|discret|privacy/i, "handled private or sensitive information. How did you keep it safe?", /\b(confidential\w*|records?|privacy|HIPAA)\b/i],
  [/classroom|behavior management/i, "kept a group of students on track when it got hard. What did you do?", /\b(tutor\w*|class\w*|students?|taught|lesson\w*)\b/i],
  [/^research$/i, "researched a question and had to explain what you found. Walk me through it.", /\b(research\w*|survey\w*|stud(y|ied)|analy\w*)\b/i],
];

const STORY_TIP = "Answer with one real example: the situation, what you did, and how it turned out.";
const KNOW_TIP = "This one checks what you know. Say it in plain words, give one place you used it, and say how you'd find out what you don't know.";

/** Likely questions for one opening, most job-specific first, ending with the student's own questions for them. */
export function jobQuestions(job: Pick<Job, "company" | "title" | "requirements">, doc?: ResumeDoc, max = 5): JobQuestion[] {
  const lines = (doc?.sections || []).flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => b.text))).filter((t) => t.trim());
  const skillLines = [...lines, ...(doc?.skills || []).map((k) => k.items)];
  const co = companyFacts(job.company);
  const out: JobQuestion[] = [{
    q: `Why ${job.company}, and why this ${job.title} role?`, why: co ? `Asked in almost every interview. ${co.note}` : "Asked in almost every interview.",
    tip: `Name one real thing about ${job.company} (what they do, a person you talked to, a project) and connect it to something you've done.`,
    from: "always", ...(co ? { source: SOURCES[co.src] } : {}),
  }];
  // Researched questions: ones the company itself lists, then ones career offices list for this kind of role.
  const profile = pickProfile(job), field = bankField(job.title, profile);
  const extra: JobQuestion[] = [
    ...(co?.asks || []).slice(0, 1).map((q): JobQuestion => ({ q, why: `${job.company} lists this question on its own careers site.`, tip: STORY_TIP, from: "company", source: SOURCES[co!.src] })),
    ...BANK[field].slice(0, 2).map((b): JobQuestion => {
      // A story question gets the resume line that could answer it, the same way posting questions do.
      const beh = b.kind === "story" ? BEHAVIOR.find(([re]) => re.test(b.q)) : undefined;
      const line = beh ? lines.find((l) => beh[2].test(l)) : undefined;
      return { q: b.q, why: `Common in ${fieldLabel(field, PROFILES[profile].label)} interviews, from a published interview guide.`, line,
        tip: line ? "Use this line from your resume: say the situation, what you did, and how it turned out." : b.kind === "story" ? STORY_TIP : KNOW_TIP, from: "role", source: SOURCES[b.src] };
    }),
  ];
  const seen = new Set<string>();
  for (const r of job.requirements || []) {
    if (out.length > max - Math.min(extra.length, 2)) break;
    const k = r.keyword.trim();
    if (!k || !isSkill(k) || !isSkillKeyword(k) || seen.has(k.toLowerCase()) || boilerplate(r.quote)) continue; // openings saved before the filter
    seen.add(k.toLowerCase());
    const why = `The posting asks for: “${r.quote}”`;
    const beh = BEHAVIOR.find(([re]) => re.test(k));
    const line = beh ? lines.find((l) => beh[2].test(l)) ?? skillProof(k, lines) : skillProof(k, skillLines);
    const tip = line ? "Use this line from your resume: say the situation, what you did, and how it turned out." : "Nothing on your resume shows this yet. Think of a class, project, job or club where you did it.";
    // Say who the posting serves: a nurse extern helps patients, not customers.
    const who = /patient/i.test(k) ? "patient or a worried family member" : /guest/i.test(k) ? "guest" : "customer or client";
    const q = beh ? `Tell me about a time you ${beh[1].replace("customer or client", who)}` : `How have you used ${k}? Walk me through a specific example.`;
    if (out.some((x) => x.q === q)) continue; // "problem solving" and "analytical" ask the same thing
    out.push({ q, why, line, tip, from: "posting" });
  }
  for (const x of extra) if (!out.some((y) => y.q.toLowerCase() === x.q.toLowerCase())) out.push(x);
  out.push({ q: "What questions do you have for us?", why: "Usually the last question.", tip: "Have two ready: what a good first month looks like, and what the team is working on now.", from: "always" });
  return out;
}
