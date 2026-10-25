-- Google Calendar connection: Remy's own "Remy" calendar in the student's Google account.
-- The refresh token is encrypted (server/gcal.ts). The row is removed only after the Google calendar is deleted.
CREATE TABLE IF NOT EXISTS google_calendar (
  user_id       text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  refresh       text NOT NULL,
  calendar_id   text NOT NULL,
  tz            text NOT NULL DEFAULT 'America/Chicago',
  connected_at  timestamptz NOT NULL DEFAULT now()
);
