import test from "node:test";
import assert from "node:assert/strict";
import { plainSkill } from "../shared/plainSkills";
import { starterCertsFor } from "../shared/roads";
import { exploreLanes } from "../shared/exploreLanes";

test("Remy explains common skills in plain words, and stays quiet on ones he doesn't know", () => {
  assert.match(plainSkill("SQL"), /database/);
  assert.match(plainSkill("Microsoft Power BI"), /dashboards/);
  assert.match(plainSkill("Excel financial models"), /predicts/); // the model line, not plain Excel
  assert.equal(plainSkill("Ventilator setup"), "");
});

test("certifications to earn now: everyone gets Excel and Google's; Bloomberg only for finance-like fields", () => {
  const fin = starterCertsFor({ key: "finance", label: "Finance" }).map((c) => c.name);
  const nurse = starterCertsFor({ key: "nursing", label: "Nursing" }).map((c) => c.name);
  assert.ok(fin.some((n) => /Bloomberg/.test(n)));
  assert.ok(!nurse.some((n) => /Bloomberg/.test(n)));
  assert.ok(nurse.some((n) => /Excel/.test(n)));
});

test("explore lanes: one per field the student picked, in their order, no duplicates, at most four", () => {
  const lanes = exploreLanes(["Finance", "Accounting", "Business Information Systems", "Entrepreneurship", "Finance", "Marketing"]);
  assert.deepEqual(lanes.map((l) => l.label), ["Finance", "Accounting", "Information systems", "Entrepreneurship"]);
  assert.ok(lanes.every((l) => l.try.length > 20));
  assert.deepEqual(exploreLanes(["Nursing"]), []);
});
