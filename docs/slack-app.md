# Remy in the team Slack

Remy answers questions in the team Slack (remyaihq.slack.com). Mention `@Remy` in any channel he's in, or DM him. He reads what the team said in every channel he's in (the last 14 days, the thread, and older messages that share the question's words), plus `docs/ai/CONTEXT.md`, `docs/ai/DAILY.md` and recent pull requests. Code: `server/platform/slack.ts`. Messages are kept in `slack_messages` (team chat only, never students), so history stays past the free plan's 90 days.

## Set up (once)

1. Go to https://api.slack.com/apps → **Create New App** → **From a manifest** → pick the RemyAI workspace → paste the manifest below → **Create**.
2. **Install to Workspace** → Allow.
3. Copy **OAuth & Permissions → Bot User OAuth Token** (`xoxb-…`) and **Basic Information → Signing Secret**.
4. Add them on DigitalOcean (app "remy" → Settings → Environment variables, encrypted): `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`. Save (it redeploys).
5. In each channel: `/invite @Remy`.
6. If Event Subscriptions shows the URL as unverified, press **Retry** after the deploy finishes.

## Manifest

```yaml
display_information:
  name: Remy
  description: RemyAI's team AI. Ask about anything the team said or shipped.
  background_color: "#161616"
features:
  bot_user:
    display_name: Remy
    always_online: true
  app_home:
    home_tab_enabled: true
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
  slash_commands:
    - command: /bug
      url: https://remyai.org/api/slack/commands
      description: Log something that broke (#website, or #app if it starts with "app")
      usage_hint: "[app] what broke"
  shortcuts:
    - name: Ask Remy about this
      type: message
      callback_id: ask_remy
      description: Remy explains this message or helps in its thread
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - channels:history
      - channels:read
      - groups:history
      - groups:read
      - im:history
      - chat:write
      - users:read
      - channels:join
      - pins:write
      - commands
settings:
  event_subscriptions:
    request_url: https://remyai.org/api/slack/events
    bot_events:
      - app_mention
      - message.channels
      - message.groups
      - message.im
      - app_home_opened
  interactivity:
    is_enabled: true
    request_url: https://remyai.org/api/slack/interact
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

Also: a **Home tab** (how to use Remy, where things go, when he posts), **`/bug`** (posts in #website, or #app when the text starts with "app"), and the **Ask Remy about this** message shortcut (⋮ on a message). Remy's own posts carry a coloured side bar: orange (`--fox`), green when the backup check is fine (`--sage`), red for alerts and bugs (`--error`). App icon: the fox (`client/public/icon-512.png`), background `#161616`.

Cost: one Haiku call per question (about 1 to 3 cents with the context it reads). Limit: 600 Slack events an hour.
