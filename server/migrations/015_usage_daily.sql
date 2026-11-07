-- Remy's own estimate of database data transfer (what Supabase bills as egress), per Central-time day.
-- Filled every 5 minutes from the bytes the server's database connections received. Counts only.
CREATE TABLE IF NOT EXISTS usage_daily (
  day       text PRIMARY KEY,
  db_bytes  bigint NOT NULL DEFAULT 0
);
