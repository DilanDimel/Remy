// Owners' tailoring card marks the words Remy changed in a proposed line.
import { test } from "node:test";
import assert from "node:assert/strict";
import { wordDiff } from "@shared/resumeDiff";

test("wordDiff: only the moved or new words are marked", () => {
  const before = "Oversee an estimated annual chapter budget of $5,000+, managing SGA funding allocations and conduct financial planning and variance analysis";
  const after = "Oversee an estimated annual chapter budget of $5,000+, conduct financial planning and variance analysis, and manage SGA funding allocations";
  const d = wordDiff(before, after);
  assert.equal(d.map((x) => x.w).join(" "), after);
  assert.ok(d.slice(0, 9).every((x) => !x.added)); // the unchanged start
  assert.ok(d.some((x) => x.added && x.w === "manage"));
  assert.deepEqual(wordDiff("Led a team", "Led a team"), [{ w: "Led", added: false }, { w: "a", added: false }, { w: "team", added: false }]);
});
