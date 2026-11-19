// "What's new": ids are "date-NN", unique and only ever growing, so "seen up to this id" counts unseen notes right.
import { test } from "node:test";
import assert from "node:assert/strict";
import { NEWS } from "../shared/news";

test("What's new: every id is unique and well formed", () => {
  const ids = NEWS.map((n) => n.id);
  assert.deepEqual(ids.filter((id, i) => ids.indexOf(id) !== i), [], "duplicate ids");
  for (const n of NEWS) assert.match(n.id, /^\d{4}-\d{2}-\d{2}-\d{2}$/, n.id);
});
