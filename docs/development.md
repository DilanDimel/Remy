# Development

How to run, test, deploy and configure Remy. The overview is the root `README.md`, every folder and module is in `docs/CODEMAP.md`; the rules for changes are in `CLAUDE.md`.

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

DigitalOcean App Platform deploys `main` automatically (app `remy`, New York, 2 GB instance with `NODE_OPTIONS=--max-old-space-size=1536`): `npm ci && npm run build`, then `node dist/index.cjs`, with health checks on `/api/config` and automatic rollback if a new version fails them. Merging a pull request is a deploy, so keep `main` green. The database is DigitalOcean Managed Postgres (`remy-db`, PostgreSQL 17); the workspace cache, voice lines, team library and nightly backups are in Cloudflare R2. Cloudflare also sits in front of remyai.org, and its hourly Worker cron (`remy-tick`) calls `/api/cron/tick` for reminders and cleanup.

The site moved to DigitalOcean on Nov 25-26, 2026. The Render service is suspended and Supabase is no longer used (sign-in is Remy's own Google and email codes); `render.yaml` and the `RENDER_*` variables are kept only until that history is cleaned up.

Android test builds: push a branch named `app-release/<version>` and the APK is published as a GitHub release.

## Configuration

Secrets live in the DigitalOcean app's settings (or a local `.env`), never in the repo.

| Variable | Purpose |
|---|---|
| `OR_AI_CHAIN` | AI providers to try in order, e.g. `openrouter:anthropic/claude-haiku-5.5,openrouter:google/gemini-3.8-flash`. Keys: `OPENROUTER_API_KEY`, `GEMINI_API_KEY` |
| `OPENROUTER_MANAGEMENT_KEY` | Optional. Lets Admin → System show the whole OpenRouter account balance (all keys) when OpenRouter only gives that to management keys. |
| `OR_AI_PRIVACY` | `on`: every OpenRouter call uses zero-data-retention providers only (owners' trial always does) |
| `OR_AI_CHAIN_OWNERS` | Separate chain for owners' accounts (trial models) |
| `OR_AI_TAILOR_CHAIN` | Optional stronger chain for resume tailoring only |
| `OR_AI_DAILY_BUDGET` | Site-wide AI requests per 24 hours (default 1500) |
| `DATABASE_URL`, `DB_SCHEMA`, `DB_SSL_CA` / `DB_SSL_CA_FILE` | Postgres connection (schema defaults to `remy`). Unset: PGlite in `OR_DB_PATH` or in memory |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `WS_CACHE_KEY` | Encrypted workspace cache in a private Cloudflare R2 bucket, kept across deploys (`server/platform/r2.ts`). Unset: memory only |
| `GOOGLE_SIGNIN_CLIENT_ID`, `GOOGLE_SIGNIN_CLIENT_SECRET` | Remy's own Google sign-in (`server/platform/oauth.ts`; falls back to the `GCAL_*` client). Email sign-in codes need only outgoing mail |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | Optional LinkedIn sign-in |
| `ELEVENLABS_API_KEY` | Remy's speaking voice (Arthur) for read-aloud, `server/ai/voice.ts`. Lines are cached in memory and R2. Unset: Remy doesn't read out loud (no robot browser voice) |
| `OWNER_EMAILS` | Founders' emails; owners see owner view and the Owners' dashboard |
| `RESEND_SMTP_URL`, `SMTP_URL`, `MAIL_FROM`, `MAIL_REPLY_TO` | Outgoing mail (Resend first, Gmail fallback) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Text messages (optional) |
| `OR_ALUMNI_EMAIL_DOMAINS` | Email domains that may see alumni matches (default `tcu.edu`) |
| `USAJOBS_KEY`, `USAJOBS_EMAIL` | Federal student roles |
| `COS_USER_ID`, `COS_TOKEN` | CareerOneStop job search |
| `GCAL_CLIENT_ID`, `GCAL_CLIENT_SECRET` | Google Calendar connection |
| `CRON_SECRET` | Shared secret for the hourly tick (same value as the `CRON_SECRET` secret on the `remy-tick` Cloudflare Worker) |
| `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `REMY_SLACK_OPENROUTER_KEY` (the bot's own AI key, separate from students'), `REMY_TEAM_NOTES` (team-only facts the bot reads; never in the repo) | The team Slack's Remy app (`docs/slack-app.md`). Without them `/api/slack/events` is off. Its private team library (`server/platform/library.ts`) is filled by the lead AI's nightly sync through `POST /api/team/library` with `REMY_AI_KEY`; files are sealed in R2 |
| `RENDER_API_KEY` | Old: Render deploys on the owners' Services panel (unused since the move) |

`grep -rhoE "process\.env\.[A-Z_0-9]+" server --include=*.ts | sort -u` lists every variable the server reads.

Anything unset turns its feature off with a "coming soon" or "needs setup" message instead of failing.
