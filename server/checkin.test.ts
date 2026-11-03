// Check-ins keep only what the student said. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCheckin } from "./checkin";

test("check-in: invented details are dropped, the student's own words stay", () => {
  const said = "I volunteered at the Tarrant Area Food Bank on Saturday sorting donations";
  const d = cleanCheckin("Volunteered", said, {
    fact: "Volunteered at the Tarrant Area Food Bank, sorting donations",
    bullet: "Sorted donations at the Tarrant Area Food Bank, supporting poverty alleviation",
    linkedin: { section: "Volunteering", fields: [{ label: "Organization", value: "Tarrant Area Food Bank" }, { label: "Cause", value: "Poverty Alleviation" }] },
  });
  assert.equal(d.fact, "Volunteered at the Tarrant Area Food Bank, sorting donations");
  assert.equal(d.bullet, "Volunteered at the Tarrant Area Food Bank, sorting donations"); // the checked fact stands in
  assert.deepEqual(d.linkedin.fields.map((f) => f.label), ["Organization"]);
  const e = cleanCheckin("Leadership role", "I'm treasurer of Finance Club now", { fact: "Elected by peers as Treasurer of the Finance Club", bullet: "", linkedin: { section: "Nowhere", fields: [{ label: "x", value: "Finance Club" }] } });
  assert.equal(e.fact, "I'm treasurer of Finance Club now");
  assert.equal(e.linkedin.fields.length, 0);
  assert.equal(cleanCheckin("Club", "I joined the Finance Club", { fact: "x" }).fact, "I joined the Finance Club");
});

test("check-in follow-ups: questions with at least two tap answers, at most two of them", () => {
  const d = cleanCheckin("Volunteered", "I volunteered at the food bank sorting donations", { followups: [
    { q: "How many hours did you volunteer?", options: ["1–3", "4–8", "More than 8"] },
    { q: "Not a question", options: ["a", "b"] },
    { q: "How often?", options: ["Once"] },
    { q: "About how many pounds?", options: ["Under 500", "500–1,000"] },
  ] });
  assert.deepEqual(d.followups.map((f) => f.q), ["How many hours did you volunteer?", "About how many pounds?"]);
});

test("check-in proposals: hours, applications and interviews, only when the sentence says so", async () => {
  const { checkinProposals } = await import("@shared/checkin");
  const tracker = [{ id: "t1", company: "Frost Bank", role: "Analyst", status: "Saved", notes: "", events: [] }, { id: "t2", company: "Texas Capital", role: "", status: "Applied", notes: "", events: [] }] as any;
  const p = (kind: string, said: string) => checkinProposals({ tracker }, kind, said).map((x) => x.label);
  assert.deepEqual(p("Volunteered", "Shadowed Dr. Lee at Cook Children's for about 18 hours."), ["Log 18 h of Shadowing in Progress → Hours"]);
  assert.deepEqual(p("Worked shifts", "Worked 12 hours at Chick-fil-A and applied to Frost Bank."), ["Log 12 h of Work shifts in Progress → Hours", "Mark Frost Bank (Analyst) as Applied"]);
  assert.deepEqual(p("Club", "Applied to Goldman Sachs summer program."), ["Track your application to Goldman Sachs (Applied)"]);
  assert.deepEqual(p("Club", "Had an interview with Texas Capital on Tuesday."), ["Mark Texas Capital as Interview"]);
  assert.deepEqual(p("Club", "I want to apply to Frost Bank next week."), []); // a plan, not a fact
  assert.deepEqual(p("Club", "Led our weekly meeting and planned the food drive."), []);
  // Second review: job titles, non-employers, negations, totals, ranges and look-alike names stay out.
  assert.deepEqual(p("Club", "Applied for Summer Analyst at Frost Bank."), ["Mark Frost Bank (Analyst) as Applied"]);
  for (const s of ["Applied with LinkedIn Easy Apply.", "I applied to TCU's honors college.", "I applied to Remy as a tester.", "I never applied to Frost Bank.", "Still haven't had an interview with Texas Capital.", "Mock interview with Frost Bank recruiter at the career fair.", "Volunteered 400 hours total over the year.", "Volunteered 10-12 hours.", "2 hours on Monday and 3 hours on Friday.", "Spent 3 hours applying to Goldman Sachs."])
    assert.deepEqual(p("Volunteered", s).filter((x) => !/^Log .* of Volunteering/.test(x) || /400|10-12|Monday/.test(s)), [], s);
  assert.deepEqual(p("Club", "Applied to Frost Bank Foundation scholarship."), ["Track your application to Frost Bank Foundation (Applied)"]); // not Frost Bank itself
  assert.deepEqual(p("Club", "I Applied To JPMorgan Chase."), ["Track your application to JPMorgan Chase (Applied)"]);
  assert.equal(checkinProposals({ tracker }, "Club", "Applied to Goldman Sachs.")[0].checked, false); // new tracker items start unticked
});
