// Section 5 (Nov 19): Getting started checklist, Interview as its own page, tour settings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gettingStarted } from "@shared/progress";
import { chatActions } from "./safety";

const ws = (over: any = {}) => ({ savedJobIds: [], applications: [], resume: undefined, stories: [], contacts: [], ...over }) as any;

test("Getting started: each step is read from what the student did", () => {
  assert.deepEqual(gettingStarted(ws()).map((x) => x.done), [false, false, false, false, false]);
  const done = gettingStarted(ws({
    savedJobIds: ["j1"], resume: { confirmedAt: "2026-11-19" }, applications: [{ jobId: "j1", versions: [{}] }],
    stories: [{ situation: "a", task: "b", action: "c", result: "d" }], contacts: [{ id: "c1" }],
  }));
  assert.deepEqual(done.map((x) => x.done), [true, true, true, true, true]);
  // A story missing a part isn't a story yet; an application with no approved version isn't tailored yet.
  assert.equal(gettingStarted(ws({ stories: [{ situation: "a", task: "", action: "c", result: "d" }] }))[3].done, false);
  assert.equal(gettingStarted(ws({ applications: [{ jobId: "j1", versions: [] }] }))[2].done, false);
  assert.equal(gettingStarted(ws())[3].link, "/interview");
});

test("Remy's chat can point to the new Interview page and the LinkedIn tab", () => {
  assert.equal(chatActions([{ kind: "open", link: "/interview", label: "Practice" }])[0]?.kind, "open");
  assert.equal(chatActions([{ kind: "open", link: "/resume?tab=linkedin", label: "LinkedIn" }])[0]?.kind, "open");
});
