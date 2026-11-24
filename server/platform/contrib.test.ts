// Hours and AI cost from PR descriptions, and matching a person to a teammate. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { prNumbers, memberFor } from "./contrib";

test("reads Hours and AI cost from a PR description; placeholders are 0", () => {
  assert.deepEqual(prNumbers("## Who\n- Hours: 2.5\n- AI cost: $0.80"), { hours: 2.5, cost: 0.8 });
  assert.deepEqual(prNumbers("- Hours: <your own hands-on time>\n- AI cost: <optional>"), { hours: 0, cost: 0 });
  assert.equal(prNumbers("Hours: 40").hours, 16);
  assert.deepEqual(prNumbers(""), { hours: 0, cost: 0 });
});

test("matches a person to exactly one teammate by first name", () => {
  const members = [{ email: "j@x.org", name: "Julio Renovato" }, { email: "d@x.org", name: "Dilan" }, { email: "a@x.org", name: "Ashton W" }, { email: "a2@x.org", name: "Ashton K" }];
  assert.equal(memberFor("Julio", members)?.email, "j@x.org");
  assert.equal(memberFor("dilan", members)?.email, "d@x.org");
  assert.equal(memberFor("Ashton", members), undefined); // two Ashtons: don't guess
  assert.equal(memberFor("Demetre", members), undefined);
});
