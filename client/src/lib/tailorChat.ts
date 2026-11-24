import { useSyncExternalStore } from "react";
import type { Application, Contact, Job, OutreachDraft, ResumeDoc, Workspace } from "@shared/types";
import { reviewResume, type BulletRef } from "@shared/review";
import { isNonAnswer } from "@shared/words";
import { api } from "./store";

// Conversations with Remy in his panel: he asks a few questions one at a time,
// then writes the thing for the student — a tailored resume + cover letter, or an
// outreach email. No fill-in-the-blank placeholders: what's unknown is left out.

type Msg = { role: "remy" | "me"; text: string };
type Stage = "reading" | "asking" | "working" | "done"; // reading: Remy is reading the posting before asking
export type TailorSession = {
  kind: "tailor" | "outreach" | "fix";
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
  /** "Fix my resume" (owners): the weak lines, the one being asked about, Remy's draft of it, and the resume it saves to. */
  fix?: { lines: (BulletRef & { kind: "numbers" | "verbs" })[]; at: number; draft: string; doc: ResumeDoc; base: string; saved: number; other: string[] };
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
const closers = new Set<() => void>();
export function onCloseRequest(fn: () => void) {
  closers.add(fn);
  return () => { closers.delete(fn); };
}
/** Closes Remy's panel, e.g. when he comes onto the resume itself (Demetre, Nov 24). */
export const closeRemy = () => closers.forEach((c) => c());
/** Opens Remy's panel (Remy starting a conversation himself). */
export const openRemy = () => openers.forEach((o) => o());
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
  if (s.kind === "fix") return answerFix(s, text, deps);
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

/** Owners, from chat ("fix my base resume"): Remy goes through the weak lines one at a time, asks what really happened,
 *  drafts the line from the answer (the same checked draft as Resume → Review) and saves it only on "Use it". */
export function startResumeFix(ws: Workspace, deps: Deps) {
  const r = ws.resume;
  if (!r) return;
  const { todo } = reviewResume(r.doc, { listLike: true });
  const seen = new Set<string>();
  const lines = todo.flatMap((it) => (it.kind === "numbers" || it.kind === "verbs" ? it.bullets.map((b) => ({ ...b, kind: it.kind as "numbers" | "verbs" })) : []))
    .filter((b) => b.id && !seen.has(b.id) && seen.add(b.id)).slice(0, 12);
  const other = todo.filter((it) => it.kind !== "numbers" && it.kind !== "verbs").map((it) => it.title);
  session = { kind: "fix", targetId: "", appId: "", title: "Fixing your resume with Remy", stage: "asking", idx: 0, answers: {}, log: [], qs: [], drafted: true,
    fix: { lines, at: 0, draft: "", doc: structuredClone(r.doc), base: r.editedAt || r.uploadedAt, saved: 0, other } };
  draftDeps = deps;
  if (!lines.length) {
    session.stage = "done";
    say(`Your lines already read strong: action verbs and real details.${other.length ? ` Still worth doing on this page: ${other.join("; ")}.` : ""}`);
  } else {
    say(`Let's make your resume stronger together. I found ${lines.length} line${lines.length > 1 ? "s" : ""} worth fixing. I'll rewrite them one at a time using only what's already on your resume. Tap "Use it", "Edit" or skip. Nothing changes until you say so.`);
    askLine(session);
  }
  emit();
  openers.forEach((o) => o());
}
// Owners (Demetre, Nov 24: "it should do more on its own"): Remy first rewrites the line himself from its own words
// (the same checked draft, with no answer). He asks only when that can't be done honestly.
async function askLine(s: TailorSession) {
  const f = s.fix!, l = f.lines[f.at];
  s.stage = "working";
  emit();
  const own = await api<{ draft: string }>("POST", "/api/resume/bullet-draft", { kind: l.kind, text: l.text, answer: "" }).then((r) => r.draft, () => "");
  if (session !== s) return;
  const head = `Line ${f.at + 1} of ${f.lines.length} (${l.where}): "${l.text}"`;
  if (own) {
    f.draft = own;
    s.qs = [...s.qs, { key: "ok", q: `${head}\nHere's a stronger version, using only what's already on your resume:\n"${own}"${l.kind === "numbers" ? "\nKnow a real number for it (people, hours, percent)? Type it and I'll work it in." : ""}`, options: ["Use it", "Edit"], pick: "Skip this line" }];
  } else {
    s.qs = [...s.qs, { key: "line", q: `${head}\n${l.kind === "numbers" ? "Is there a real number here? How many people, events, dollars, hours or percent. Only if you know it." : "I can't tell your part from this line alone, so I won't guess. What did you do here? A few words is enough."}`, pick: "Skip this line" }];
  }
  s.idx = s.qs.length - 1;
  s.stage = "asking";
  say(s.qs[s.idx].q);
  emit();
}
function nextLine(s: TailorSession) {
  const f = s.fix!;
  f.at += 1;
  f.draft = "";
  if (f.at < f.lines.length) { askLine(s); return; }
  s.stage = "done";
  say(`${f.saved ? `Done. I updated ${f.saved} line${f.saved > 1 ? "s" : ""} on your resume.` : "Done. Nothing on your resume changed."}${f.other.length ? ` Still worth doing on the Resume tab: ${f.other.join("; ")}.` : ""} Ask me anytime to go again.`);
}
async function answerFix(s: TailorSession, text: string, deps: Deps) {
  const f = s.fix!, q = s.qs[s.idx], l = f.lines[f.at];
  say(text.trim() || "skip", "me");
  if (/^\s*(skip the rest|stop|i'?m done|that'?s all|done)\s*[.!]?\s*$/i.test(text)) { f.at = f.lines.length; nextLine(s); emit(); return; }
  if (/^\s*skip( this( line)?)?\s*[.!]?\s*$/i.test(text) || (q.key === "line" && isNonAnswer(text))) { nextLine(s); emit(); return; }
  if (q.key === "ok" && /^\s*edit\s*[.!]?\s*$/i.test(text)) { s.qs = [...s.qs, { key: "own", q: "Type the line the way you want it and I'll put it on your resume.", pick: "Skip this line" }]; s.idx = s.qs.length - 1; say(s.qs[s.idx].q); emit(); return; }
  if (q.key === "own" || (q.key === "ok" && /^\s*(use it|yes|yep|yeah|sure|ok|okay|looks good|perfect)\b/i.test(text))) {
    const line = q.key === "own" ? text.replace(/\s+/g, " ").trim() : f.draft;
    if (!line) { nextLine(s); emit(); return; }
    s.stage = "working";
    emit();
    const doc = structuredClone(f.doc);
    for (const sec of doc.sections) for (const e of sec.entries) for (const b of e.bullets) if (b.id === l.id) b.text = line;
    const w = await deps.run(() => api<Workspace>("PUT", "/api/resume/doc", { doc, base: f.base }));
    if (session !== s) return;
    if (!w?.resume) { s.stage = "done"; say("I couldn't save that line. Your resume may have changed in another tab; ask me again and I'll start from your latest version."); emit(); return; }
    deps.setWs(w);
    f.doc = structuredClone(w.resume.doc);
    f.base = w.resume.editedAt || w.resume.uploadedAt;
    f.saved += 1;
    say("Saved to your resume.");
    nextLine(s);
    emit();
    return;
  }
  if (q.key === "ok" && /^\s*(try again|no|nope|no thanks)\b/i.test(text)) { f.draft = ""; s.qs = [...s.qs, { key: "line", q: "Okay. Tell me a bit more about it, in your own words, and I'll try again.", pick: "Skip this line" }]; s.idx = s.qs.length - 1; say(s.qs[s.idx].q); emit(); return; }
  // An answer about the line (or a new one instead of "Use it"): Remy drafts it from their words.
  s.stage = "working";
  emit();
  const r = await deps.run(() => api<{ draft: string }>("POST", "/api/resume/bullet-draft", { kind: l.kind, text: q.key === "ok" && f.draft ? f.draft : l.text, answer: text }));
  if (session !== s) return;
  if (!r) { s.qs = [...s.qs, { key: "line", q: l.kind === "numbers" ? "I need the real number to work it in (like \"40 members\" or \"$5,000\"). What is it? Or skip this line." : "Say in a few words what you actually did (like \"wrote and scheduled the posts\"), or skip this line.", pick: "Skip this line" }]; }
  else { f.draft = r.draft; s.qs = [...s.qs, { key: "ok", q: `How about this?\n"${r.draft}"`, options: ["Use it", "Try again"], pick: "Skip this line" }]; }
  s.idx = s.qs.length - 1;
  s.stage = "asking";
  say(s.qs[s.idx].q);
  emit();
}

export function endSession() {
  session = null;
  emit();
}
