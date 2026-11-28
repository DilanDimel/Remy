import type { Workspace } from "./types";
import { NAME_CHECK } from "./names";
import { quietOn } from "./remyOffers";

// Owners (Nov 24, Dilan: "students never go to AI memory to resolve conflicts"): everything on the account Remy isn't
// sure about, as one list of quick questions. He asks one at a time where the student already is (his office on My
// Path, the strip or chat card on other pages, AI memory) and does the fix himself with Undo (server/coach/asks.ts).
// Pure and cheap: no AI call, no extra database read.

export type AskKind = "conflict" | "name" | "profile" | "facts" | "avoid" | "stale";
export interface Ask {
  id: string;
  kind: AskKind;
  text: string;
  /** The two sides that disagree, [label, value], shown under the question. */
  vs?: [string, string][];
  /** One-tap answers (conflict, name, profile). */
  options: { key: string; label: string }[];
  /** Facts to confirm one by one (facts). */
  items?: { id: string; text: string }[];
}

export const PROFILE_CHECK_FIELDS = ["school", "major", "minors", "gpa", "graduation", "location"] as const;
const FIELD_NAME: Record<string, string> = { school: "school", major: "major", minors: "minor", gpa: "GPA", graduation: "graduation date", location: "location" };
const SETUP_TAP = /^Tapped one of Remy's suggested answers/;

/** "LinkedIn profile (PDF) import" → "LinkedIn profile (PDF)" → short name "LinkedIn". */
export const sourceOf = (source: string) => source.replace(/ import$/, "");
export const shortSource = (source: string) => (/linkedin/i.test(source) ? "LinkedIn" : /handshake/i.test(source) ? "Handshake" : sourceOf(source).replace(/\s*\(.*$/, ""));
/** "Your resume says Summer Intern at TBC Bank" → "Summer Intern at TBC Bank"; "" when the conflict isn't phrased that way. */
export const resumeSide = (conflict: string) => conflict.match(/^your resume says:?\s*(.+)$/i)?.[1].trim().replace(/[.]$/, "") || "";
const clip = (s: string, n = 40) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/** Every open question, most important first. `today` is the student's day, YYYY-MM-DD. Snoozed ones are left out
 *  unless `all` (the answer route looks a question up even when it was put off). */
/** Employers the student marked "Not for me" twice or more and hasn't already told Remy to avoid (Nov 28: Keep/Pass
 *  feeds the avoid list, but only after the student says yes). Most passes first. */
export function passedEmployers(ws: Pick<Workspace, "jobFeedback" | "profile">): { company: string; n: number }[] {
  const n = new Map<string, number>();
  for (const f of Object.values(ws.jobFeedback || {})) {
    const c = f?.context?.job?.company?.trim();
    if (c && f.rating <= 2 && (!f.reason || f.reason === "company")) n.set(c, (n.get(c) || 0) + 1);
  }
  const avoid = (ws.profile.avoid || "").toLowerCase().split(/[,;]+/).map((x) => x.trim());
  return [...n].filter(([c, k]) => k >= 2 && !avoid.includes(c.toLowerCase())).map(([company, k]) => ({ company, n: k })).sort((a, b) => b.n - a.n);
}

/** Tailored versions the student approved before changing their resume or profile, not sent yet (no tracker status past Saved). */
export function staleApps(ws: Pick<Workspace, "applications" | "tracker">) {
  return ws.applications.filter((a) => a.staleReason && a.versions.length && !ws.tracker.some((t) => (t.applicationId === a.id || t.jobId === a.jobId) && t.status !== "Saved"));
}

export function remyAsks(ws: Pick<Workspace, "memory" | "tasks" | "profileChecks" | "settings" | "jobFeedback" | "profile" | "applications" | "tracker" | "jobs">, today: string, all = false): Ask[] {
  if (!all && quietOn(ws.settings, today)) return [];
  const out: Ask[] = [];
  for (const m of ws.memory.filter((x) => x.conflict)) {
    const src = shortSource(m.source), mine = resumeSide(m.conflict!);
    out.push({ id: `conflict:${m.id}`, kind: "conflict", text: `Your ${src} and your resume don't match. Which one is right?`,
      vs: mine ? [[src, m.text], ["Resume", mine]] : [[src, m.text], ["Remy noticed", m.conflict!]],
      options: [{ key: "resume", label: mine ? clip(`${mine} (resume)`) : "My resume" }, { key: "source", label: clip(`${m.text} (${src})`) }] });
  }
  const name = ws.tasks.find((t) => t.source === NAME_CHECK && !t.done);
  const names = name?.why.match(/under "([^"]+)".*says "([^"]+)"/);
  if (name && names) out.push({ id: `name:${name.id}`, kind: "name", text: "Your sign-in account and your resume use different names. Which one is you?",
    vs: [["Account", names[1]], ["Resume", names[2]]], options: [{ key: "resume", label: clip(names[2]) }, { key: "account", label: clip(names[1]) }] });
  for (const c of ws.profileChecks || [])
    out.push({ id: `profile:${c.field}`, kind: "profile", text: `Your resume and your profile disagree about your ${FIELD_NAME[c.field] || c.field}. Which is right?`,
      vs: [["Resume", c.resume], ["Profile", c.profile]], options: [{ key: "resume", label: clip(c.resume) }, { key: "profile", label: clip(c.profile) }] });
  const facts = ws.memory.filter((m) => m.status === "suggested" && !m.conflict).slice(0, 6);
  if (facts.length) {
    const srcs = [...new Set(facts.map((f) => (SETUP_TAP.test(f.source) ? "setup" : shortSource(f.source))))];
    const n = facts.length === 1 ? "1 thing" : `${facts.length} things`;
    out.push({ id: `facts:${facts.map((f) => f.id).join(",")}`, kind: "facts",
      text: srcs.length === 1 && srcs[0] === "setup" ? `In setup you tapped ${n} I suggested. True for you?`
        : srcs.length === 1 ? `I read your ${srcs[0]} and found ${n} I didn't know. True?` : `I found ${n} about you I'm not sure of yet. True?`,
      options: [], items: facts.map((f) => ({ id: f.id, text: f.text })) });
  }
  const passed = passedEmployers(ws)[0];
  if (passed) out.push({ id: `avoid:${passed.company.toLowerCase()}`, kind: "avoid", text: `You passed on ${passed.n} openings at ${passed.company}. Should I stop showing you their openings?`,
    options: [{ key: "avoid", label: `Yes, leave ${clip(passed.company, 28)} out` }, { key: "keep", label: "No, keep showing them" }] });
  const stale = staleApps(ws);
  if (stale.length) {
    const cos = [...new Set(stale.map((a) => ws.jobs.find((j) => j.id === a.jobId)?.company).filter(Boolean))] as string[];
    out.push({ id: `stale:${stale.map((a) => a.id).join(",")}`, kind: "stale",
      text: `You changed your resume after approving ${stale.length === 1 ? "a tailored version" : `${stale.length} tailored versions`}${cos.length ? ` (${cos.slice(0, 3).join(", ")})` : ""}. ${stale.length === 1 ? "It still uses" : "They still use"} your old resume. Want to look again before you send ${stale.length === 1 ? "it" : "them"}?`,
      options: [{ key: "review", label: "Remind me to review" }, { key: "keep", label: "They're fine as they are" }] });
  }
  if (all) return out;
  const later = ws.settings.asksLater || {};
  return out.filter((a) => !(later[a.id] && later[a.id] > today));
}
