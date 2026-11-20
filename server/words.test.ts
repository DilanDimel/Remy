// Word families (shared/words.ts), Nov 20: each word's family is remembered so scoring 150+ openings against a long
// resume doesn't freeze the server; words that are also names on every JS object ("constructor") used to crash it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { family, families } from "@shared/words";

test("words: 'constructor', 'toString' and friends are plain words, not a crash", () => {
  const f = families("Constructor of homes; toString valueOf hasOwnProperty __proto__");
  assert.ok(f.has("constructor") && f.has("tostr") && f.has("valueof"));
});

test("words: a remembered answer is the same as the first one", () => {
  for (const w of ["Manager", "management", "analyzed", "accounting", "planned", "studies", "led", "x".repeat(60)]) {
    const first = family(w);
    assert.equal(family(w), first, w);
  }
  assert.equal(family("Manager"), "manag");
  assert.equal(family("accounting"), "accountancy");
});
