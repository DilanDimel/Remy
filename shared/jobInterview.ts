// Redesign stage 3 (owners first): practice questions tied to the job the student is applying for, built from the
// posting's own requirements (no AI). Each question says which line of the posting it comes from and which resume
// line could answer it, or that none does yet.
import type { Job, ResumeDoc } from "./types";
import { isSkill, isSkillKeyword } from "./requirements";
import { skillProof } from "./words";

export type JobQuestion = { q: string; why: string; line?: string; tip: string };

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
];

/** Likely questions for one opening, most job-specific first, ending with the student's own questions for them. */
export function jobQuestions(job: Pick<Job, "company" | "title" | "requirements">, doc?: ResumeDoc, max = 5): JobQuestion[] {
  const lines = (doc?.sections || []).flatMap((s) => s.entries.flatMap((e) => e.bullets.map((b) => b.text))).filter((t) => t.trim());
  const skillLines = [...lines, ...(doc?.skills || []).map((k) => k.items)];
  const out: JobQuestion[] = [{
    q: `Why ${job.company}, and why this ${job.title} role?`, why: "Asked in almost every interview.",
    tip: `Name one real thing about ${job.company} (what they do, a person you talked to, a project) and connect it to something you've done.`,
  }];
  const seen = new Set<string>();
  for (const r of job.requirements || []) {
    if (out.length > max) break;
    const k = r.keyword.trim();
    if (!k || !isSkill(k) || !isSkillKeyword(k) || seen.has(k.toLowerCase())) continue;
    seen.add(k.toLowerCase());
    const why = `The posting asks for: “${r.quote}”`;
    const beh = BEHAVIOR.find(([re]) => re.test(k));
    const line = beh ? lines.find((l) => beh[2].test(l)) ?? skillProof(k, lines) : skillProof(k, skillLines);
    const tip = line ? "Use this line from your resume: say the situation, what you did, and how it turned out." : "Nothing on your resume shows this yet. Think of a class, project, job or club where you did it.";
    out.push(beh ? { q: `Tell me about a time you ${beh[1]}`, why, line, tip } : { q: `How have you used ${k}? Walk me through a specific example.`, why, line, tip });
  }
  out.push({ q: "What questions do you have for us?", why: "Usually the last question.", tip: "Have two ready: what a good first month looks like, and what the team is working on now." });
  return out;
}
