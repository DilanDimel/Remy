// Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@shared/types";
import { needsFullPosting, readFullPosting } from "./fullPosting";

const job = (patch: Partial<Job> = {}) => ({ id: "j1", kind: "internship", title: "Mechanical Intern", company: "Acme", location: "", format: "", dates: "", deadline: "", deadlineText: "", eligibility: [], requirements: [], summary: "", applyUrl: "https://example.com/job/1", sourceUrl: "", sourceName: "", label: "Live", checkedAt: "", checks: [], origin: "imported", postingText: "Short snippet.", ...patch } as Job);
const page = "<html><body>" + "<p>We are looking for a mechanical engineering intern with SolidWorks, MATLAB and GD&amp;T experience to design fixtures and run tolerance analysis for our test lab.</p>".repeat(12) + "</body></html>";

test("full posting: a snippet with no skills is read once, a full one is left alone", () => {
  assert.equal(needsFullPosting(job()), true);
  assert.equal(needsFullPosting(job({ fullTextAt: "2026-11-25" })), false, "already tried");
  assert.equal(needsFullPosting(job({ applyUrl: "" })), false, "no page to read");
  assert.equal(needsFullPosting(job({ postingText: "x".repeat(3000), requirements: [{ id: "r", keyword: "SolidWorks", quote: "SolidWorks" }] })), false);
});
test("full posting: the page's text and skills replace the snippet", async () => {
  const got = await readFullPosting(job(), async () => ({ status: 200, html: page, finalUrl: "" }));
  assert.ok(got && got.postingText!.length > 1000);
  assert.ok(got!.requirements.some((r) => /solidworks/i.test(r.keyword)));
});
test("full posting: an error, a login wall or a thin page changes nothing", async () => {
  assert.equal(await readFullPosting(job(), async () => ({ status: 404, html: page, finalUrl: "" })), null);
  assert.equal(await readFullPosting(job(), async () => ({ status: 200, html: "<p>Please sign in</p>", finalUrl: "" })), null);
  assert.equal(await readFullPosting(job(), async () => { throw new Error("timeout"); }), null);
});
