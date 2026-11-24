// Restores Remy's database from the nightly backups in R2 (server/platform/backup.ts): the newest full copy on or
// before the day you name, then each daily copy after it, in one transaction.
//   Into a local PGlite folder (safe, to check a backup):  OR_DB_PATH=./restore-test npx tsx script/restore-backup.ts --day 2026-11-30
//   Into a real database (replaces its data):               DATABASE_URL=… npx tsx script/restore-backup.ts --day 2026-11-30 --yes
// Needs the same R2_* and WS_CACHE_KEY values as the server. Migrations run first, so the tables exist.
import { applyBackup, deleteAgain, restoreChain } from "../server/platform/backup";
import { r2Store } from "../server/platform/r2";
import { closeDb, dbReady, q, tx } from "../server/platform/sql";

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const day = arg("--day");
if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.error("Usage: npx tsx script/restore-backup.ts --day YYYY-MM-DD [--yes]");
  process.exit(1);
}
if (process.env.DATABASE_URL && !process.argv.includes("--yes")) {
  console.error("DATABASE_URL is set: this would replace that database's data. Add --yes if you mean it, or unset DATABASE_URL and set OR_DB_PATH to restore into a local copy.");
  process.exit(1);
}
const store = r2Store();
if (!store) {
  console.error("R2 isn't configured: set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and WS_CACHE_KEY.");
  process.exit(1);
}

await dbReady();
const chain = await restoreChain(store, day);
console.log(`Restoring ${chain.map((b) => `${b.kind} ${b.at.slice(0, 10)}`).join(" → ")}`);
// Accounts deleted in the target database since the backup: a full copy replaces this list, so read it first.
const deleted = (await q("SELECT id_hash FROM deleted_accounts")).map((r) => String(r.id_hash));
await tx(async (run) => { for (const b of chain) await applyBackup(run, b); });
console.log(`Deleted again (deleted after the backup was taken): ${await deleteAgain(deleted)} accounts`);
for (const t of ["users", "workspaces", "files"]) console.log(`${t}: ${(await q(`SELECT COUNT(*)::int AS n FROM ${t}`))[0].n} rows`);
await closeDb();
