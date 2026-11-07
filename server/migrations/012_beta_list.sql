-- Founding Cohort (beta) access list: while OR_BETA_ONLY=true, only these emails (plus Remy's owners/team) can sign in.
CREATE TABLE IF NOT EXISTS beta_list (
  email       text PRIMARY KEY,
  note        text NOT NULL DEFAULT '',
  added_by    text NOT NULL DEFAULT '',
  added_at    timestamptz NOT NULL DEFAULT now(),
  invited_at  timestamptz
);
