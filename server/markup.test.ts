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

test("markup: 'No number' is judged per role, on the one line most likely to have a count", () => {
  const e = (bullets: string[]) => ({ id: "e", org: "TCU", role: "Work Study", dates: "", location: "", bullets: bullets.map((text, i) => ({ id: `b${i}`, text })) });
  const doc = { contact: { name: "", email: "", phone: "", location: "", links: "" }, skills: [], sections: [{ id: "s", heading: "Experience", entries: [
    e(["Provide administrative and operational support to faculty and staff within the department", "Manage office communications, assist with data entry, and organize resources for students"]),
    e(["Selected for an intensive leadership and entrepreneurship development program", "Raised $5,000 for first-generation college students' dorm supplies"]),
  ] }] } as any;
  // Role without numbers: only its countable line ("Manage …") gets the flag.
  assert.ok(!issues(doc.sections[0].entries[0].bullets[0].text, doc).includes("No number"));
  assert.ok(issues(doc.sections[0].entries[0].bullets[1].text, doc).includes("No number"));
  // Role that already shows a number: no line is asked for one.
  assert.ok(!issues(doc.sections[0].entries[1].bullets[0].text, doc).includes("No number"));
  // Without the resume (the phone app today), every line is judged on its own as before.
  assert.ok(issues(doc.sections[0].entries[0].bullets[0].text).includes("No number"));
});
