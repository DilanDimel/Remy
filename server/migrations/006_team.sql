-- Owners' dashboard v2: teammates added from the dashboard, to-dos assigned to a person,
-- who finished what, errors marked fixed, and a log of who did what.
CREATE TABLE IF NOT EXISTS team_members (
  email     text PRIMARY KEY,
  name      text NOT NULL DEFAULT '',
  added_by  text NOT NULL DEFAULT '',
  added_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS assignee text NOT NULL DEFAULT '';
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS done_by text NOT NULL DEFAULT '';
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS done_at timestamptz;
ALTER TABLE error_reports ADD COLUMN IF NOT EXISTS fixed_at timestamptz;
ALTER TABLE error_reports ADD COLUMN IF NOT EXISTS fixed_by text NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS team_activity (
  id      bigserial PRIMARY KEY,
  at      timestamptz NOT NULL DEFAULT now(),
  actor   text NOT NULL,
  action  text NOT NULL,
  detail  text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS team_activity_at ON team_activity(at);
-- Kanban columns: todo | doing | done (done stays in sync with status).
ALTER TABLE team_tasks ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo';
UPDATE team_tasks SET status = 'done' WHERE done AND status <> 'done';
