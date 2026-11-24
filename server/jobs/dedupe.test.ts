import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@shared/types";
import { dropDuplicatePostings, postingKey } from "./dedupe";

const job = (id: string, company: string, title = "Accounting Intern (Spring/Summer)", location = "Arlington, VA"): Job => ({
  id, kind: "internship", title, company, location, format: "", dates: "", deadline: "", deadlineText: "", eligibility: [], requirements: [],
  summary: "", applyUrl: "", sourceUrl: "", sourceName: "", label: "Live", checkedAt: "", checks: [], origin: "imported",
});

test("the same posting under two employer spellings is one opening", () => {
  assert.equal(postingKey(job("a", "Raytheon (RTX)")), postingKey(job("b", "RTX (Raytheon)")));
  const out = dropDuplicatePostings([job("a", "Raytheon (RTX)"), job("b", "RTX (Raytheon)")], () => false);
  assert.deepEqual(out.map((j) => j.id), ["a"]);
});

test("the copy the student kept stays, and different roles or cities both stay", () => {
  assert.deepEqual(dropDuplicatePostings([job("a", "Raytheon (RTX)"), job("b", "RTX (Raytheon)")], (id) => id === "b").map((j) => j.id), ["b"]);
  assert.equal(dropDuplicatePostings([job("a", "RTX"), job("b", "RTX", "Finance Intern")], () => false).length, 2);
  assert.equal(dropDuplicatePostings([job("a", "RTX"), job("b", "RTX", undefined, "Tucson, AZ")], () => false).length, 2);
});

test("one posting with its town written two ways is one opening, and two towns in one state stay apart", () => {
  const a = job("a", "Raytheon (RTX)", undefined, "springdale, Arkansas, United States of America");
  const b = job("b", "RTX (Raytheon)", undefined, "US-AR-SPRINGDALE-BLDG 1 ~ 275 E Robinson Ave");
  assert.deepEqual(dropDuplicatePostings([a, b], () => false).map((j) => j.id), ["a"]);
  const dallas = job("c", "RTX", undefined, "Dallas, Texas, United States"), austin = job("d", "RTX", undefined, "Austin, Texas, United States");
  assert.equal(dropDuplicatePostings([dallas, austin], () => false).length, 2);
});
