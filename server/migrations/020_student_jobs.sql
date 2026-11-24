-- Saved openings in their own table (Dilan said go, Nov 24), step 1 of the move out of workspaces.data.
-- While the switch (site_settings 'student_jobs') is 'copy' or 'owners', workspaces.data.jobs stays the real copy and
-- this table is a checked duplicate; nothing here is read unless the switch says so. See server/platform/studentJobs.ts.
CREATE TABLE IF NOT EXISTS student_jobs (
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     text NOT NULL,
  pos        integer NOT NULL,   -- place in the student's list, from 0
  data       jsonb NOT NULL,     -- the whole Job object, as in workspaces.data.jobs
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
-- One row per account that has been copied. jobs_v goes up on every change, so a server can tell its copy is current
-- with one tiny read. note is '' when the copy is good, otherwise why the account was left out (e.g. duplicate ids).
CREATE TABLE IF NOT EXISTS student_jobs_state (
  user_id   text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  copied_at timestamptz NOT NULL DEFAULT now(),
  jobs_v    integer NOT NULL DEFAULT 1,
  note      text NOT NULL DEFAULT ''
);
