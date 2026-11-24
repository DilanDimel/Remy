import { test } from "node:test";
import assert from "node:assert/strict";
import { competitionsFor, compToJob, knownFor, type Comp } from "./competitions";

const comp = (o: Partial<Comp> = {}): Comp => ({ name: "Global Trading Challenge", organizer: "Bloomberg", kind: "trading", deadline: "2099-01-15", start: "2099-02-01", end: "2099-04-30", location: "Virtual", entry: "school", url: "https://example.org/gtc", ...o });

test("competition finder: lists the student's field's competitions as events with the sign-up deadline", async () => {
  const ws = { profile: { major: "Finance", path: "", targetRoles: "", interests: "" } } as any;
  let asked = "";
  const jobs = await competitionsFor(ws, async (field) => { asked = field; return [comp(), comp({ name: "Old Case Cup", deadline: "2001-01-01", start: "2001-02-01", url: "https://example.org/old" })]; });
  assert.equal(asked, "Finance");
  assert.deepEqual(jobs.map((j) => [j.kind, j.title, j.company, j.deadline, j.format]), [["event", "Global Trading Challenge", "Bloomberg", "2099-01-15", "Remote"]], "past ones are dropped");
  assert.match(jobs[0].summary, /trading challenge by Bloomberg for finance students/);
  assert.match(jobs[0].summary, /enter through their university/, "school-entered contests say how to get in");
  assert.equal(jobs[0].applyUrl, "https://example.org/gtc");
  assert.deepEqual(await competitionsFor({ profile: { major: "Underwater basket weaving", path: "", targetRoles: "", interests: "" } } as any, async () => { throw new Error("not asked"); }), []);
});

test("competition finder: open contests don't tell students to ask their school; start-only contests say to check the deadline", () => {
  const j = compToJob(comp({ entry: "open", kind: "hackathon", deadline: "", location: "Austin, TX" }), "Tech and IT");
  assert.doesNotMatch(j.summary, /university/);
  assert.match(j.summary, /^A hackathon by Bloomberg for tech and IT students/);
  assert.equal(j.format, "In person");
  assert.match(j.deadlineText, /^Starts Feb 1, 2099/);
});

test("competition finder: known competitions are hints for the researcher, picked by field", () => {
  assert.ok(knownFor("Finance").includes("Bloomberg Global Trading Challenge"));
  assert.ok(knownFor("Tech and IT").some((n) => /hackathon/i.test(n)));
  assert.deepEqual(knownFor("Social work"), []);
});
