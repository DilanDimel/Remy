-- Owners' dashboard: errors students hit, and the team's own to-dos, meetings and hours.
CREATE TABLE IF NOT EXISTS error_reports (
  id       bigserial PRIMARY KEY,
  at       timestamptz NOT NULL DEFAULT now(),
  kind     text NOT NULL,                 -- browser | server
  place    text NOT NULL DEFAULT '',      -- page or API route
  message  text NOT NULL,
  detail   text NOT NULL DEFAULT '',
  user_id  text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS error_reports_at ON error_reports(at);
CREATE TABLE IF NOT EXISTS team_tasks (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  owner       text NOT NULL DEFAULT '',
  due         text NOT NULL DEFAULT '',
  notes       text NOT NULL DEFAULT '',
  done        boolean NOT NULL DEFAULT false,
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS team_events (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  date        text NOT NULL,
  time        text NOT NULL DEFAULT '',
  who         text NOT NULL DEFAULT '',
  notes       text NOT NULL DEFAULT '',
  created_by  text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS time_entries (
  id        text PRIMARY KEY,
  member    text NOT NULL,                -- the owner's email
  start_at  timestamptz NOT NULL DEFAULT now(),
  end_at    timestamptz,
  note      text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS time_entries_member ON time_entries(member, start_at);
-- First to-dos, from the professor meeting on 2026-10-28.
INSERT INTO team_tasks (id, title, owner, notes, created_by) VALUES
  ('tt-seed-security', 'Contact TCU''s head of information security about privacy and security protocols', '', 'Tip from the entrepreneurship & innovation professor. Bring the Architecture page and the privacy policy.', 'setup'),
  ('tt-seed-career', 'Contact the head of the TCU Career Center about an alumni partnership', '', 'Tip from the entrepreneurship & innovation professor. Ask about sharing alumni contacts with consent.', 'setup')
ON CONFLICT (id) DO NOTHING;
