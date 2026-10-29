-- A school email the student proved they own (6-digit code), e.g. name@tcu.edu. Unlocks alumni.
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_email_at timestamptz;
-- One school email per Remy account, so one student can't share alumni access.
CREATE UNIQUE INDEX IF NOT EXISTS users_school_email ON users (lower(school_email)) WHERE school_email IS NOT NULL;
-- The pending code (only its hash), one per student; a new code replaces the old one.
CREATE TABLE IF NOT EXISTS school_email_codes (
  user_id     text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  tries       integer NOT NULL DEFAULT 0
);
