-- Rate limits (sign-in codes, guest accounts, AI per network, link fetching…) kept in the database, so a restart or
-- deploy doesn't reset them and several servers share one count. One row per key per fixed window.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  hits         integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS rate_limits_expires ON rate_limits (expires_at);
