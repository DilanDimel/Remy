import assert from "node:assert/strict";
import fs from "node:fs";
const host = "http://127.0.0.1:5000";
const results: string[] = [];
async function req(path: string, data?: unknown, visitor = "qa-api") {
  const r = await fetch(host + path, {
    method: data ? "POST" : "GET",
    headers: {
      "X-Visitor-Id": visitor,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return { status: r.status, body: await r.text() };
}
const action = (type: string, data: unknown, visitor = "qa-api") =>
  req("/api/action", { type, data }, visitor);
let r = await action("reset", { persona: "finance" });
assert.equal(r.status, 200);
const s = JSON.parse(r.body);
await action("task-add", { title: "Isolated task" });
const other = JSON.parse(
  (await req("/api/state", undefined, "qa-api-other")).body,
);
assert(!other.tasks.some((t: any) => t.title === "Isolated task"));
results.push("Visitor workspace isolation passed.");
r = await req("/api/export/app-bell?format=txt");
assert.equal(r.status, 400);
results.push("Export before approval rejected on server.");
r = await action("test-claim", { applicationId: "app-bell" });
const bad = JSON.parse(r.body)
  .applications.find((a: any) => a.id === "app-bell")
  .claims.at(-1);
r = await action("claim-approve", {
  applicationId: "app-bell",
  claimId: bad.id,
});
assert.equal(r.status, 400);
results.push("Unsupported claim approval rejected on server.");
await action("claim-remove", { applicationId: "app-bell", claimId: bad.id });
const current = JSON.parse((await req("/api/state")).body);
for (const c of current.applications.find((a: any) => a.id === "app-bell")
  .claims) {
  r = await action("claim-approve", {
    applicationId: "app-bell",
    claimId: c.id,
  });
  assert.equal(r.status, 200);
}
r = await action("letter-approve", { id: "app-bell" });
assert.equal(r.status, 200);
r = await req("/api/export/app-bell?format=txt");
assert.equal(r.status, 200);
assert(r.body.includes("COVER LETTER"));
results.push("Reviewed application export passed.");
r = await action("profile", {
  ...s.profile,
  credits: 20,
  sponsorship: "needs",
});
assert.equal(r.status, 200);
r = await req("/api/export/app-bell?format=txt");
assert.equal(r.status, 400);
results.push("Profile change invalidates approvals.");
r = await action("meeting-add", {
  title: "Conflict check",
  date: "2026-10-19",
  time: "10:30",
  duration: 30,
});
assert.equal(r.status, 400);
r = await action("meeting-add", {
  title: "Valid tentative plan",
  date: "2026-10-19",
  time: "15:00",
  duration: 30,
});
assert.equal(r.status, 200);
const m = JSON.parse(r.body).meetings.at(-1);
r = await req("/api/calendar/" + m.id);
assert.equal(r.status, 200);
assert(r.body.includes("20261019T200000Z"));
assert(!r.body.includes("ATTENDEE"));
results.push("Chicago conflict checking and non-inviting ICS passed.");
r = await req("/api/calendar/" + m.id, undefined, "qa-api-other");
assert.equal(r.status, 400);
results.push("Cross-visitor meeting lookup rejected.");
const job = {
  company: "Test fixture",
  title: "Excel intern",
  location: "Fort Worth, TX",
  field: "Finance",
  source: "http://example.com/qa-api",
  description: "Use Excel for reporting and analysis.",
};
r = await action("job-import", job);
assert.equal(r.status, 400);
job.source = "https://example.com/qa-api";
r = await action("job-import", job);
assert.equal(r.status, 200);
r = await action("job-import", job);
assert.equal(r.status, 400);
results.push("HTTP and duplicate import rejection passed.");
r = await action("notification", { id: "invalid", value: false });
assert.equal(r.status, 400);
r = await action("profile", { ...s.profile, credits: -2 });
assert.equal(r.status, 400);
results.push("Invalid settings and profile input rejected.");
r = await req("/api/coverage");
assert.equal(r.status, 200);
assert(r.body.includes('"n155"'));
results.push("155-node coverage download passed.");
r = await req("/api/product-brief");
assert.equal(r.status, 200);
assert(r.body.length > 20000);
results.push("Full product brief download passed.");
r = await req("/api/evidence");
assert.equal(r.status, 200);
assert(JSON.parse(r.body).connections);
results.push("Complete workspace export passed.");
fs.writeFileSync(
  "docs/regression-results.json",
  JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2),
);
console.log(results.join("\n"));
