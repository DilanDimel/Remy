import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultTypes, fieldFromMajor, guessYearFor, yearOptions } from "@shared/setupDefaults";

test("setup starts from what the student said", () => {
  const now = new Date("2026-11-26T12:00:00");
  assert.deepEqual(yearOptions("community-college"), ["First-year", "Sophomore"]);
  assert.deepEqual(yearOptions("working"), []);
  assert.equal(guessYearFor("community-college", "May 2027", now), "Sophomore");
  assert.equal(guessYearFor("four-year", "May 2028", now), "Junior");
  assert.equal(guessYearFor("trade", "May 2027", now), "");
  assert.deepEqual(defaultTypes("Get a nursing job at a hospital after I graduate", "community-college"), ["Full-time jobs"]);
  assert.deepEqual(defaultTypes("Land an internship", "four-year"), ["Internships"]);
  assert.deepEqual(defaultTypes("Not sure yet", "military"), ["Full-time jobs"]);
  assert.deepEqual(fieldFromMajor("Nursing (ADN)"), ["Nursing"]);
  assert.deepEqual(fieldFromMajor(""), []);
  assert.deepEqual(yearOptions("high-school"), ["9th grade", "10th grade", "11th grade", "12th grade"]);
  assert.equal(guessYearFor("high-school", "May 2027", now), "12th grade");
  assert.deepEqual(defaultTypes("Find a summer program or part-time job before college", "high-school"), ["Part-time / campus jobs", "Programs & insight days"]);
  assert.deepEqual(defaultTypes("Something part-time while I study", "four-year"), ["Part-time / campus jobs"]);
});
