// Automatic signals: counted per day, junk dropped, ratings grouped per feature. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { countEvents, signalsReport } from "./signals";

test("signals: only known shapes are counted; ratings group per feature", async () => {
  const n = await countEvents(["page:/opportunities", "page:/opportunities", "page:/resume", "rage:/resume:button-tailor", "rate:tailor:up", "rate:tailor:down", "rate:tailor:up", "rate:coach:down",
    "drop table users", "<script>", 42, "page:" + "x".repeat(200)]);
  assert.equal(n, 8);
  assert.equal(await countEvents("not a list"), 0);
  const r = await signalsReport(7);
  assert.deepEqual(r.pages[0], { name: "/opportunities", n: 2 });
  assert.deepEqual(r.rage, [{ name: "/resume:button-tailor", n: 1 }]);
  assert.deepEqual(r.ratings.find((x) => x.place === "tailor"), { place: "tailor", up: 2, down: 1 });
  assert.deepEqual(r.ratings.find((x) => x.place === "coach"), { place: "coach", up: 0, down: 1 });
});
