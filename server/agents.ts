// Owners' agent team, kept as simple step-by-step workflows (not agents chatting with each other). Each run's
// output lands in agent_runs; owners turn suggestions into board cards themselves. No student personal data:
// email addresses are stripped before any text reaches the AI.
import { aiJson, aiStatus } from "./ai";
import { logAction, overview, saveTask } from "./admin";
import { q, q1 } from "./sql";
import { uid } from "./ids";

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
    `AI this week: ${o.ai.calls} calls, $${o.ai.cost.toFixed(2)}${o.ai.failed ? `, ${o.ai.failed} failed` : ""}.`,
    `${o.openErrors} open error${o.openErrors === 1 ? "" : "s"} and ${o.feedback} new feedback note${o.feedback === 1 ? "" : "s"}.`,
  ];
  await q("INSERT INTO agent_runs (id, agent, run_by, output) VALUES ($1, 'weekly', $2, $3)", [uid("ar"), by, JSON.stringify({ lines })]);
  await logAction(by, "Ran an agent", "Weekly analyst");
}

/** The latest run of each agent. */
export async function agentRuns() {
  const latest = async (agent: string) => (await q1("SELECT at, run_by, output FROM agent_runs WHERE agent = $1 ORDER BY at DESC LIMIT 1", [agent])) || null;
  return { feedback: await latest("feedback"), weekly: await latest("weekly"), ai: aiStatus().available };
}

/** Turns a suggested to-do into a board card. */
export const addSuggestion = (by: string, title: string) => saveTask(by, { title: String(title).slice(0, 300), notes: "Suggested by the Feedback & bug sorter" });
