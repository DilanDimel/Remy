// Owners' dashboard numbers: beta funnel and outcomes, counted in SQL. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, ensureUser, saveWorkspace } from "../platform/db";
import { add, parseAnswers, saveApplication, decide } from "../platform/beta";
import { dataTransfer, flushDbBytes, funnel, outcomes, workspaceSizes } from "./insights";

test("insights: data transfer adds up per day and month", async () => {
  await flushDbBytes(3 * 1048576);
  await flushDbBytes(2 * 1048576);
  await flushDbBytes(0);
  const t = await dataTransfer();
  assert.equal(t.monthMb, 5);
  assert.equal(t.days.length, 1);
  assert.equal(t.days[0].mb, 5);
  assert.equal(t.limitGb, 250);
});

process.env.OWNER_EMAILS = "founder@insights.test";
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const ev = (status: string, i: number) => ({ id: "e" + i, at: new Date(2026, 9, 1 + i).toISOString(), status, source: "Manual" });
const item = (id: string, hist: string[], tailored = false) => ({ id, company: id, role: "Intern", status: hist[hist.length - 1], notes: "", events: hist.map(ev), ...(tailored ? { applicationId: "a" + id } : {}) });

test("insights: funnel from applications to active students, and outcomes across real students only", async () => {
  for (const [email, name, school] of [["ana@ins.edu", "Ana", "TCU"], ["ben@ins.edu", "Ben", "TCU"], ["cy@ins.edu", "Cy", "UTA"]]) {
    await saveApplication(parseAnswers({ "First & Last Name": name, "School / University": school, "School Email Address": email, "Class Year": "Junior", "How did you hear about us?": "tcu-table", "Can you give 5 minutes a week for feedback?": "Yes" })!);
  }
  await decide("founder@insights.test", "ana@ins.edu", "accepted", "Cohort 1");
  await decide("founder@insights.test", "cy@ins.edu", "declined");
  await add("founder@insights.test", "ben@ins.edu"); // accepted by hand, never signed in

  // Ana signed in, finished setup, came back this week, applied to 3 places (one tailored, answered; one rejected; one waiting).
  await ensureUser({ id: "sb:ins-ana", kind: "supabase", email: "ana@ins.edu", name: "Ana", picture: "" });
  const ws = emptyWorkspace() as any;
  ws.onboarding.done = true; ws.visits = [today];
  ws.tracker = [item("A", ["Applied", "Heard back"], true), item("B", ["Applied", "Rejected"]), item("C", ["Applied"]), item("D", ["Saved"])];
  ws.jobFeedback = { j1: { rating: 5 }, j2: { rating: 1 } };
  await saveWorkspace("sb:ins-ana", ws);
  // The founder's own test applications don't count as student outcomes.
  await ensureUser({ id: "sb:ins-founder", kind: "supabase", email: "founder@insights.test", name: "", picture: "" });
  const f = emptyWorkspace() as any; f.tracker = [item("Z", ["Applied", "Offer"])];
  await saveWorkspace("sb:ins-founder", f);

  const fun = await funnel();
  assert.deepEqual([fun.applied, fun.accepted, fun.declined, fun.waiting, fun.feedback], [3, 1, 1, 1, 3]);
  assert.equal(fun.on_list, 2);
  assert.deepEqual([fun.signed_in, fun.set_up, fun.active_week], [1, 1, 1]);
  assert.deepEqual(fun.bySchool.find((r: any) => r.label === "TCU"), { label: "TCU", applied: 2, accepted: 1 });

  const out = await outcomes();
  assert.deepEqual([out.applied, out.answered, out.interviews, out.offers], [3, 2, 0, 0]);
  assert.deepEqual([out.applied_tailored, out.answered_tailored, out.students_applying], [1, 1, 1]);
  assert.deepEqual([out.students_rating, out.ratings], [1, 2]);

  const sizes = await workspaceSizes();
  assert.ok(sizes.n >= 2 && sizes.max_kb >= sizes.avg_kb);
});
