// The daily chest (owners): the same prize for the same day, rare finds never repeat, and XP only from XP prizes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHEST_XP, RARE, chestPrize, chestXp, rareOwned, welcomeBack } from "../shared/chest";

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

test("chest: a welcome back after a week or more away gives double XP, never a rare item", () => {
  const g = { days: { "2026-11-01": ["role"], "2026-11-02": ["role"] } };
  assert.equal(welcomeBack(g, "2026-11-03"), 0, "yesterday counts as there");
  assert.equal(welcomeBack(g, "2026-11-09"), 0, "six days away is not a week");
  assert.equal(welcomeBack({ days: { ...g.days, "2026-11-10": ["did"] } }, "2026-11-10"), 7, "today's own step doesn't hide the gap");
  assert.equal(welcomeBack({ days: {} }, "2026-11-10"), 0, "a first day isn't a comeback");
  const c = { chests: { "2026-11-10": chestPrize("2026-11-10", {}, true), "2026-11-11": "xp", "2026-11-12": "bonsai" } };
  assert.equal(c.chests["2026-11-10"], "bigxp");
  assert.equal(chestXp(c), 3 * CHEST_XP);
  assert.deepEqual([...rareOwned(c)], ["bonsai"]);
});
