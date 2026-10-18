import { useSyncExternalStore } from "react";
import type { Application, Job, Workspace } from "@shared/types";
import { api } from "./store";

// Tailoring as a conversation in Remy's panel: "Tailor with AI" → Remy asks a few
// questions one at a time → tailors → asks about anything only the student knows
// → writes the answers into the letter. One session at a time, in memory.

type Msg = { role: "remy" | "me"; text: string };
type Stage = "pre" | "generating" | "post" | "finishing" | "done";
export type TailorSession = { appId: string; company: string; stage: Stage; qs: { key: string; q: string }[]; idx: number; answers: Record<string, string>; log: Msg[] };
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
/** The app shell registers here so a tailoring session can open Remy's panel. */
export function onOpenRequest(fn: () => void) {
  openers.add(fn);
  return () => { openers.delete(fn); };
}
export const isAsking = (s: TailorSession | null) => !!s && (s.stage === "pre" || s.stage === "post");

const preQuestions = (job: Job) => [
  { key: "why", q: `What draws you to ${job.company}? Even one specific reason helps.` },
  { key: "learn", q: "What do you most want to do or learn in this role?" },
  { key: "extra", q: `Anything else ${job.company} should know — availability, someone you've talked to, a project you're proud of? (Type "skip" if nothing.)` },
];

export function startTailor(a: Application, job: Job) {
  session = {
    appId: a.id, company: job.company, stage: "pre", qs: preQuestions(job), idx: 0, answers: {},
    log: [{ role: "remy", text: `Let's tailor your resume and cover letter for ${job.company}. A few quick questions first, so the letter sounds like you — answer here, or type "skip".` }],
  };
  say(session.qs[0].q);
  emit();
  openers.forEach((o) => o());
}

/** Asks about the letter's open [PERSONALIZE] spots (after a draft exists). */
export function startFollowUps(a: Application, job: Job) {
  const open = a.personalize.filter((p) => !p.done);
  if (!open.length) return;
  session = { appId: a.id, company: job.company, stage: "post", qs: open.map((p) => ({ key: p.id, q: p.text })), idx: 0, answers: {}, log: [] };
  say(`Your ${job.company} letter has ${open.length} detail${open.length > 1 ? "s" : ""} only you know. I'll write your answers in.`);
  say(session.qs[0].q);
  emit();
  openers.forEach((o) => o());
}

export async function answer(text: string, deps: Deps) {
  const s = session;
  if (!s || !isAsking(s)) return;
  const q = s.qs[s.idx];
  const value = /^\s*(skip|no|none|n\/a|nothing)\s*\.?$/i.test(text) ? "" : text.trim();
  say(text.trim() || "skip", "me");
  s.answers[q.key] = value;
  s.idx += 1;
  if (s.idx < s.qs.length) {
    say(s.qs[s.idx].q);
    emit();
    return;
  }
  if (s.stage === "pre") {
    s.stage = "generating";
    say(`Thanks! Tailoring your resume and writing your ${s.company} letter now — this can take a minute.`);
    emit();
    const answers = s.qs.map((x) => ({ q: x.q, a: s.answers[x.key] || "" })).filter((x) => x.a);
    const r = await deps.run(() => api<{ application: Application; workspace: Workspace }>("POST", `/api/applications/${s.appId}/generate`, { answers }));
    if (session !== s) return;
    if (!r) { s.stage = "done"; say("That didn't work — press Tailor with AI to try again."); emit(); return; }
    deps.setWs(r.workspace);
    const open = r.application.personalize.filter((p) => !p.done);
    if (open.length) {
      s.stage = "post"; s.qs = open.map((p) => ({ key: p.id, q: p.text })); s.idx = 0; s.answers = {};
      say(`Your draft is ready. ${open.length === 1 ? "One more thing" : `${open.length} more things`} only you can tell me:`);
      say(s.qs[0].q);
      emit();
      return;
    }
    s.stage = "done";
    say(`Done — your tailored resume and ${s.company} letter are ready. Review each change, then approve and export.`);
    emit();
    return;
  }
  s.stage = "finishing";
  say("Got it — writing that into your letter…");
  emit();
  const r = await deps.run(() => api<{ workspace: Workspace }>("POST", `/api/applications/${s.appId}/answers`, { answers: s.qs.map((x) => ({ pid: x.key, q: x.q, a: s.answers[x.key] || "" })) }));
  if (session !== s) return;
  if (r) deps.setWs(r.workspace);
  s.stage = "done";
  say(r ? `Your ${s.company} letter is personalized and ready. Review the changes, then approve and export.` : "That didn't save — try answering again from the Cover letter tab.");
  emit();
}

export function endSession() {
  session = null;
  emit();
}
