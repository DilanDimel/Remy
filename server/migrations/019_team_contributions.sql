-- Hours and AI cost from merged pull requests (the "Hours:" and "AI cost:" lines in the PR template), next to clocked time.
-- source: 'clock' or 'pr'. ref: 'pr:123', so a PR counts once. ai_cost: dollars the AI tools cost for it.
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'clock';
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS ref text NOT NULL DEFAULT '';
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS ai_cost numeric NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS time_entries_ref ON time_entries(ref) WHERE ref <> '';
