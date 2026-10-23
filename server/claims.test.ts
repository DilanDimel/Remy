// Run with `npm test`. Cases come from the Oct 2026 stress test and the real AI
// mistakes in docs/evidence/ai-error-log.md; every made-up claim here must stay flagged
// and every true statement must stay clean.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { claimCheck } from "./claims";

const evidence = fs.readFileSync(path.join(import.meta.dirname, "sample-resume.txt"), "utf8") + "\nClass year: Sophomore";
const workStudy = "Provide administrative and operational support to faculty and staff within the College of Education department";
const budget = "Oversee an estimated annual chapter budget of $5,000+, managing SGA funding allocations and corporate sponsorship";
const flagged = (text: string, opts = {}) => claimCheck(text, evidence, opts).length > 0;

const madeUp: [string, string, object?][] = [
  ["invented number", "Supported 40 faculty members in the College of Education", { original: workStudy }],
  ["invented tools", "Automated office reporting using Python and SQL"],
  ["invented title", "Served as Office Manager for the College of Education"],
  ["invented employer", "Interned at Goldman Sachs over the summer"],
  ["invented outcome", "Provided administrative support, improving response times for students", { original: workStudy }],
  ["workload word (pitch AI error)", "my work-study position supporting a fast-paced office"],
  ["leadership inflation", "Led the department's operations and supervised staff", { original: workStudy }],
  ["percent written as a word", "Cut processing time by thirty percent"],
  ["number written as a word", "Managed a team of five students"],
  ["number in digits", "Managed 10 people"],
  ["fake award", "Recipient of the Dean's Excellence Award"],
  ["fake certification", "Earned a bloomberg market concepts certificate"],
  ["degree inflation", "Completed a master's-level valuation course"],
  ["dropped hedge (seen on a real resume)", "Oversee chapter budget of $5,000+, managing SGA funding allocations and corporate sponsorships", { original: budget }],
  ["letter drops 'estimated' (seen on a real letter)", "As Treasurer, I manage an annual chapter budget exceeding $5,000."],
  ["dropped co-", "Founded and led the investment club", { original: "Co-founded the investment club" }],
];
for (const [name, text, opts] of madeUp) test(`flags: ${name}`, () => assert.ok(flagged(text, opts), text));

const truthful: [string, string, object?][] = [
  ["faithful reword", "Provided administrative and operational support to faculty and staff in the College of Education", { original: workStudy }],
  ["fact from the resume", "Recipient of the TCU Founders Scholarship"],
  ["year from the resume", "Expected graduation May 2029"],
  ["hedge kept", "Oversee an estimated annual chapter budget of $5,000+ and manage SGA funding allocations", { original: budget }],
  ["'led' kept from the original (accepted in the Evercore pair)", "Founded UNO Club from concept to active organization and led effort for official TCU recognition; organized an inaugural tournament with 24 participants across a 6-pool bracket and oversee an 8-member executive board", { original: "Founded club from concept to active organization and led effort for official TCU recognition; organized inaugural tournament with 24 participants across a 6-pool bracket; oversee an 8-member executive board", entryContext: "UNO Club Founder & President" }],
  ["'graduate' as a verb in a letter", "As I graduate in 2029, I hope to build on my finance coursework."],
  ["posting figure in a letter", "I am excited about the 10-week program.", { postingText: "This 10-week program runs each summer.", postingNumbersOk: true }],
];
for (const [name, text, opts] of truthful) test(`clean: ${name}`, () => assert.deepEqual(claimCheck(text, evidence, opts || {}), [], text));
