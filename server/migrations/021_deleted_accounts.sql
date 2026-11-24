-- Accounts deleted with "Delete everything", kept only as a one-way hash of the account id (nothing that identifies the
-- student), so restoring an older nightly backup deletes them again (server/platform/backup.ts `deleteAgain`).
-- Kept 70 days, longer than the oldest backup (8 weekly full copies), then removed by the cleanup.
CREATE TABLE IF NOT EXISTS deleted_accounts (
  id_hash    text PRIMARY KEY,
  deleted_at timestamptz NOT NULL DEFAULT now()
);
