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

test("chat buttons: only Remy's own pages and the three kinds, at most three (students still see two)", () => {
  assert.deepEqual(chatActions([{ kind: "open", link: "https://evil.example", label: "x" }, { kind: "open", link: "javascript:alert(1)" }, { kind: "delete" }]), []);
  assert.deepEqual(chatActions([{ kind: "open", link: "/path?tab=career", label: "Explore" }]), [{ kind: "open", link: "/path?tab=career", label: "Explore" }]);
  assert.equal(chatActions([{ kind: "task", title: "a", why: "" }, { kind: "role", title: "Actuary" }, { kind: "task", title: "c" }, { kind: "task", title: "d" }]).length, 3);
  assert.deepEqual(chatActions("nope"), []);
});

test("chat may offer only known settings with valid values", async () => {
  const { chatActions } = await import("./safety");
  assert.deepEqual(chatActions([{ kind: "setting", key: "theme", value: "dark" }]), [{ kind: "setting", key: "theme", value: "dark" }]);
  assert.deepEqual(chatActions([{ kind: "setting", key: "notify.weeklyPlan", value: false }]), [{ kind: "setting", key: "notify.weeklyPlan", value: false }]);
  assert.deepEqual(chatActions([{ kind: "setting", key: "theme", value: "neon" }, { kind: "setting", key: "deleteAccount", value: true }, { kind: "setting", key: "notify.weeklyPlan", value: "off" }]), []);
});

test("chat: the feature map is in the rules, and links to Resume tabs are allowed buttons", async () => {
  const { CHAT_RULES, chatActions } = await import("./safety");
  assert.match(CHAT_RULES, /Tailor for an opening/);
  assert.match(CHAT_RULES, /can't apply or send messages/);
  for (const link of ["/resume?tab=tailor", "/resume?tab=linkedin", "/progress?tab=tracker", "/accounts?tab=profile"])
    assert.equal(chatActions([{ kind: "open", link, label: "Go" }]).length, 1, link);
  assert.equal(chatActions([{ kind: "open", link: "https://evil.example", label: "x" }]).length, 0);
});
