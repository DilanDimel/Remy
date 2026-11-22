import { test } from "node:test";
import assert from "node:assert/strict";
import { keepDecided } from "./keepDecided";

const ch = (id: string, bulletId: string, status: any = "pending", revised = id) => ({ id, bulletId, entryLabel: "", original: "o", revised, requirementId: "r", requirementQuote: "", reason: "", evidence: "", status, flags: [] });

test("redoing a draft keeps the student's decisions and replaces only undecided suggestions", () => {
  const before = [ch("a", "b1", "accepted"), ch("b", "b2", "rejected"), ch("c", "b3"), { ...ch("d", "b4"), edited: "mine" }];
  const after = [ch("n1", "b1"), ch("n3", "b3"), ch("n5", "b5")];
  assert.deepEqual(keepDecided(before as any, after as any).map((c) => c.id), ["a", "n3", "n5", "b", "d"]);
  assert.deepEqual(keepDecided(undefined, after as any).map((c) => c.id), ["n1", "n3", "n5"]);
});
