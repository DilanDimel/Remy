-- Teammates on a meeting (comma-separated emails), like a to-do's assignees.
ALTER TABLE team_events ADD COLUMN IF NOT EXISTS assignees text NOT NULL DEFAULT '';
