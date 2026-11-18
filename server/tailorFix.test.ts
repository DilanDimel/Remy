// Section 3 of the Nov 17 audit: Remy offered "Managed the register… with attention to detail" for "Ran the register",
// its own check flagged it, and Approve refused after the student accepted. Now flagged rewrites get one repair try;
// only a repair that passes is offered.
import { test } from "node:test";
import assert from "node:assert/strict";
import { betterLetter, keptFixes, letterFixPrompt, rewriteFixPrompt } from "./tailorFix";
import { claimCheck } from "./claims";

const ev = "Academy Sports + Outdoors\nSales Associate\nRan the register and handled cash and card payments\nHelped customers find the right products";
const original = "Ran the register and handled cash and card payments";
const item = { id: "ch1", original, revised: "Managed the register and processed cash and card payment transactions with attention to detail", flags: claimCheck("Managed the register and processed cash and card payment transactions with attention to detail", ev, { original }) };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clean = (t: string, it: typeof item) => !claimCheck(t, ev, { original: it.original }).length;
const reasonOk = (t: string) => !claimCheck(t, ev, { allowedNames: ["Frost Bank"] }).length;

test("tailor fix: the rejected rewrite really is flagged, and the prompt names the flagged words", () => {
  assert.ok(item.flags.length > 0);
  const p = rewriteFixPrompt([item]);
  assert.match(p.user, /Managed/);
  assert.match(p.user, /ch1/);
  assert.match(letterFixPrompt("Dear team, I managed the register.", [{ type: "title", term: "managing", message: "x" }]).user, /managing/);
});

test("tailor fix: only a repair that passes the check and changes something is kept", () => {
  const ok = keptFixes([item], { fixes: [{ id: "ch1", revised: "Ran the register and processed cash and card payments", reason: "Shows the cash and card payments the bank's role handles." }] }, clean, norm, reasonOk);
  assert.equal(ok.get("ch1")?.revised, "Ran the register and processed cash and card payments");
  assert.match(ok.get("ch1")!.reason, /payments/);
  // The new reason is checked too: one that brings back the removed claim is dropped, never the old one reused.
  const bad = keptFixes([item], { fixes: [{ id: "ch1", revised: "Ran the register and processed cash and card payments", reason: "Shows you managed the register." }] }, clean, norm, reasonOk);
  assert.equal(bad.get("ch1")?.reason, "");
  // Still overstated: dropped (the student keeps their own line).
  assert.equal(keptFixes([item], { fixes: [{ id: "ch1", revised: "Managed the register and all payments" }] }, clean, norm).size, 0);
  // Same as the original: nothing to offer.
  assert.equal(keptFixes([item], { fixes: [{ id: "ch1", revised: "Ran the register and handled cash and card payments." }] }, clean, norm).size, 0);
  // Unknown id, empty, or AI down.
  assert.equal(keptFixes([item], { fixes: [{ id: "zz", revised: "Ran the register" }, { id: "ch1", revised: "" }] }, clean, norm).size, 0);
  assert.equal(keptFixes([item], null, clean, norm).size, 0);
});

test("tailor fix: a repaired letter replaces the first only if it kept greeting and sign-off and has fewer problems", () => {
  const before = "Dear Frost Bank Recruiting Team,\nI managed the register at a fast-paced store.\nBest,\nChris";
  const after = "Dear Frost Bank Recruiting Team,\nI ran the register at a busy store and handled payments.\nBest,\nChris";
  const problems = (t: string) => (/managed|fast-paced/.test(t) ? 2 : 0);
  assert.equal(betterLetter(before, after, 2, problems), true);
  assert.equal(betterLetter(before, after.replace("Dear Frost Bank Recruiting Team,\n", ""), 2, problems), false); // greeting dropped
  assert.equal(betterLetter(before, after.replace("\nBest,\nChris", ""), 2, problems), false); // sign-off dropped
  assert.equal(betterLetter(before, before.replace("fast-paced ", ""), 2, () => 2), false); // no fewer problems
  assert.equal(betterLetter(before, after + "\n" + "x".repeat(200), 2, problems), false); // far longer
});
