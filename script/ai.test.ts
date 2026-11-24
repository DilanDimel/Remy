import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStatus, activeClaims, covers } from "../shared/aiStatus";

const md = `# Julio's AI

Updated: 2026-11-24 06:00 UTC

## Working on now
- Interview history

## Claims
- \`server/routes.ts\`, \`shared/types.ts\` · branch julio/history · until 2026-11-26
- \`client/src/pages/Home.tsx\` · branch julio/old · until 2026-11-01
- not a claim

## Requests
- to Lead: add a usage field to /api/me
`;

test("reads a status file", () => {
  const s = parseStatus(md);
  assert.equal(s.updated, "2026-11-24 06:00 UTC");
  assert.deepEqual(s.workingOn, ["Interview history"]);
  assert.equal(s.claims.length, 2);
  assert.deepEqual(s.claims[0], { paths: ["server/routes.ts", "shared/types.ts"], branch: "julio/history", until: "2026-11-26" });
  assert.deepEqual(s.requests, [{ to: "Lead", text: "add a usage field to /api/me" }]);
});

test("expired claims don't count; paths cover files under them", () => {
  assert.equal(activeClaims(parseStatus(md).claims, "2026-11-24").length, 1);
  assert.ok(covers("native/", "native/src/app.tsx"));
  assert.ok(covers("server/coach/interview", "server/coach/interviewDate.ts"));
  assert.ok(!covers("native/", "client/src/App.tsx"));
});
