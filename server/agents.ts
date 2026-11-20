// Owners' agent team, kept as simple step-by-step workflows (not agents chatting with each other). Each run's
// output lands in agent_runs; owners turn suggestions into board cards themselves. No student personal data:
// email addresses are stripped before any text reaches the AI.
import { aiJson, aiStatus, aiText, lastCitations, lastUsedModel } from "./ai";
import { NEWS } from "@shared/news";
import { scoutBoards } from "./sources";
import { logAction, overview, saveTask } from "./admin";
import { q, q1 } from "./sql";
import { uid } from "./ids";
import { loadWorkspace } from "./db";
import { milestones } from "@shared/progress";
import type { Workspace } from "@shared/types";

export type Theme = { title: string; count: number; severity: "high" | "medium" | "low"; examples: string[]; todo: string };
const noEmails = (t: string) => t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]");

/** Feedback & bug sorter: groups the last 30 days of open errors and feedback into themes with a suggested to-do. */
export async function sortFeedback(by: string) {
  const rows = await q("SELECT kind, message, COUNT(*)::int AS n FROM error_reports WHERE fixed_at IS NULL AND at > now() - interval '30 days' GROUP BY kind, message ORDER BY COUNT(*) DESC LIMIT 80");
  let themes: Theme[] = [];
  if (rows.length && aiStatus().available) {
    const out = await aiJson<{ themes: Theme[] }>(
      "You sort a small startup's open bug reports and student feedback into at most 6 themes, most urgent first. For each: a short title, how many reports it covers, severity (high = students blocked or data at risk; medium = confusing; low = polish), up to 2 short example quotes, and one concrete to-do for the team. Use only what the reports say.",
      rows.map((r) => `[${r.kind}] (${r.n}x) ${noEmails(String(r.message)).slice(0, 300)}`).join("\n") + '\n\nReturn {"themes":[{"title":"","count":0,"severity":"medium","examples":[""],"todo":""}]}',
      1500,
    );
    themes = (out.themes || []).slice(0, 6).map((t) => ({ title: String(t.title).slice(0, 100), count: Number(t.count) || 0, severity: (["high", "medium", "low"].includes(t.severity) ? t.severity : "medium") as Theme["severity"], examples: (t.examples || []).map((e) => noEmails(String(e)).slice(0, 160)).slice(0, 2), todo: String(t.todo).slice(0, 200) }));
  }
  const output = { themes, reports: rows.reduce((s, r) => s + r.n, 0), note: !rows.length ? "No open errors or feedback in the last 30 days." : !themes.length ? "AI is unavailable, so reports weren't grouped. See Errors & feedback." : "" };
  await q("INSERT INTO agent_runs (id, agent, run_by, output) VALUES ($1, 'feedback', $2, $3)", [uid("ar"), by, JSON.stringify(output)]);
  // Its themes can quote students, and these rows aren't tied to an account: older runs go after 30 days (privacy review).
  await q("DELETE FROM agent_runs WHERE agent = 'feedback' AND at < now() - interval '30 days'");
  await logAction(by, "Ran an agent", "Feedback & bug sorter");
}

/** Weekly analyst: the week's numbers in plain sentences (no AI). */
export async function weeklySummary(by: string) {
  const o = await overview();
  const ch = (a: number, b: number) => (a === b ? "same as last week" : `${a > b ? "up" : "down"} ${Math.abs(a - b)} from last week`);
  const lines = [
    `North star: ${o.northWeek} student${o.northWeek === 1 ? "" : "s"} took a real career step this week (${ch(o.northWeek, o.northPrev)}).`,
    `${o.activeWeek} active student${o.activeWeek === 1 ? "" : "s"} (${ch(o.activeWeek, o.activePrev)}); ${o.newWeek} new sign-up${o.newWeek === 1 ? "" : "s"} (${ch(o.newWeek, o.newPrev)}).`,
    `Setup: ${o.funnel?.setup_done ?? 0} of ${o.funnel?.accounts ?? 0} accounts finished setup; ${o.funnel?.applied ?? 0} started an application.`,
    o.returnWeek1.cohort ? `Return: ${o.returnWeek1.back} of ${o.returnWeek1.cohort} students came back in their first week${o.returnWeek4.cohort ? `, ${o.returnWeek4.back} of ${o.returnWeek4.cohort} in week 4` : ""}.` : "Return rates start once students who signed up after Oct 31 are a week old.",
    `AI this week: ${o.ai.calls} calls, $${o.ai.cost.toFixed(2)}${o.ai.failed ? `, ${o.ai.failed} failed` : ""}.`,
    `${o.openErrors} open error${o.openErrors === 1 ? "" : "s"} and ${o.feedback} new feedback note${o.feedback === 1 ? "" : "s"}.`,
  ];
  await q("INSERT INTO agent_runs (id, agent, run_by, output) VALUES ($1, 'weekly', $2, $3)", [uid("ar"), by, JSON.stringify({ lines })]);
  await logAction(by, "Ran an agent", "Weekly analyst");
}

const save = (agent: string, by: string, output: unknown) => q("INSERT INTO agent_runs (id, agent, run_by, output) VALUES ($1, $2, $3, $4)", [uid("ar"), agent, by, JSON.stringify(output)]);

/** Openings scout (no AI): which employer sites answer, which readers look broken, and fields with few early-career openings. */
export async function scout(by: string) {
  const r = await scoutBoards();
  const fields = new Map<string, { employers: number; early: number }>();
  for (const b of r) for (const f of b.fields) { const x = fields.get(f) || { employers: 0, early: 0 }; x.employers++; x.early += b.early; fields.set(f, x); }
  const output = {
    reached: r.filter((b) => b.ok).length, tried: r.length, early: r.reduce((s, b) => s + b.early, 0),
    broken: r.filter((b) => !b.ok).map((b) => ({ company: b.company, error: b.error || "" })).sort((a, b) => a.company.localeCompare(b.company)),
    quiet: r.filter((b) => b.ok && !b.total).map((b) => b.company).sort(),
    thin: [...fields].map(([field, x]) => ({ field, ...x })).sort((a, b) => a.early - b.early).slice(0, 8),
  };
  await save("scout", by, output);
  await logAction(by, "Ran an agent", "Openings scout");
}

// Perplexity Sonar searches the web and cites its sources; it goes through the same OpenRouter key as everything else.
export const RESEARCH_MODEL = process.env.OR_RESEARCH_CHAIN || "openrouter:perplexity/sonar";

/** Researcher: an owner's question answered from live web sources. Owners type the question; no student data goes in. */
export async function research(by: string, question: string) {
  const qn = noEmails(question.trim()).slice(0, 600);
  if (qn.length < 8) throw Object.assign(new Error("Ask a full question, like “Which Texas universities have startup grants for student founders?”"), { status: 400 });
  const answer = await aiText(
    "You research for a student startup team building Remy, an AI career coach for college students (beta, Texas Christian University, Fort Worth). Answer in under 250 words with short bullet points. Cite your sources with [1], [2]. Say clearly when something couldn't be confirmed, and never guess dates, prices or eligibility rules. This is a single answer: don't offer follow-ups.",
    qn, 900, RESEARCH_MODEL,
  );
  const sources = lastCitations().filter((s) => /^https?:\/\//.test(s.url)).slice(0, 20);
  const web = /perplexity|:online/.test(lastUsedModel()) && sources.length > 0;
  await save("research", by, { question: qn, answer: answer.slice(0, 4000), sources, web, model: lastUsedModel() });
  await logAction(by, "Ran an agent", "Researcher");
}

/** Marketing drafter: drafts from recent "What's new" notes and this week's totals. It never posts or sends anything. */
export async function marketing(by: string, brief: string) {
  const o = await overview();
  const recent = NEWS.filter((n) => !n.owners).slice(0, 6).map((n) => `- ${n.title}: ${n.body}`).join("\n");
  const out = await aiJson<{ linkedin: string; instagram: string; email: { subject: string; body: string } }>(
    "You write marketing drafts for Remy, a beta AI career coach built by a student team at TCU. Warm, plain and specific; no hype words (revolutionary, game-changing), no emoji walls, no made-up numbers, quotes or partners. Use only the facts given. Say it's a beta. Remy never applies or sends anything for students; don't imply it does.",
    `RECENT UPDATES:\n${recent}\n\nNUMBERS YOU MAY USE (totals only): ${o.activeWeek} active students this week; ${o.funnel?.accounts ?? 0} accounts.\n\nTEAM'S BRIEF: ${noEmails(brief).slice(0, 400) || "(none: introduce Remy to TCU students)"}\n\nReturn {"linkedin":"post under 120 words","instagram":"caption under 60 words with up to 3 hashtags","email":{"subject":"","body":"short email to a professor or club officer asking them to share Remy with students, under 120 words, signed 'The Remy team'"}}`,
    1500,
  );
  const s = (x: unknown, n: number) => String(x || "").slice(0, n);
  await save("marketing", by, { brief: s(brief, 400), linkedin: s(out.linkedin, 1500), instagram: s(out.instagram, 800), email: { subject: s(out.email?.subject, 200), body: s(out.email?.body, 2000) } });
  await logAction(by, "Ran an agent", "Marketing drafter");
}

/** Retention watcher (no AI, counts only): students who went quiet (last visit 8–21 days ago) and the
 * Road-to-an-offer step most of them stopped before, plus sign-ups who never finished setup. */
export function retentionReport(list: Workspace[], today: string) {
  const ago = (d: string) => Math.round((Date.parse(today + "T12:00:00Z") - Date.parse(d + "T12:00:00Z")) / 864e5);
  const stuck = new Map<string, number>();
  let quiet = 0, noSetup = 0;
  for (const ws of list) {
    const last = (ws.visits || []).at(-1);
    if (!ws.onboarding.done) { noSetup++; continue; }
    if (!last || ago(last) < 8 || ago(last) > 21) continue;
    quiet++;
    const next = milestones(ws).find((m) => !m.done)?.label || "Every milestone done";
    stuck.set(next, (stuck.get(next) || 0) + 1);
  }
  return { quiet, noSetup, stoppedAt: [...stuck].map(([step, n]) => ({ step, n })).sort((a, b) => b.n - a.n) };
}
export async function retention(by: string) {
  // shortcut: loads every signed-in workspace; move to SQL past ~1,000 students.
  const list = await Promise.all((await q("SELECT u.id FROM users u WHERE u.kind IN ('google','supabase')")).map((r) => loadWorkspace(String(r.id))));
  await save("retention", by, retentionReport(list, new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" })));
  await logAction(by, "Ran an agent", "Retention watcher");
}

/** The latest run of each agent. */
export async function agentRuns() {
  const latest = async (agent: string) => (await q1("SELECT at, run_by, output FROM agent_runs WHERE agent = $1 ORDER BY at DESC LIMIT 1", [agent])) || null;
  return { feedback: await latest("feedback"), weekly: await latest("weekly"), scout: await latest("scout"), research: await latest("research"), marketing: await latest("marketing"), retention: await latest("retention"), ai: aiStatus().available };
}

/** Turns a suggested to-do into a board card. */
export const addSuggestion = (by: string, title: string) => saveTask(by, { title: String(title).slice(0, 300), notes: "Suggested by the Feedback & bug sorter" });
