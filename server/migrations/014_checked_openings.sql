-- Checked openings (Demetre, data & databases): one row per public posting Remy has found or checked, shared by
-- every student, tagged by company, industry and career path so the team can see what Remy knows about without
-- opening anyone's workspace. Public postings only; nothing about any student is stored here.
-- Rows not seen or checked for OPENINGS_KEEP_DAYS (default 30) are discarded by the 6-hour sweep.
CREATE TABLE IF NOT EXISTS checked_openings (
  url           text PRIMARY KEY,
  title         text NOT NULL,
  company       text NOT NULL,
  company_key   text NOT NULL,
  kind          text NOT NULL DEFAULT 'job',
  location      text NOT NULL DEFAULT '',
  industry      text NOT NULL DEFAULT '',
  career_path   text NOT NULL DEFAULT '',
  source_name   text NOT NULL DEFAULT '',
  deadline      text NOT NULL DEFAULT '',
  first_seen    timestamptz NOT NULL DEFAULT now(),
  last_seen     timestamptz NOT NULL DEFAULT now(),
  times_seen    integer NOT NULL DEFAULT 1,
  last_checked  timestamptz,
  check_result  text,
  http_status   integer
);
CREATE INDEX IF NOT EXISTS checked_openings_company ON checked_openings(company_key);
CREATE INDEX IF NOT EXISTS checked_openings_industry ON checked_openings(industry);
CREATE INDEX IF NOT EXISTS checked_openings_path ON checked_openings(career_path);
CREATE INDEX IF NOT EXISTS checked_openings_last_seen ON checked_openings(last_seen);
