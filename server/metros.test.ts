// Austin and Houston employers, read first for students there (Nov 21, 2026). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPLOYERS, metrosIn, preferMetros } from "./sources";

test("metros: a student's places name their Texas metros; 'Anywhere in Texas' means all three", () => {
  assert.deepEqual(metrosIn("Dallas-Fort Worth"), ["dfw"]);
  assert.deepEqual(metrosIn("Austin"), ["austin"]);
  assert.deepEqual(metrosIn("Houston, Katy"), ["houston"]);
  assert.deepEqual(metrosIn("Austin, Houston"), ["austin", "houston"]);
  assert.deepEqual(metrosIn("Anywhere in Texas"), ["dfw", "austin", "houston"]);
  assert.deepEqual(metrosIn("New York, Remote"), []);
});
test("metros: the student's metro first, national next, other metros last; liked employers stay first", () => {
  const list = [{ company: "Plano ISD", metros: ["dfw" as const] }, { company: "Deloitte" }, { company: "Austin ISD", metros: ["austin" as const] }, { company: "Klein ISD", metros: ["houston" as const] }];
  assert.deepEqual(preferMetros(list, "Austin").map((e) => e.company), ["Austin ISD", "Deloitte", "Plano ISD", "Klein ISD"]);
  assert.deepEqual(preferMetros(list, "Austin", (e) => e.company === "Klein ISD").map((e) => e.company), ["Klein ISD", "Austin ISD", "Deloitte", "Plano ISD"]);
  assert.deepEqual(preferMetros(list, "Remote").map((e) => e.company), list.map((e) => e.company)); // no metro named: unchanged
});
test("employers: Austin and Houston school districts exist, every new (preview) employer says its metro, no board twice", () => {
  const edu = (m: string) => EMPLOYERS.filter((e) => e.fields?.includes("education") && e.metros?.includes(m as never));
  assert.ok(edu("austin").length >= 5);
  assert.ok(edu("houston").length >= 8);
  for (const e of EMPLOYERS.filter((x) => x.preview)) assert.ok(e.metros?.length, e.company);
  const keys = EMPLOYERS.map((e) => e.ats + ":" + e.slug);
  assert.equal(new Set(keys).size, keys.length);
});
test("metros: other states' towns, a season and a typo'd Fort Worth (skeptic's cases)", () => {
  for (const place of ["Arlington, VA", "Pasadena, CA", "Austin, MN", "Spring 2027 internship", "Cypress, CA", "Georgetown University, DC", "Kyle Field", "Austin, Minnesota"]) assert.deepEqual(metrosIn(place), [], place);
  assert.deepEqual(metrosIn("Ft. Worth"), ["dfw"]);
  assert.deepEqual(metrosIn("Anywhere in TX"), ["dfw", "austin", "houston"]);
  assert.deepEqual(metrosIn("Austin, TX"), ["austin"]);
  assert.deepEqual(metrosIn("Dallas, Fort Worth"), ["dfw"]);
});
test("metros: 'Not for me' employers stay last even in the student's city; 'Anywhere in Texas' keeps national employers in line", () => {
  const list = [{ company: "Deloitte" }, { company: "Fort Worth ISD", metros: ["dfw" as const] }, { company: "Plano ISD", metros: ["dfw" as const] }];
  assert.deepEqual(preferMetros(list, "Dallas-Fort Worth", () => false, (e) => e.company === "Fort Worth ISD").map((e) => e.company), ["Plano ISD", "Deloitte", "Fort Worth ISD"]);
  assert.deepEqual(preferMetros(list, "Anywhere in Texas").map((e) => e.company), list.map((e) => e.company));
});
