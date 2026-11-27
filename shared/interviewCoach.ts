// The interview coach's steps and lesson content, shared by the website (client/src/components/InterviewCoach.tsx)
// and the app (native/src/app/interview.tsx) so both teach the same thing.
import type { Story, Workspace } from "./types";
import { practiced } from "./interview";
import { fieldExample, fieldFor } from "./fields";
import { STORY_PARTS } from "./stories";

export type Step = "learn" | "build" | "practice" | "mock";
export const STEPS: { id: Step; label: string; sub: string }[] = [
  { id: "learn", label: "Learn", sub: "3 lessons · 4 min" },
  { id: "build", label: "Build", sub: "Pitch + 4 stories" },
  { id: "practice", label: "Practice", sub: "Questions to expect" },
  { id: "mock", label: "Mock interviews", sub: "One per company" },
];
export type Lesson = "asks" | "star" | "pitch";
export const LESSONS: Lesson[] = ["asks", "star", "pitch"];
export const LESSON_TITLE: Record<Lesson, string> = { asks: "What interviewers really ask", star: "STAR: tell any story in about a minute", pitch: "The 30-second pitch" };
export const LESSON_NEXT = ["Next: STAR stories", "Next: the 30-second pitch", "Next: build your pitch"];

// Story questions most interviews include, each with the story theme that answers it (the story finder's themes).
export const COMMON: { q: string; theme: string }[] = [
  { q: "Tell me about a time you worked on a team.", theme: "teamwork" },
  { q: "Tell me about a time you made a mistake.", theme: "learning" },
  { q: "Tell me about a time you solved a problem.", theme: "challenge" },
  { q: "Tell me about a time you took the lead.", theme: "leadership" },
  { q: "Tell me about something you're proud of.", theme: "result" },
  { q: "Tell me about a time you disagreed with someone.", theme: "teamwork" },
  { q: "Tell me about a time you worked under pressure.", theme: "challenge" },
  { q: "Tell me about a time you learned something new fast.", theme: "learning" },
];
export const isReady = (s: Story) => STORY_PARTS.every((p) => s[p]);
/** Which common story questions the student's ready stories can answer (by theme). */
export const coverage = (stories: Story[]) => { const th = new Set(stories.filter(isReady).map((s) => s.theme)); return COMMON.filter((c) => th.has(c.theme)).length; };

/** Which steps are done: 3 lessons; a pitch and 4 ready stories; 3 practiced questions; one finished mock interview. */
export function coachDone(w: Workspace): Record<Step, boolean> {
  return {
    learn: (w.coach?.learned || []).length >= 3,
    build: !!w.pitch?.text && (w.stories || []).filter(isReady).length >= 4,
    practice: (w.drills || []).filter(practiced).length >= 3,
    mock: (w.interviews || []).some((x) => x.finishedAt),
  };
}

/** Practice questions: "Tell me about a time you…" shortened for a list. */
export const shortQ = (q: string) => q.replace(/^Tell me about a time (you )?/i, "A time you ").replace(/^A time you you/, "A time you");

// Lesson 1: the three kinds of question [kind, examples, what it checks], and its quick check.
export const KINDS: [string, string, string][] = [
  ["About you", "“Tell me about yourself.” “Why this job?”", "Can you say who you are and why you're here, in about 30 seconds?"],
  ["Tell me about a time…", "“…you worked on a team.” “…you made a mistake.”", "Did you really do it? What was your part, and what happened?"],
  ["About the job", "“What would you do if…?” “What do you know about us?”", "Did you read up, and can you think it through out loud?"],
];
export interface Check { q: string; opts: string[]; right: number; why: string }
export const CHECKS: Record<Lesson, Check> = {
  asks: { q: "“Tell me about a time you disagreed with a coworker.” Which kind is it?", opts: ["About you", "Tell me about a time…", "About the job"], right: 1, why: "It asks for one real example, so answer with a story." },
  star: { q: "Tap the sentence that's the Result.", opts: [], right: 3, why: "Without a Result, the interviewer never hears what changed because of you." },
  pitch: { q: "“Hi, I'm Sam, a junior studying biology. Last summer I ran experiments in a plant lab.” What's missing?", opts: ["Who you are", "What you study", "One real thing", "What you want next"], right: 3, why: "Always end with what you're looking for, so they know how to help." },
};

// Lesson 2: one STAR story per field group [who, S, T, A, R].
const STAR_EX: Record<string, [string, string, string, string, string]> = {
  business: ["a finance student", "Our finance club's budget was a mess. Nobody knew what each event cost.", "As treasurer, I had to get every event's spending clear before spring planning.", "I built a shared budget tracker and met each event lead for 15 minutes to fill it in.", "We found $1,200 we hadn't spent, and the club used it for two more events."],
  tech: ["an engineering student", "Our robotics team's arm kept stalling two days before a competition.", "I was in charge of the arm's code, so I had to find out why.", "I logged the motor current on every run and found the gripper was squeezing too hard.", "I changed the limit, the arm ran all 12 matches, and we placed third."],
  care: ["a nursing student", "On my clinical floor, patients kept missing their walking goals after surgery.", "My preceptor asked me to help get our patients moving more.", "I made a simple walking chart for each room and checked it with patients every two hours.", "Over two weeks, most of my patients hit their goal, and the unit kept the chart."],
  other: ["a student", "Our club's spring event had only 15 sign-ups a week before.", "I was in charge of getting the word out.", "I asked each officer to bring three friends and posted in five class group chats.", "We had 80 people, and three of them joined the club."],
};
export const starExample = (major: string) => { const f = fieldFor(major); return STAR_EX[/Finance|bank|Accounting|Marketing|Data|Business|Econ/i.test(f) ? "business" : /Software|Engineering|Science/i.test(f) ? "tech" : /Health|Nursing|Education|Psych/i.test(f) ? "care" : "other"]; };
export const STAR_LEGEND: [string, string][] = [["S", "Situation: what was going on, in one sentence."], ["T", "Task: what you had to do."], ["A", "Action: what you did. Most of the answer."], ["R", "Result: what changed. A number if you have one."]];

// Lesson 3: an example pitch in four parts [part, words], from the student's field and year.
export function pitchParts(major: string, classYear: string): [string, string][] {
  const ex = fieldExample(major);
  const year = (classYear || "").toLowerCase();
  return [["Who you are", "Hi, I'm Jordan,"], ["What you study", `a ${[ex.subject, year].filter(Boolean).join(" ") || "college"} student.`], ["One real thing you did", `This fall I ${ex.did}.`], ["What you want next", `I'm looking for a ${year === "senior" ? "full-time role" : "summer internship"}${ex.subject ? ` in ${ex.subject}` : ""}.`]];
}
