// Home greeting copy (owners first, Nov 22, 2026).
export const many = (n: number, one: string, more = one + "s") => `${n} ${n === 1 ? one : more}`;

/** Owners first (Dilan, Nov 22: Home "has no soul"): one line in Remy's voice under the greeting that reacts to what's
 *  actually going on, instead of a fixed subtitle. First match wins, most urgent first. */
export function remyLine(o: { hour: number; interviewSoon: boolean; cheer: boolean; done: number; total: number; newJobs: number; deadlines: number; pending: number }) {
  if (o.interviewSoon) return "Big couple of days. We'll get you ready one small step at a time.";
  if (o.cheer) return `Nice, that's ${o.done} of ${o.total} done. You're building momentum.`;
  if (o.deadlines) return `${many(o.deadlines, "deadline")} this week. I'm keeping ${o.deadlines === 1 ? "it" : "them"} in front of you.`;
  if (o.pending) return `You're one review away from a finished application.`;
  if (o.newJobs) return `${many(o.newJobs, "new opening")} since you were last here. I already checked which ones you can apply to.`;
  if (o.hour >= 22 || o.hour < 5) return "Late one. Do the one thing below, then get some sleep.";
  if (o.done === 0) return "Let's start small. One step today is plenty.";
  if (o.done < o.total) return `${o.done} of ${o.total} getting-started steps done. ${o.total - o.done} to go, and none take long.`;
  return "Here's where things stand. One thing at a time.";
}
