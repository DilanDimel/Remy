import { test } from "node:test";
import assert from "node:assert/strict";
import { FIELD_GROUPS, FIELD_MAJORS, splitFieldList } from "../shared/fields";

const opens = (major: string) => FIELD_GROUPS.filter(([, opts]) => opts.some((o) => FIELD_MAJORS[o]?.test(major))).map(([g]) => g);

test("every field choice knows which majors point to it", () => {
  for (const o of FIELD_GROUPS.flatMap(([, opts]) => opts)) assert.ok(FIELD_MAJORS[o], o);
});

test("setup opens the field group that matches the student's major", () => {
  assert.deepEqual(opens("Finance & BIS with Fintech Certificate"), ["Business", "Tech & engineering"]);
  assert.deepEqual(opens("Political Science"), ["People & public service"]);
  assert.deepEqual(opens("Computer Science"), ["Tech & engineering"]);
  assert.deepEqual(opens("Strategic Communication"), ["Creative & media"]);
  assert.deepEqual(opens("Nursing"), ["Health & science"]);
  assert.deepEqual(opens("Undeclared"), []);
});

test("a saved field list with \"Film, theater & music\" comes back whole", () => {
  assert.deepEqual(splitFieldList("Finance, Film, theater & music, Marketing").sort(), ["Film, theater & music", "Finance", "Marketing"]);
  assert.deepEqual(splitFieldList(""), []);
});
