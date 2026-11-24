-- Site-wide switches owners flip on the Admin page (first: open_access, anyone can sign in during the beta).
CREATE TABLE IF NOT EXISTS site_settings (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_by text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Which heavy AI feature a call was for ("tailor"), so open access can cap each one per day.
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT '';
