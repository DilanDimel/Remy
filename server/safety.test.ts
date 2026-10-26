// The crisis check behind the assistant chat. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CRISIS } from "./safety";

test("crisis check: catches direct statements of self-harm", () => {
  for (const m of ["I want to kill myself", "honestly i wanna die", "thinking about suicide", "I've been cutting myself", "I don't want to live anymore", "everyone would be better off dead without me"])
    assert.ok(CRISIS.test(m), m);
});
test("crisis check: ignores everyday career stress", () => {
  for (const m of ["this job search is killing me", "I'm dying to get this internship", "my GPA is dead", "how do I cut my resume to one page?", "I want to end my internship early"])
    assert.ok(!CRISIS.test(m), m);
});
