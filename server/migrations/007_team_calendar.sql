-- Team calendar: the team's shared Google account gets a "Remy team" calendar that mirrors the dashboard's
-- meetings, and each teammate answers going / maybe / can't go so the dashboard shows a headcount.
CREATE TABLE IF NOT EXISTS team_calendar (
  id            text PRIMARY KEY DEFAULT 'team',
  refresh       text NOT NULL,
  calendar_id   text NOT NULL,
  tz            text NOT NULL DEFAULT 'America/Chicago',
  connected_by  text NOT NULL DEFAULT '',
  connected_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS team_event_rsvps (
  event_id  text NOT NULL REFERENCES team_events(id) ON DELETE CASCADE,
  member    text NOT NULL,
  answer    text NOT NULL,
  at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, member)
);
