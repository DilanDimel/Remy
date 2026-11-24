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

test("the sweep drops team activity and usage counts older than 180 days, and keeps newer ones", async () => {
  const { pruneLogs } = await import("./storage");
  await q("INSERT INTO team_activity (actor, action, detail, at) VALUES ('a', 'old', '', now() - interval '200 days'), ('a', 'new', '', now())");
  await q("INSERT INTO usage_events (day, name, n) VALUES ('2020-01-01', 'page:/old', 1), (to_char(now(), 'YYYY-MM-DD'), 'page:/new', 1) ON CONFLICT DO NOTHING");
  await pruneLogs();
  assert.deepEqual((await q("SELECT action FROM team_activity WHERE action IN ('old', 'new')")).map((r) => r.action), ["new"]);
  assert.deepEqual((await q("SELECT name FROM usage_events WHERE name LIKE 'page:/%' AND name IN ('page:/old', 'page:/new')")).map((r) => r.name), ["page:/new"]);
});
