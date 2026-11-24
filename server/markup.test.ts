import { test } from "node:test";
import assert from "node:assert/strict";
import { issues, ranges, toolsRegex } from "../shared/markup";

test("markup: colours what's in the line and flags what's missing", () => {
  const doc = { contact: { name: "", email: "", phone: "", location: "", links: "" }, sections: [], skills: [{ id: "k", label: "Tools", items: "Excel, Tableau" }] } as any;
  const text = "Built 3 Tableau dashboards that cut reporting time by 40%";
  const cats = ranges(text, toolsRegex(doc)).map(([s, e, c]) => [text.slice(s, e), c]);
  assert.deepEqual(cats.find(([, c]) => c === "action"), ["Built", "action"]);
  assert.ok(cats.some(([t, c]) => t === "Tableau" && c === "hard"));
  assert.ok(cats.some(([, c]) => c === "result"));
  assert.deepEqual(issues("Helped customers"), ["Starts weak", "No number", "Too short"]);
  assert.deepEqual(issues(text), []);
});
