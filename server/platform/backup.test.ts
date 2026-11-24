// Nightly backups and restoring from them (PGlite in memory, an in-memory store instead of R2). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBackup, backupIfDue, backupStatus, deleteAgain, restoreChain, type Store } from "./backup";
import { deleteAccount, ensureUser, getFile, idHash, loadWorkspace, saveFile, saveWorkspace } from "./db";
import { q, tx } from "./sql";

const box = new Map<string, unknown>();
const store: Store = {
  put: async (n, v) => { box.set(n, JSON.parse(JSON.stringify(v))); },
  get: async (n) => (box.has(n) ? structuredClone(box.get(n)) : null),
  del: async (n) => { box.delete(n); },
};
const me = (id: string) => ({ id, kind: "supabase", email: `${id}@x.edu`, name: id, picture: "" }) as any;
const at = (s: string) => new Date(s);

test("first night takes a full copy, later nights only what changed, at most once a day", async () => {
  await ensureUser(me("b1"));
  await ensureUser(me("b2"));
  const w1 = await loadWorkspace("b1"); w1.profile.major = "Finance"; await saveWorkspace("b1", w1);
  const w2 = await loadWorkspace("b2"); w2.profile.major = "Biology"; await saveWorkspace("b2", w2);
  await saveFile("b1", "resume", "r.pdf", "application/pdf", Buffer.from([1, 2, 3, 0, 255]));
  await q("INSERT INTO board_cache (key, raws) VALUES ('greenhouse|bk||', '[]') ON CONFLICT DO NOTHING");

  const first = await backupIfDue(store, at("2026-11-25T08:00:00Z"));
  assert.equal(first?.kind, "full");
  const full = box.get("backup/full/2026-11-25") as any;
  assert.ok(full.tables.workspaces.some((r: any) => r.user_id === "b2"));
  assert.equal(full.tables.board_cache, undefined, "rebuildable caches are left out");
  assert.equal(full.tables.sessions, undefined, "sessions are left out");
  assert.equal(await backupIfDue(store, at("2026-11-25T20:00:00Z")), null, "once a day");

  const w = await loadWorkspace("b1"); w.profile.major = "Accounting"; await saveWorkspace("b1", w);
  const second = await backupIfDue(store, at("2026-11-26T08:00:00Z"));
  assert.equal(second?.kind, "daily");
  const daily = box.get("backup/daily/2026-11-26") as any;
  assert.deepEqual(daily.tables.workspaces.map((r: any) => r.user_id), ["b1"], "only the changed account");
  assert.equal(daily.tables.files.length, 0);
  assert.ok(daily.tables.users.length >= 2, "small tables go whole");
  assert.equal((await backupStatus()).lastFull, "2026-11-25");
});

test("a week after the last full copy, the next one is full again", async () => {
  assert.equal((await backupIfDue(store, at("2026-12-02T08:00:00Z")))?.kind, "full");
});

test("restoring the chain brings back accounts and files after they're lost", async () => {
  const chain = await restoreChain(store, "2026-12-01");
  assert.deepEqual(chain.map((b) => b.kind), ["full", "daily"]);
  await q("DELETE FROM users WHERE id IN ('b1', 'b2')");
  assert.equal((await q("SELECT 1 FROM workspaces WHERE user_id = 'b1'")).length, 0);
  await tx(async (run) => { for (const b of chain) await applyBackup(run, b); });
  const row = (await q("SELECT data->'profile'->>'major' AS m FROM workspaces WHERE user_id = 'b1'"))[0];
  assert.equal(row.m, "Accounting", "the daily copy's newer account wins");
  assert.equal((await q("SELECT data->'profile'->>'major' AS m FROM workspaces WHERE user_id = 'b2'"))[0].m, "Biology");
  assert.deepEqual([...(await getFile("b1", "resume"))!.data], [1, 2, 3, 0, 255]);
});

test("an account deleted after the backup stays deleted when that backup is restored", async () => {
  const chain = await restoreChain(store, "2026-12-01");
  await deleteAccount("b2");
  const tombstone = (await q("SELECT id_hash FROM deleted_accounts")).map((r) => String(r.id_hash));
  assert.ok(tombstone.includes(idHash("b2")) && !tombstone.includes("b2"), "only a hash of the id is kept");
  await tx(async (run) => { for (const b of chain) await applyBackup(run, b); });
  assert.equal((await q("SELECT 1 FROM users WHERE id = 'b2'")).length, 1, "the old copy brought it back");
  assert.equal(await deleteAgain(tombstone), 1);
  assert.equal((await q("SELECT 1 FROM users WHERE id = 'b2'")).length, 0);
  assert.equal((await q("SELECT 1 FROM workspaces WHERE user_id = 'b2'")).length, 0);
  assert.equal((await q("SELECT 1 FROM users WHERE id = 'b1'")).length, 1, "other accounts are untouched");
});

test("not configured: nothing happens", async () => {
  assert.equal(await backupIfDue(null), null);
});

test("after nights with no sweep, every copy past its keep time is deleted, not only the one exactly that old", async () => {
  box.set("backup/daily/2026-11-10", {}); box.set("backup/daily/2026-11-20", {}); box.set("backup/daily/2026-12-20", {});
  box.set("backup/full/2026-10-20", {});
  await backupIfDue(store, at("2027-01-05T08:00:00Z")); // a month with no backups
  assert.equal(box.has("backup/daily/2026-11-10"), false);
  assert.equal(box.has("backup/daily/2026-11-20"), false);
  assert.equal(box.has("backup/daily/2026-11-26"), false, "the earlier test's daily copy is past 31 days too");
  assert.equal(box.has("backup/daily/2026-12-20"), true, "newer copies stay");
  assert.equal(box.has("backup/full/2026-10-20"), false);
  assert.equal(box.has("backup/full/2026-12-02"), true, "full copies are kept 8 weeks");
});
