-- Remy's tables. Standard PostgreSQL only (no provider-specific features), so the
-- database can move to any Postgres host by changing DATABASE_URL and copying the data.
CREATE TABLE IF NOT EXISTS users (
  id          text PRIMARY KEY,
  kind        text NOT NULL,                 -- google | supabase | guest
  email       text NOT NULL DEFAULT '',
  name        text NOT NULL DEFAULT '',
  picture     text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  text PRIMARY KEY,                -- sha256 of the cookie token, never the token itself
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
-- One document per student: profile, resume, jobs, applications, tracker, chat… (see shared/types.ts Workspace).
CREATE TABLE IF NOT EXISTS workspaces (
  user_id     text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id     text NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_user_at ON ai_usage(user_id, at);
CREATE INDEX IF NOT EXISTS ai_usage_at ON ai_usage(at);
-- Original uploaded files (the base resume), one per kind per student.
CREATE TABLE IF NOT EXISTS files (
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  name        text NOT NULL,
  mime        text NOT NULL,
  data        bytea NOT NULL,
  at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);
