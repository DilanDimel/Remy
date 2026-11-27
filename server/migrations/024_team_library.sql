-- Remy's private team library (server/platform/library.ts): what the team knows beyond Slack and the public repo
-- (calendar, meeting summaries, project files, memory notes), pushed nightly by the lead AI. Team chat only, never
-- students. Files themselves live sealed in R2 under library/<id>. tier: 'team' (anyone on the team) or 'dilan'
-- (only in Dilan's own DMs with Remy).
CREATE TABLE IF NOT EXISTS team_library (
  id          text PRIMARY KEY,
  source      text NOT NULL,
  title       text NOT NULL DEFAULT '',
  body        text NOT NULL DEFAULT '',
  url         text NOT NULL DEFAULT '',
  tier        text NOT NULL DEFAULT 'dilan' CHECK (tier IN ('team', 'dilan')),
  pinned      boolean NOT NULL DEFAULT false,   -- always read (facts card, the next few meetings)
  starts_at   timestamptz,                      -- calendar items: Remy posts a reminder about an hour before
  channel     text,                             -- where that reminder goes (a Slack channel id)
  reminded_at timestamptz,
  file_name   text,
  hash        text NOT NULL DEFAULT '',         -- the sender's hash, so unchanged files aren't sent again
  updated_at  timestamptz NOT NULL DEFAULT now(),
  tsv         tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || body)) STORED
);
CREATE INDEX IF NOT EXISTS team_library_tsv ON team_library USING gin (tsv);
CREATE INDEX IF NOT EXISTS team_library_source ON team_library (source);
CREATE INDEX IF NOT EXISTS team_library_starts ON team_library (starts_at) WHERE starts_at IS NOT NULL;
