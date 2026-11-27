// Database space report and the near-limit warning (PGlite in memory). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { storageReport, warnIfBackupStale, warnIfNearLimit } from "./storage";
import { backupStatus } from "./backup";
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

test("backups that aren't set up, never finished or are over 36 hours old get one warning a day", async () => {
  const keys = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "WS_CACHE_KEY"];
  const saved = keys.map((k) => process.env[k]);
  const settle = async () => { await q("DELETE FROM error_reports WHERE place = 'backup'"); };
  try {
    for (const k of keys) delete process.env[k];
    await q("DELETE FROM site_settings WHERE key = 'backup_last_at'");
    assert.equal((await backupStatus()).configured, false);
    assert.equal(await warnIfBackupStale(), true, "no R2 settings");
    assert.equal(await warnIfBackupStale(), true);
    assert.equal((await q("SELECT 1 FROM error_reports WHERE place = 'backup'")).length, 1, "one a day");
    await settle();

    for (const k of keys) process.env[k] = k === "WS_CACHE_KEY" ? Buffer.alloc(32, 7).toString("base64") : "x";
    assert.equal((await backupStatus()).configured, true);
    assert.equal(await warnIfBackupStale(), true, "set up but no backup has finished");
    await settle();

    const ago = (h: number) => `now() - interval '${h} hours'`;
    await q(`INSERT INTO site_settings (key, value, updated_by) VALUES ('backup_last_at', (${ago(5)})::text, 'test')
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
    assert.equal(await warnIfBackupStale(), false, "5 hours old is fine");
    const st = await backupStatus();
    assert.match(String(st.lastAt), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, "an ISO time every browser reads");
    await q(`UPDATE site_settings SET value = (${ago(40)})::text WHERE key = 'backup_last_at'`);
    assert.equal(await warnIfBackupStale(), true, "40 hours old");
    assert.equal((await q("SELECT 1 FROM error_reports WHERE place = 'backup' AND message LIKE '%hours ago%'")).length, 1);
  } finally {
    keys.forEach((k, i) => { if (saved[i] === undefined) delete process.env[k]; else process.env[k] = saved[i]; });
    await settle();
    await q("DELETE FROM site_settings WHERE key = 'backup_last_at'");
  }
});
