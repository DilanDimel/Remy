-- Automatic signals from signed-in students' browsers, counted per Central-time day: page visits ("page:/opportunities"),
-- rage clicks ("rage:/resume:button-tailor") and one-tap ratings ("rate:tailor:up"). Counts only, no student id.
CREATE TABLE IF NOT EXISTS usage_events (
  day    text NOT NULL,
  name   text NOT NULL,
  n      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);
