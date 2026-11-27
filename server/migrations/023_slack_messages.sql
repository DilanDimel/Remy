-- The team Slack (remyaihq): every message in the channels the Remy Slack app is in, so @Remy can answer with
-- what the team said, past Slack's 90-day free-plan limit. Team chat only, never students. server/platform/slack.ts.
CREATE TABLE IF NOT EXISTS slack_messages (
  channel      text NOT NULL,
  ts           text NOT NULL,             -- Slack's message id ("1795740173.038939"), also its time
  thread_ts    text,                      -- the thread's first message, when this is a reply
  channel_name text NOT NULL DEFAULT '',
  user_name    text NOT NULL DEFAULT '',
  text         text NOT NULL DEFAULT '',
  PRIMARY KEY (channel, ts)
);
CREATE INDEX IF NOT EXISTS slack_messages_ts ON slack_messages (ts);
