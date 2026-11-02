-- Remy's own email sign-in: a 6-digit code (only its hash), one pending per email address. Works on any device,
-- unlike a sign-in link, and isn't held to Supabase's shared hourly email limit.
CREATE TABLE IF NOT EXISTS signin_codes (
  email       text PRIMARY KEY,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  tries       integer NOT NULL DEFAULT 0
);
