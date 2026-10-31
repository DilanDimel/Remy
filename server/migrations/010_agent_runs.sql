-- Owners' Agents tab: each run of a team agent (feedback sorter, weekly analyst) and what it produced.
-- Owner-side only; holds summaries, never students' resumes or chats.
CREATE TABLE IF NOT EXISTS agent_runs (
  id      text PRIMARY KEY,
  agent   text NOT NULL,
  at      timestamptz NOT NULL DEFAULT now(),
  run_by  text NOT NULL DEFAULT '',
  output  jsonb NOT NULL
);
