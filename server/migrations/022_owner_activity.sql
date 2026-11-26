-- How the owners use Remy themselves (Admin → Team & hours → Using Remy). Owner accounts only, never students:
-- server/platform/presence.ts writes a row only when isOwner() is true. Pages, actions and minutes; no content.
-- One row per owner per active minute (Remy on screen and used in the last 60 s), kept 90 days.
CREATE TABLE IF NOT EXISTS owner_minutes (
  email  text NOT NULL,
  minute timestamptz NOT NULL,
  device text NOT NULL DEFAULT 'desktop', -- desktop | phone | app
  area   text NOT NULL DEFAULT 'Other',   -- Home, Resume, Owners' dashboard…
  PRIMARY KEY (email, minute)
);
-- Finished actions per owner per day, by route pattern ("POST /api/remy/ask"), labelled when read.
CREATE TABLE IF NOT EXISTS owner_actions (
  email  text NOT NULL,
  day    date NOT NULL,
  action text NOT NULL,
  n      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (email, day, action)
);
