// Rate limits kept in the database (PGlite in memory). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { allow, allowLocal, cleanupLimits } from "./limits";
import { q } from "./sql";

const HOUR = 60 * 60_000;

test("allows up to max hits in a window, then refuses until the next window", async () => {
  const t0 = Date.UTC(2026, 10, 24, 10, 0, 0);
  for (let i = 0; i < 3; i++) assert.equal(await allow("t:a", 3, HOUR, t0 + i), true);
  assert.equal(await allow("t:a", 3, HOUR, t0 + 10), false);
  assert.equal(await allow("t:a", 3, HOUR, t0 + 20), false);
  assert.equal(await allow("t:a", 3, HOUR, t0 + HOUR), true, "a new window starts the count over");
});

test("keys are counted separately", async () => {
  const t0 = Date.UTC(2026, 10, 24, 12, 0, 0);
  assert.equal(await allow("t:b", 1, HOUR, t0), true);
  assert.equal(await allow("t:b", 1, HOUR, t0), false);
  assert.equal(await allow("t:c", 1, HOUR, t0), true);
});

test("the count lives in the database, so it survives a restart", async () => {
  const now = Date.now();
  assert.equal(await allow("t:d", 1, HOUR, now), true);
  const row = (await q("SELECT hits FROM rate_limits WHERE key = 't:d'"))[0];
  assert.equal(Number(row.hits), 1);
  assert.equal(await allow("t:d", 1, HOUR, now), false);
  assert.equal(Number((await q("SELECT hits FROM rate_limits WHERE key = 't:d'"))[0].hits), 2, "never counts past max + 1");
});

test("the sweep removes windows that have ended", async () => {
  await allow("t:old", 5, 1000, Date.UTC(2020, 0, 1));
  await cleanupLimits();
  assert.equal((await q("SELECT 1 FROM rate_limits WHERE key = 't:old'")).length, 0);
  assert.equal((await q("SELECT 1 FROM rate_limits WHERE key = 't:d'")).length, 1);
});

test("the in-memory limiter is a sliding window", () => {
  assert.equal(allowLocal("m:a", 2, 1000, 0), true);
  assert.equal(allowLocal("m:a", 2, 1000, 500), true);
  assert.equal(allowLocal("m:a", 2, 1000, 900), false);
  assert.equal(allowLocal("m:a", 2, 1000, 1001), true);
});
