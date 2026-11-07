-- Founding Cohort applications, sent by the Google Form's script the moment someone submits. One row per email
-- (a re-submission updates the answers but keeps the team's decision). Declined rows are deleted by an owner
-- after the cohort closes.
CREATE TABLE IF NOT EXISTS beta_applications (
  email        text PRIMARY KEY,
  name         text NOT NULL DEFAULT '',
  school       text NOT NULL DEFAULT '',
  major        text NOT NULL DEFAULT '',
  class_year   text NOT NULL DEFAULT '',
  goal         text NOT NULL DEFAULT '',
  stuck        text NOT NULL DEFAULT '',
  tools        text NOT NULL DEFAULT '',
  feedback     text NOT NULL DEFAULT '',
  source       text NOT NULL DEFAULT '',
  terms        text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'new',
  cohort       text NOT NULL DEFAULT '',
  decided_by   text NOT NULL DEFAULT '',
  decided_at   timestamptz,
  received_at  timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
