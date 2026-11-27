# Development

How to run, test, deploy and configure Remy. The team-facing overview is the root `README.md`; the rules for changes are in `CLAUDE.md`.

## Folders

`client/src/pages/` screens, `client/src/components/` shared UI (`ui/` primitives), `client/src/lib/` API helpers and router, `server/` Express API with tests beside each file, `server/migrations/` SQL, `shared/` types and logic for both sides, `script/` build and check scripts, `ios/` `android/` `mobile/` native shells (see `docs/mobile-app.md`). Details in `docs/architecture.md`.

## Run it

Needs Node 20 or newer.

```bash
npm ci
npm run dev        # Express + Vite on http://localhost:5000
```

With no environment variables the app still runs: data goes to an in-memory PGlite database and AI features say "needs setup". Put local settings in `.env` (never committed).

## Test it

```bash
npm run check            # TypeScript
npm run check:contract   # every client API call matches a real server route, colours follow the palette
npm test                 # server unit tests (server/*.test.ts)
npm run check:resume     # resume reading against fixtures, no server or AI key needed
npm run check:persist    # builds, restarts on a throwaway database, confirms nothing is lost
```

GitHub Actions runs the first three on every pull request and on pushes to `main`. The iPhone and Android workflows run only when native files change.

## What's new

The in-app "What's new" list is one file per note in `shared/news/` (types and helpers in `shared/news.ts`). Every PR that changes what students or owners see adds one new file named `YYYY-MM-DD-HHMM.ts`, the UTC date and time you wrote it (ids only grow, and two PRs never pick the same file), copying the shape of the newest note: a kind (New, Improved, Fixed, Changed), a short title and one or two plain sentences a student would understand. Owners-only work sets `owners: true`, so only owner view lists it; remove the flag when the feature is released to students.

## Deploy

Render deploys `main` automatically (`render.yaml`): `npm ci && npm run build`, then `node dist/index.cjs`. Merging a pull request is a deploy, so keep `main` green. The live service is `remy-virginia` in Render's Virginia region, next to the Supabase database (us-east-1); it moved from `offer-ready` in Oregon on Nov 24, 2026, which cut signed-in requests from about 200-380 ms to 15-70 ms. Its settings come from the `remy-server-env` environment group, so change secrets there. Health check: `/api/config`. Never add a disk (it turns off zero-downtime deploys). An hourly Cloudflare Worker cron (`remy-tick`) calls `/api/cron/tick` for reminders and cleanup.

Android test builds: push a branch named `app-release/<version>` and the APK is published as a GitHub release.

## Configuration

Secrets live in the Render dashboard (environment group `remy-server-env`), never in the repo.

| Variable | Purpose |
|---|---|
| `OR_AI_CHAIN` | AI providers to try in order, e.g. `openrouter:anthropic/claude-haiku-5.5,openrouter:google/gemini-3.8-flash`. Keys: `OPENROUTER_API_KEY`, `GEMINI_API_KEY` |
| `OPENROUTER_MANAGEMENT_KEY` | Optional. Lets Admin → System show the whole OpenRouter account balance (all keys) when OpenRouter only gives that to management keys. |
| `OR_AI_PRIVACY` | `on`: every OpenRouter call uses zero-data-retention providers only (owners' trial always does) |
| `OR_AI_CHAIN_OWNERS` | Separate chain for owners' accounts (trial models) |
| `OR_AI_TAILOR_CHAIN` | Optional stronger chain for resume tailoring only |
| `OR_AI_DAILY_BUDGET` | Site-wide AI requests per 24 hours (default 1500) |
| `DATABASE_URL`, `DB_SCHEMA`, `DB_SSL_CA_FILE` | Postgres connection (schema defaults to `remy`). Unset: PGlite in `OR_DB_PATH` or in memory |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `WS_CACHE_KEY` | Encrypted workspace cache in a private Cloudflare R2 bucket, kept across deploys (`server/platform/r2.ts`). Unset: memory only |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase Auth (the publishable key is public by design) |
| `ELEVENLABS_API_KEY` | Remy's speaking voice (Arthur) for read-aloud, `server/ai/voice.ts`. Lines are cached in memory and R2. Unset: Remy doesn't read out loud (no robot browser voice) |
| `OWNER_EMAILS` | Founders' emails; owners see owner view and the Owners' dashboard |
| `RESEND_SMTP_URL`, `SMTP_URL`, `MAIL_FROM`, `MAIL_REPLY_TO` | Outgoing mail (Resend first, Gmail fallback) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Text messages (optional) |
| `OR_ALUMNI_EMAIL_DOMAINS` | Email domains that may see alumni matches (default `tcu.edu`) |
| `USAJOBS_KEY`, `USAJOBS_EMAIL` | Federal student roles |
| `COS_USER_ID`, `COS_TOKEN` | CareerOneStop job search |
| `GCAL_CLIENT_ID`, `GCAL_CLIENT_SECRET` | Google Calendar connection |
| `CRON_SECRET` | Shared secret for the hourly tick (same value as the `CRON_SECRET` secret on the `remy-tick` Cloudflare Worker) |
| `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `REMY_SLACK_OPENROUTER_KEY` (the bot's own AI key, separate from students'), `REMY_TEAM_NOTES` (team-only facts the bot reads; never in the repo) | The team Slack's Remy app (`docs/slack-app.md`). Without them `/api/slack/events` is off |
| `RENDER_API_KEY` | Owners' dashboard deploy and health panel |

`grep -oh "process.env.[A-Z_0-9]*" server/*.ts | sort -u` lists every variable the server reads.

Anything unset turns its feature off with a "coming soon" or "needs setup" message instead of failing.
