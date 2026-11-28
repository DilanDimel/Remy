import type { ChatDid, MemoryFact, Task, Workspace } from "@shared/types";
import { type Ask, resumeSide, shortSource, sourceOf } from "@shared/remyAsks";
import { uid } from "../platform/ids";

// Owners (Nov 24): what happens when the student taps an answer to one of Remy's questions (shared/remyAsks.ts).
// Remy does the fix himself; nothing about the resume's words changes here (that stays Accept / Edit / Skip), and
// nothing is sent. Undo puts back exactly what the answer touched, nothing else.

type Snap = { facts: Record<string, MemoryFact | null>; tasks: Record<string, Task | null>; profile: Record<string, string>; checks?: Workspace["profileChecks"]; stale?: Record<string, string>; later?: Record<string, string> };
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);

/** Applies the answer. Returns what Remy says, a line to copy (when there is one) and the Undo record. */
export function answerAsk(ws: Workspace, ask: Ask, body: { answer?: unknown; keep?: unknown }, today: string): { text: string; copy?: string; did?: ChatDid } {
  const answer = String(body.answer || "");
  if (answer === "later") {
    // Asked again in two weeks; old entries drop off so the record stays small.
    const later = Object.fromEntries(Object.entries(ws.settings.asksLater || {}).filter(([, d]) => d > today));
    ws.settings.asksLater = { ...later, [ask.id]: addDays(today, 14) };
    return { text: "" };
  }
  const snap: Snap = { facts: {}, tasks: {}, profile: {} };
  const keepFact = (id: string) => { if (!(id in snap.facts)) { const f = ws.memory.find((m) => m.id === id); snap.facts[id] = f ? structuredClone(f) : null; } };
  const keepTask = (id: string) => { if (!(id in snap.tasks)) { const t = ws.tasks.find((x) => x.id === id); snap.tasks[id] = t ? structuredClone(t) : null; } };
  const keepProfile = (k: keyof Workspace["profile"]) => { if (!(k in snap.profile)) snap.profile[k] = String(ws.profile[k] ?? ""); };
  const tick = (match: (t: Task) => boolean) => { for (const t of ws.tasks.filter((x) => !x.done && match(x))) { keepTask(t.id); t.done = true; } };
  let text = "", label = "", copy: string | undefined;

  if (ask.kind === "conflict") {
    const m = ws.memory.find((x) => `conflict:${x.id}` === ask.id)!;
    const src = shortSource(m.source), full = sourceOf(m.source).replace(/\s*\(.*$/, "");
    keepFact(m.id);
    if (answer === "resume") {
      ws.memory = ws.memory.filter((x) => x.id !== m.id);
      tick((t) => t.title === `Update your ${full} to match your resume`);
      copy = resumeSide(m.conflict!) || undefined;
      text = copy ? `Got it, your resume is right. Paste this on ${src} so they match:` : `Got it, your resume is right. Change your ${src} to match it when you can.`;
      label = `Kept your resume over ${src}`;
    } else if (answer === "source") {
      const was = m.conflict;
      m.status = "approved"; delete m.conflict; m.updatedAt = new Date().toISOString();
      const id = uid("t");
      keepTask(id);
      ws.tasks.unshift({ id, title: "Update your resume to match", why: `You said ${src} is right: "${m.text}". ${was}. Change your resume so they match; Remy ticks this off when you do.`, due: "", category: "Prepare", done: false, source: `${full} check`, link: "/resume?tab=base&sub=edit" });
      text = `Got it, ${src} is right. I added a to-do to change your resume to match, and I'll tick it off when you edit it.`;
      label = `${src} is right: ${m.text}`;
    }
  } else if (ask.kind === "name") {
    const t = ws.tasks.find((x) => `name:${x.id}` === ask.id)!;
    const [, account, resume] = t.why.match(/under "([^"]+)".*says "([^"]+)"/)!;
    tick((x) => x.id === t.id);
    if (answer === "resume") {
      keepProfile("name"); keepProfile("preferredName");
      ws.profile.name = resume;
      if (!ws.profile.preferredName || ws.profile.preferredName === account.split(/\s+/)[0]) ws.profile.preferredName = resume.split(/\s+/)[0];
      text = `Got it, you're ${resume}. Your profile uses that name now.`;
      label = `Your name is ${resume}`;
    } else if (answer === "account") {
      text = `Got it, I'll keep ${account}.`;
      label = `Kept the name ${account}`;
    }
  } else if (ask.kind === "profile") {
    const field = ask.id.slice("profile:".length) as keyof Workspace["profile"];
    const c = (ws.profileChecks || []).find((x) => x.field === field)!;
    snap.checks = structuredClone(ws.profileChecks || []);
    ws.profileChecks = (ws.profileChecks || []).filter((x) => x.field !== field);
    if (answer === "resume") {
      keepProfile(field);
      (ws.profile as unknown as Record<string, string>)[field] = c.resume;
      ws.fits = {}; // openings are re-checked against the new profile, as after a resume upload
      for (const a of ws.applications) if (a.versions.length) a.staleReason = `Your profile changed on ${new Date().toLocaleDateString("en-US")}. This approved version was not changed — review whether it still fits.`;
      text = `Updated your profile to ${c.resume}. I'll re-check your openings with it.`;
      label = `Profile now says ${c.resume}`;
    } else if (answer === "profile") {
      text = `Got it, I kept ${c.profile} in your profile.`;
      label = `Kept ${c.profile} in your profile`;
    }
  } else if (ask.kind === "facts") {
    const keep = new Set(Array.isArray(body.keep) ? body.keep.map(String) : []);
    let kept = 0, dropped = 0;
    for (const it of ask.items || []) {
      keepFact(it.id);
      if (keep.has(it.id)) { const f = ws.memory.find((m) => m.id === it.id); if (f) { f.status = "approved"; f.updatedAt = new Date().toISOString(); kept++; } }
      else { ws.memory = ws.memory.filter((m) => m.id !== it.id); dropped++; }
    }
    if (kept + dropped) {
      text = kept && dropped ? `Saved ${kept} and left out ${dropped}.` : kept ? `Saved ${kept === 1 ? "it" : `all ${kept}`}. I'll use ${kept === 1 ? "it" : "them"} from now on.` : "Left them out. I won't use them.";
      label = `Saved ${kept} fact${kept === 1 ? "" : "s"}${dropped ? `, left out ${dropped}` : ""}`;
    }
  } else if (ask.kind === "avoid") {
    const company = ask.text.match(/openings at (.+)\. Should I/)![1];
    if (answer === "avoid") {
      keepProfile("avoid");
      ws.profile.avoid = [ws.profile.avoid, company].filter((x) => x?.trim()).join(", ");
      ws.fits = {}; // openings are re-checked, and the avoid list hides theirs (server/jobs/fit.ts notWanted)
      text = `Done. I won't show you ${company}${/s$/i.test(company) ? "'" : "'s"} openings. You can take them off your avoid list in Preferences.`;
      label = `Leaving ${company} out`;
    } else if (answer === "keep") {
      snap.later = { ...(ws.settings.asksLater || {}) };
      ws.settings.asksLater = { ...ws.settings.asksLater, [ask.id]: addDays(today, 365) };
      text = `Got it, I'll keep showing ${company}.`;
      label = `Kept showing ${company}`;
    }
  } else if (ask.kind === "stale") {
    const ids = ask.id.slice("stale:".length).split(",");
    if (answer === "keep") {
      snap.stale = {};
      for (const a of ws.applications.filter((x) => ids.includes(x.id) && x.staleReason)) { snap.stale[a.id] = a.staleReason!; a.staleReason = undefined; }
      text = ids.length === 1 ? "Got it, that version stays as it is." : "Got it, those versions stay as they are.";
      label = "Kept your approved versions";
    } else if (answer === "review") {
      const id = uid("t");
      keepTask(id);
      ws.tasks.unshift({ id, title: ids.length === 1 ? "Review your tailored version" : `Review your ${ids.length} tailored versions`, why: "You changed your resume after approving them. Open each one, check it still fits, and approve it again or regenerate it.", due: addDays(today, 2), category: "Apply", done: false, source: "Remy's question", link: "/resume?tab=tailor" });
      text = "I added a to-do to review them in the next two days.";
      label = "Added: review your tailored versions";
    }
  }
  if (!text) return { text: "That answer doesn't fit this question." };
  return { text, copy, did: { id: uid("d"), kind: "ask", ref: ask.id, label, old: JSON.stringify(snap), link: "/accounts?tab=memory" } };
}

/** Undo: puts back the facts, to-dos, profile fields and checks the answer changed. */
export function undoAsk(ws: Workspace, d: ChatDid) {
  const s = JSON.parse(String(d.old || "{}")) as Snap;
  const put = <T extends { id: string }>(list: T[], before: Record<string, T | null>) => {
    let out = list;
    for (const [id, v] of Object.entries(before || {})) {
      const i = out.findIndex((x) => x.id === id);
      if (!v) out = out.filter((x) => x.id !== id);
      else if (i >= 0) out = out.map((x) => (x.id === id ? v : x));
      else out = [...out, v];
    }
    return out;
  };
  ws.memory = put(ws.memory, s.facts);
  ws.tasks = put(ws.tasks, s.tasks);
  Object.assign(ws.profile, s.profile || {});
  if (s.checks) ws.profileChecks = s.checks;
  for (const [id, why] of Object.entries(s.stale || {})) { const a = ws.applications.find((x) => x.id === id); if (a) a.staleReason = why; }
  if (s.later) ws.settings.asksLater = s.later;
  if ("avoid" in (s.profile || {})) ws.fits = {};
}

/** Row 14: a to-do whose thing really happened ticks itself, and Remy says so in his chat with Undo. */
export function tickDone(ws: Workspace, match: (t: Task) => boolean, why: string) {
  const did: ChatDid[] = [];
  for (const t of ws.tasks.filter((x) => !x.done && match(x))) { t.done = true; did.push({ id: uid("d"), kind: "done", ref: t.id, label: `Ticked off: ${t.title}`, link: "/" }); }
  if (did.length) ws.chat.push({ id: uid("m"), role: "assistant", text: `${why} I ticked ${did.length === 1 ? "that to-do" : "those to-dos"} off for you.`, at: new Date().toISOString(), page: "Remy", did });
}
