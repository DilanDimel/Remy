// The daily chest (owners): the same prize for the same day, rare finds never repeat, and XP only from XP prizes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHEST_XP, RARE, chestPrize, chestXp, rareOwned } from "../shared/chest";

const days = Array.from({ length: 200 }, (_, i) => new Date(Date.UTC(2026, 0, 1) + i * 864e5).toISOString().slice(0, 10));

test("chest: a day's prize is stable, some days are rare, most are XP", () => {
  assert.equal(chestPrize("2026-11-24", {}), chestPrize("2026-11-24", {}));
  const prizes = days.map((d) => chestPrize(d, {}));
  const rare = prizes.filter((p) => p !== "xp").length;
  assert.ok(rare > 10 && rare < 100, `about one in four days is rare (${rare} of 200)`);
  assert.ok(prizes.every((p) => p === "xp" || RARE.some(([k]) => k === p)));
});

test("chest: opening every day collects each rare item once, then only XP", () => {
  const g: { chests: Record<string, string> } = { chests: {} };
  for (const d of days) g.chests[d] = chestPrize(d, g);
  const found = Object.values(g.chests).filter((p) => p !== "xp");
  assert.equal(found.length, RARE.length);
  assert.equal(rareOwned(g).size, RARE.length);
  assert.equal(chestPrize("2027-06-01", g), "xp");
  assert.equal(chestXp(g), (days.length - RARE.length) * CHEST_XP);
});
