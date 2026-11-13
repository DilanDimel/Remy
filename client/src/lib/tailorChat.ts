import { useSyncExternalStore } from "react";
import type { Application, Contact, Job, OutreachDraft, Workspace } from "@shared/types";
import { isNonAnswer } from "@shared/words";
import { api } from "./store";

// Conversations with Remy in his panel: he asks a few questions one at a time,
// then writes the thing for the student — a tailored resume + cover letter, or an
// outreach email. No fill-in-the-blank placeholders: what's unknown is left out.

type Msg = { role: "remy" | "me"; text: string };
type Stage = "asking" | "working" | "done";
export type TailorSession = {
  kind: "tailor" | "outreach";
  targetId: string; // application id or contact id
  appId: string; // kept for the Resume page; "" for outreach
  title: string; // shown above the conversation
  stage: Stage;
  qs: { key: string; q: string; label?: string }[]; // label: what the answer is saved under, when the question is long
  idx: number;
  answers: Record<string, string>;
  log: Msg[];
  draftId?: string; // outreach draft created at the end
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

/** `conflict`: the eligibility note when Remy found a clear conflict; the student confirms before any work. */
export function startTailor(a: Application, job: Job, conflict?: string) {
  begin(
    {
      kind: "tailor", targetId: a.id, appId: a.id, title: `Tailoring for ${job.company}`,
      qs: [
        ...(conflict ? [{ key: "_ok", q: `Heads up before we start: ${conflict} Do you still want to tailor for this one? (yes / no)` }] : []),
        { key: "why", q: `What draws you to ${job.company}? Even one specific reason helps.` },
        { key: "learn", q: "What do you most want to do or learn in this role?" },
        { key: "proud", q: "Which experience of yours are you proudest of for this kind of work — and what did you do there?" },
        { key: "extra", q: `Anything else ${job.company} should know — availability, someone you've talked to, why now? (Type "skip" if nothing.)` },
      ],
    },
    `Let's tailor your resume and cover letter for ${job.company}. I'll ask a few quick questions so the letter sounds like you — answer below, or type "skip".`,
  );
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
export const realAnswers = (s: Pick<TailorSession, "qs" | "answers">) => s.qs.filter((x) => !x.key.startsWith("_") && s.answers[x.key]).length;

export async function answer(text: string, deps: Deps) {
  const s = session;
  if (!s || s.stage !== "asking") return;
  const q = s.qs[s.idx];
  say(text.trim() || "skip", "me");
  const goAnyway = q.key === NUDGE_KEY && /^\s*(go|go ahead|just go|write it|write it anyway)\s*[.!]?\s*$/i.test(text);
  s.answers[q.key] = q.key === "_ok" ? text.trim() : isNonAnswer(text) || goAnyway ? "" : text.trim();
  if (q.key === "_ok" && !/^\s*(y|yes|yeah|yep|sure|ok|okay)\b/i.test(text)) {
    s.stage = "done";
    say("Okay, I won't tailor for this one. Your time is better spent on openings you qualify for.");
    emit();
    return;
  }
  s.idx += 1;
  if (s.idx >= s.qs.length && s.kind === "tailor" && realAnswers(s) < 2 && !s.qs.some((x) => x.key === NUDGE_KEY)) {
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
    say("Thanks! Tailoring your resume and writing your letter now — this can take a minute.");
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
