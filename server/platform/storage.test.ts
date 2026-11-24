// Database space report and the near-limit warning (PGlite in memory). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { storageReport, warnIfNearLimit } from "./storage";
import { q } from "./sql";

test("the report lists Remy's tables with sizes, and the whole database against the limit", async () => {
  const r = await storageReport();
  assert.ok(r.usedMb > 0);
  assert.equal(r.limitMb, 500);
  for (const t of ["workspaces", "board_cache", "checked_openings", "files"]) assert.ok(r.tables.some((x) => x.name === t), t);
});

test("past 80% of the limit, one warning a day goes to the owners' Errors page", async () => {
  process.env.DB_SIZE_LIMIT_MB = "1";
  try {
    assert.equal(await warnIfNearLimit(), true);
    assert.equal(await warnIfNearLimit(), true);
    assert.equal((await q("SELECT 1 FROM error_reports WHERE place = 'storage'")).length, 1);
  } finally { delete process.env.DB_SIZE_LIMIT_MB; }
  assert.equal(await warnIfNearLimit(), false);
});

test("the traffic report lists connections and says when query stats can't be read", async () => {
  const { trafficReport } = await import("./storage");
  const r = await trafficReport();
  assert.ok(Array.isArray(r.connections));
  if (!r.statements) assert.match(r.note, /pg_stat_statements/);
});
