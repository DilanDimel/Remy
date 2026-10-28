// The crisis check behind the assistant chat. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CRISIS, chatActions } from "./safety";

test("crisis check: catches direct statements of self-harm", () => {
  for (const m of ["I want to kill myself", "honestly i wanna die", "thinking about suicide", "I've been cutting myself", "I don't want to live anymore", "everyone would be better off dead without me"])
    assert.ok(CRISIS.test(m), m);
});
test("crisis check: ignores everyday career stress", () => {
  for (const m of ["this job search is killing me", "I'm dying to get this internship", "my GPA is dead", "how do I cut my resume to one page?", "I want to end my internship early"])
    assert.ok(!CRISIS.test(m), m);
});

test("chat buttons: only Remy's own pages and the three kinds, at most two", () => {
  assert.deepEqual(chatActions([{ kind: "open", link: "https://evil.example", label: "x" }, { kind: "open", link: "javascript:alert(1)" }, { kind: "delete" }]), []);
  assert.deepEqual(chatActions([{ kind: "open", link: "/path?tab=career", label: "Explore" }]), [{ kind: "open", link: "/path?tab=career", label: "Explore" }]);
  assert.equal(chatActions([{ kind: "task", title: "a", why: "" }, { kind: "role", title: "Actuary" }, { kind: "task", title: "c" }]).length, 2);
  assert.deepEqual(chatActions("nope"), []);
});
