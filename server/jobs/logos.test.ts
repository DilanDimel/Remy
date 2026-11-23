import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPLOYERS } from "./sources";
import { logoDomain, logoFor } from "@shared/logos";

test("every employer Remy reads has a logo domain, except the five with no icon", () => {
  const none = ["Arrowstreet Capital", "Atmos Energy", "Hunt Consolidated", "Richardson ISD", "Lake Travis ISD"];
  const missing = EMPLOYERS.filter((e) => !logoDomain(e.company)).map((e) => e.company);
  assert.deepEqual(missing.sort(), none.sort());
  assert.equal(logoFor("Deloitte LLP").sure, true);
});

test("unknown companies use the posting's own site, never a job board's", () => {
  assert.equal(logoDomain("Acme Widgets", "https://careers.acme.co.uk/job/1"), "acme.co.uk");
  assert.equal(logoDomain("Acme Widgets", "https://jobs.acmewidgets.com/x"), "acmewidgets.com");
  for (const u of ["https://boards.greenhouse.io/acme/1", "https://acme.wd5.myworkdayjobs.com/x", "https://www.linkedin.com/jobs/1", "https://www.usajobs.gov/job/1", "not a url"]) assert.equal(logoDomain("Acme Widgets", u), "");
  assert.equal(logoFor("Acme Widgets", "https://acme.com/j").sure, false);
});
