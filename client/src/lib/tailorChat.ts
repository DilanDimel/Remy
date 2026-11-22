import { useSyncExternalStore } from "react";
import type { Application, Contact, Job, OutreachDraft, Workspace } from "@shared/types";
import { isNonAnswer } from "@shared/words";
import { api } from "./store";

// Conversations with Remy in his panel: he asks a few questions one at a time,
// then writes the thing for the student — a tailored resume + cover letter, or an
// outreach email. No fill-in-the-blank placeholders: what's unknown is left out.

type Msg = { role: "remy" | "me"; text: string };
type Stage = "reading" | "asking" | "working" | "done"; // reading: Remy is reading the posting before asking
export type TailorSession = {
  kind: "tailor" | "outreach";
  targetId: string; // application id or contact id
  appId: string; // kept for the Resume page; "" for outreach
  title: string; // shown above the conversation
  stage: Stage;
  // label: what the answer is saved under, when the question is long. options: tap answers (typing still works);
  // pick: the "let Remy choose" tap for that question.
  qs: { key: string; q: string; label?: string; options?: string[]; pick?: string }[];
  idx: number;
  answers: Record<string, string>;
  log: Msg[];
  draftId?: string; // outreach draft created at the end
  job?: Job; // tailoring: the opening, for the brief that follows the eligibility question
  briefKey?: string; // the opening + this version of the resume: a changed resume means a fresh brief
  /** Redesign stage 3 (owners first): Remy writes the whole draft first, then asks optional questions to make it
   *  stronger ("encouraged, not mandatory"); answering redoes the draft with the answers. */
  draftFirst?: boolean;
  drafted?: boolean; // the first draft exists; the questions after it are optional
};
type Deps = { setWs: (w: Workspace) => void; run: <T>(fn: () => Promise<T>, ok?: string) => Promise<T | undefined> };

let session: TailorSession | null = null; // mutable; compared by identity across awaits
let snap: TailorSession | null = null; // immutable copy the UI reads
const listeners = new Set<() => void>();
const openers = new Set<() => void>();
const emit = () => { snap = session && { ...session, log: [...session.log] }; listeners.forEach((l) => l()); };
const say = (text: string, role: Msg["role"] = "remy") => { session!.log = [...session!.log, { role, text }]; };

export function useTailorSession() {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => snap);
}
/** The app shell registers here so a conversation can open Remy's panel. */
export function onOpenRequest(fn: () => void) {
  openers.add(fn);
  return () => { openers.delete(fn); };
}
export const isAsking = (s: TailorSession | null) => !!s && s.stage === "asking";

function begin(s: Omit<TailorSession, "stage" | "idx" | "answers" | "log">, intro: string) {
  session = { ...s, stage: "asking", idx: 0, answers: {}, log: [] };
  say(intro);
  say(session.qs[0].q);
  emit();
  openers.forEach((o) => o());
}

/** `conflict`: the eligibility note when Remy found a clear conflict; the student confirms before any work.
 *  Then Remy reads the posting and briefs the student (company, role, why they fit) and asks questions they can
 *  answer with a tap. If the brief fails or is slow, the plain questions are used, so tailoring never depends on it. */
export function startTailor(a: Application, job: Job, conflict?: string, resume?: unknown, deps?: Deps) {
  const s: TailorSession = {
    kind: "tailor", targetId: a.id, appId: a.id, title: `Tailoring for ${job.company}`, job, briefKey: `${a.id}|${hash(JSON.stringify(resume ?? ""))}`,
    draftFirst: !!deps,
    stage: "asking", idx: 0, answers: {}, log: [],
    qs: conflict ? [{ key: "_ok", q: `Heads up before we start: ${conflict} Do you still want to tailor for this one?`, options: ["Yes", "No"] }] : [],
  };
  session = s;
  if (deps) draftDeps = deps;
  say(`Let's tailor your resume and cover letter for ${job.company}.`);
  openers.forEach((o) => o());
  if (conflict) { say(s.qs[0].q); emit(); return; }
  readPosting(s);
}
let draftDeps: Deps | null = null;

/** Draft-first: write the draft from the resume alone, then offer the questions as optional. */
async function firstDraft(s: TailorSession) {
  s.stage = "working";
  say(`Writing a full first draft from your resume now. This can take a minute.`);
  emit();
  const r = await draftDeps!.run(() => api<{ application: Application; workspace: Workspace }>("POST", `/api/applications/${s.targetId}/generate`, { answers: [], confirmEligible: !!s.answers._ok }));
  if (session !== s) return;
  if (!r) { s.stage = "done"; say("That didn't work. Press Tailor to try again."); emit(); return; }
  draftDeps!.setWs(r.workspace);
  s.drafted = true;
  s.stage = "asking";
  say(`Your first draft is ready on the page. Want it stronger? Answer a few quick questions and I'll update it. Each one is optional: tap an answer, choose Other to write your own, or skip.`);
  say(s.qs[s.idx].q);
  emit();
}

// One brief per opening and resume version while the page is open, so "Answer again" doesn't pay for the same reading twice.
const hash = (t: string) => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const briefs = new Map<string, { brief: Brief | null; messages: string[] }>();
const BRIEF_WAIT_MS = 20_000;
function readPosting(s: TailorSession) {
  const job = s.job!;
  s.stage = "reading";
  say("Give me a moment to read the posting.");
  emit();
  const cached = briefs.get(s.briefKey!);
  const slow = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("slow")), BRIEF_WAIT_MS));
  (cached ? Promise.resolve(cached) : Promise.race([api<{ brief: Brief | null; messages: string[] }>("POST", `/api/applications/${s.appId}/brief`), slow])
    .then((r) => { if (r.brief) briefs.set(s.briefKey!, r); return r; }))
    .catch(() => ({ brief: null, messages: [] as string[] }))
    .then(({ brief, messages }) => {
      if (session !== s) return;
      messages.forEach((m) => say(m));
      s.qs = [...s.qs, ...tailorQuestions(job, brief)];
      if (s.draftFirst) { void firstDraft(s); return; }
      s.stage = "asking";
      if (messages.length) say(`A few quick questions so the letter sounds like you. Tap an answer or type your own.`);
      say(s.qs[s.idx].q);
      emit();
    });
}

type Brief = { questions: { key: string; q: string; options: string[]; label?: string; pick?: string }[] };
/** The questions for one tailoring: the brief's tap questions where it had good ones, the plain ones otherwise. */
export function tailorQuestions(job: Job, brief: Brief | null): TailorSession["qs"] {
  const from = (key: string) => brief?.questions.find((x) => x.key === key);
  const why = from("why"), learn = from("learn"), proud = from("proud"), skill = from("skill");
  return [
    why ? { key: "why", q: why.q, options: why.options, pick: "Not sure yet" } : { key: "why", q: `Is there anything about ${job.company} or this role that draws you? Even one reason helps. "Not sure" is fine.` },
    learn ? { key: "learn", q: learn.q, options: learn.options, pick: "Not sure yet" } : { key: "learn", q: "What do you most want to do or learn in this role?" },
    proud ? { key: "proud", q: proud.q, options: proud.options, pick: "You pick" } : { key: "proud", q: "Which experience of yours are you proudest of for this kind of work — and what did you do there?" },
    // Ask, don't invent: where a listed skill came from, so the letter doesn't make it up.
    ...(skill ? [{ key: "skill", q: skill.q, label: skill.label, options: skill.options, pick: skill.pick || "Skip" }] : []),
    { key: "extra", q: `Anything else ${job.company} should know — availability, someone you've talked to, why now? (Type "skip" if nothing.)`, options: [], pick: "Nothing to add" },
  ];
}

export function startOutreach(c: Contact) {
  const first = c.name.split(/\s+/)[0];
  begin(
    {
      kind: "outreach", targetId: c.id, appId: "", title: `Email to ${c.name}`,
      qs: [
        { key: "ask", q: `What would you like from ${first}? For example: a 20-minute chat about their path, advice on recruiting for ${c.org || "their field"}, or what their role is really like.` },
        { key: "interest", q: `What about ${first}'s path interests you most? (${[c.title, c.org].filter(Boolean).join(" at ")})` },
        { key: "you", q: "What should I mention about you — a class, project, club or internship that connects to their work?" },
        { key: "when", q: `When are you usually free for a call? (Type "skip" to leave it out.)` },
      ],
    },
    `Let's write to ${c.name}. A few quick questions and I'll draft the whole email — no blanks to fill in.`,
  );
}

// When a student skips most tailoring questions, Remy says so once before writing a generic letter.
export const NUDGE_KEY = "_reason";
const NUDGE_Q = `You skipped most of these, so the cover letter would be generic, and recruiters notice. Give me one real reason you want this role (a class, a project, someone you talked to, what the team works on), or type "go" to write it anyway.`;
// The skill question says where a skill came from, not why they want the job, so it doesn't count against the nudge.
export const realAnswers = (s: Pick<TailorSession, "qs" | "answers">) => s.qs.filter((x) => !x.key.startsWith("_") && x.key !== "skill" && s.answers[x.key]).length;

export async function answer(text: string, deps: Deps) {
  const s = session;
  if (!s || s.stage !== "asking") return;
  const q = s.qs[s.idx];
  say(text.trim() || "skip", "me");
  if (q.pick && text.trim().toLowerCase() === q.pick.toLowerCase() && q.key === "proud" && q.options?.length) {
    text = q.options[0];
    say(`I'd lead with this one: ${q.options[0]}. Tell me in chat if you'd rather use another.`);
  }
  const goAnyway = q.key === NUDGE_KEY && /^\s*(go|go ahead|just go|write it|write it anyway)\s*[.!]?\s*$/i.test(text);
  s.answers[q.key] = q.key === "_ok" ? text.trim() : isNonAnswer(text) || goAnyway ? "" : text.trim();
  if (q.key === "_ok" && !/^\s*(y|yes|yeah|yep|sure|ok|okay)\b/i.test(text)) {
    s.stage = "done";
    say("Okay, I won't tailor for this one. Your time is better spent on openings you qualify for.");
    emit();
    return;
  }
  s.idx += 1;
  if (q.key === "_ok") { readPosting(s); return; } // confirmed: now it's worth reading the posting
  // Draft-first: "Skip the rest" ends the optional questions; a draft with no answers simply stays as it is.
  if (s.drafted && /^\s*skip (the )?rest\s*$/i.test(text)) { s.answers[q.key] = ""; s.idx = s.qs.length; }
  if (s.drafted && s.idx >= s.qs.length && !realAnswers(s)) {
    s.stage = "done";
    say("No problem. Your draft stays as it is. Review each change on the page, then approve and download.");
    emit();
    return;
  }
  if (!s.drafted && s.idx >= s.qs.length && s.kind === "tailor" && realAnswers(s) < 2 && !s.qs.some((x) => x.key === NUDGE_KEY)) {
    s.qs = [...s.qs, { key: NUDGE_KEY, q: NUDGE_Q, label: "Why I want this role" }];
  }
  if (s.idx < s.qs.length) {
    say(s.qs[s.idx].q);
    emit();
    return;
  }
  s.stage = "working";
  const answers = s.qs.filter((x) => x.key !== "_ok").map((x) => ({ q: x.label || x.q, a: s.answers[x.key] || "" })).filter((x) => x.a);
  if (s.kind === "tailor") {
    say(s.drafted ? "Thanks! Updating your draft with your answers. This can take a minute." : "Thanks! Tailoring your resume and writing your letter now — this can take a minute.");
    emit();
    const r = await deps.run(() => api<{ application: Application; workspace: Workspace }>("POST", `/api/applications/${s.targetId}/generate`, { answers, confirmEligible: !!s.answers._ok }));
    if (session !== s) return;
    if (r) deps.setWs(r.workspace);
    s.stage = "done";
    say(r ? "Done — your tailored resume and cover letter are ready. Review each change, then approve and export." : "That didn't work — press Tailor with AI to try again.");
    emit();
    return;
  }
  say("Thanks! Writing your email now…");
  emit();
  const r = await deps.run(() => api<{ draft: OutreachDraft; workspace: Workspace }>("POST", "/api/ai/outreach", { contactId: s.targetId, answers }));
  if (session !== s) return;
  if (r) { deps.setWs(r.workspace); s.draftId = r.draft.id; }
  s.stage = "done";
  say(r ? "Your email is ready to review in Community. Nothing is sent until you open it in your own email." : "That didn't work — try Draft email again.");
  emit();
}

export function endSession() {
  session = null;
  emit();
}
