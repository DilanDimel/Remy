import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTerm, readTermAnswer } from "./term";

test("cleanTerm tidies and rejects a one-letter term", () => {
  assert.deepEqual(cleanTerm("  FE   exam ", " Civil engineering "), { term: "FE exam", field: "Civil engineering" });
  assert.equal(cleanTerm("x", "").term, "");
  assert.equal(cleanTerm(undefined, undefined).term, "");
});

test("readTermAnswer never passes on an empty answer as known", () => {
  assert.deepEqual(readTermAnswer({ known: true, what: "", why: "x" }), { known: false, what: "", why: "x" });
  assert.equal(readTermAnswer(null).known, false);
  assert.equal(readTermAnswer({ what: "An exam.", why: "Needed for a license." }).known, true);
});
