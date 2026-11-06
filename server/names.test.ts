import { test } from "node:test";
import assert from "node:assert/strict";
import { NAME_CHECK, firstName, knownName, nameUnsure, sameName } from "../shared/names";

test("sameName ignores accents, middle initials, order and case; can't compare initials", () => {
  assert.equal(sameName("Jane Doe", "Jane M. Doe"), true);
  assert.equal(sameName("Jane Doe", "Doe, Jane"), true);
  assert.equal(sameName("José García", "Jose Garcia"), true);
  assert.equal(sameName("TEST STUDENT", "Test Student"), true);
  assert.equal(sameName("王伟", "李娜"), false);
  assert.equal(sameName("Dilan Desman", "Maria Lopez"), false);
  assert.equal(sameName("J. D.", "Jane Doe"), null);
});

test("an unanswered name check hides the name everywhere Remy shows or writes it (UTA tester, Nov 6)", () => {
  const task = (done: boolean) => ({ id: "t", title: "Which name should Remy use?", why: "", due: "", category: "Prepare" as const, done, source: NAME_CHECK });
  const ws = (over: { preferredName?: string; done?: boolean; resumeName?: string } = {}) => ({
    profile: { name: "Dilan Desman", preferredName: over.preferredName || "" } as any,
    resume: { doc: { contact: { name: over.resumeName ?? "Maria Lopez" } } } as any,
    tasks: [task(!!over.done)],
  });
  assert.equal(nameUnsure(ws()), true);
  assert.equal(knownName(ws()), "");
  assert.equal(firstName(ws()), "");
  // answered, a preferred name given, or the resume agrees: the name is used again
  assert.equal(firstName(ws({ done: true })), "Dilan");
  assert.equal(firstName(ws({ preferredName: "Mari" })), "Mari");
  assert.equal(knownName(ws({ resumeName: "Dilan M. Desman" })), "Dilan Desman");
});
