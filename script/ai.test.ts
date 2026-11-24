import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStatus, activeClaims, covers, trackRequests } from "../shared/aiStatus";

const julio = `# Julio's AI

Updated: 2026-11-24 06:00 UTC

## Working on now
- Interview history

## Claims
- \`server/routes.ts\`, \`shared/types.ts\` · branch julio/history · until 2026-11-26
- \`client/src/pages/Home.tsx\` · branch julio/old · until 2026-11-01
- not a claim

## Requests
- julio-1 to Dilan (2026-11-24): add a usage field to /api/me

## Answers
- dilan-1 · done · #340 · added the cost line
- dilan-2 · seen
`;
const dilan = `## Requests
- dilan-1 to Julio (2026-11-23): show AI cost per feature
- dilan-2 to Julio (2026-11-23): review #336
- dilan-3 to Julio (2026-11-22): check the planner on Gemini
`;

test("reads a status file", () => {
  const s = parseStatus(julio);
  assert.equal(s.updated, "2026-11-24 06:00 UTC");
  assert.deepEqual(s.workingOn, ["Interview history"]);
  assert.equal(s.claims.length, 2);
  assert.deepEqual(s.claims[0], { paths: ["server/routes.ts", "shared/types.ts"], branch: "julio/history", until: "2026-11-26" });
  assert.deepEqual(s.requests, [{ id: "julio-1", to: "Dilan", date: "2026-11-24", text: "add a usage field to /api/me" }]);
  assert.deepEqual(s.answers[0], { id: "dilan-1", state: "done", pr: "340", note: "added the cost line" });
});

test("expired claims don't count; paths cover files under them", () => {
  assert.equal(activeClaims(parseStatus(julio).claims, "2026-11-24").length, 1);
  assert.ok(covers("native/", "native/src/app.tsx"));
  assert.ok(covers("server/coach/interview", "server/coach/interviewDate.ts"));
  assert.ok(!covers("native/", "client/src/App.tsx"));
});

test("requests carry proof: answered in the receiver's file, overdue after a day, done needs a PR", () => {
  const files = [{ name: "Dilan", status: parseStatus(dilan) }, { name: "Julio", status: parseStatus(julio) }];
  const t = Object.fromEntries(trackRequests(files, "2026-11-24").map((r) => [r.id, r]));
  assert.equal(t["dilan-1"].state, "done");
  assert.equal(t["dilan-1"].pr, "340");
  assert.equal(t["dilan-2"].state, "seen");
  assert.equal(t["dilan-2"].overdue, false);
  assert.equal(t["dilan-3"].state, "sent");
  assert.equal(t["dilan-3"].overdue, true);
  assert.equal(t["julio-1"].overdue, false); // sent today
});
