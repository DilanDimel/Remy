# Remy

Remy is an AI career coach for college students, starting at TCU. It reads a student's resume into a profile, finds real openings on employers' own career sites, scores the resume the way hiring software reads it, tailors resumes and cover letters without inventing anything, and tracks every application. Live at [remyai.org](https://remyai.org).

## Stack

TypeScript everywhere. React + Vite front end, Express server, Postgres (Supabase in production, PGlite locally and in tests), Supabase Auth for sign-in, and Capacitor shells for iPhone and Android that load the live site.

## Layout

| Folder | What's in it |
|---|---|
| `client/src/pages/` | One file per screen (Home, Path, Resume, Opportunities, Interview, Admin, ...) |
| `client/src/components/` | Shared pieces; `ui/` is shadcn/Radix primitives, `common.tsx` has `<Remy />` the fox |
| `client/src/lib/` | API helpers (`store.tsx`: `api`, `save`, `download`), router, Supabase client |
| `server/` | Express app. `index.ts` boots it, `routes.ts` holds every `/api` route, the other files are features (`resume.ts`, `openings.ts`, `ai.ts`, `claims.ts`, ...) with `*.test.ts` beside them |
| `server/migrations/` | SQL migrations, run once each at startup |
| `server/data/` | Static data: employer list, BLS projections, O*NET tasks |
| `shared/` | Types and pure logic used by both sides (`types.ts`, roads, seasons, game) |
| `script/` | Build and check scripts (`build.ts`, `contract.ts`, `resume-check.ts`, `persist.ts`) |
| `ios/`, `android/`, `mobile/`, `capacitor.config.ts` | Native app shells, see `docs/mobile-app.md` |
| `docs/` | Design notes and plans; `docs/archive/` is history |

`docs/architecture.md` explains how a request flows through the code and where to put new things.

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

GitHub Actions runs the first three on every push and pull request. The iPhone and Android workflows run only when native files change.

## Deploy

Render deploys `main` automatically (`render.yaml`): `npm ci && npm run build`, then `node dist/index.cjs`. Merging a pull request is a deploy, so keep `main` green. An hourly GitHub Action (`tick.yml`) wakes the server for reminders and cleanup.

Android test builds: push a branch named `app-release/<version>` and the APK is published as a GitHub release.

## Configuration

Secrets live in the Render dashboard, never in the repo.

| Variable | Purpose |
|---|---|
| `OR_AI_CHAIN` | AI providers to try in order, e.g. `openrouter:google/gemini-3.8-flash,gemini:gemini-3.8-flash`. Keys: `OPENROUTER_API_KEY`, `GEMINI_API_KEY` |
| `OR_AI_CHAIN_OWNERS` | Separate chain for owners' accounts (trial models) |
| `OR_AI_TAILOR_CHAIN` | Optional stronger chain for resume tailoring only |
| `OR_AI_DAILY_BUDGET` | Site-wide AI requests per 24 hours (default 1500) |
| `DATABASE_URL`, `DB_SCHEMA`, `DB_SSL_CA_FILE` | Postgres connection (schema defaults to `remy`). Unset: PGlite in `OR_DB_PATH` or in memory |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase Auth (the publishable key is public by design) |
| `OWNER_EMAILS` | Founders' emails; owners see owner view and the Owners' dashboard |
| `RESEND_SMTP_URL`, `SMTP_URL`, `MAIL_FROM`, `MAIL_REPLY_TO` | Outgoing mail (Resend first, Gmail fallback) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Text messages (optional) |
| `OR_ALUMNI_EMAIL_DOMAINS` | Email domains that may see alumni matches (default `tcu.edu`) |
| `USAJOBS_KEY`, `USAJOBS_EMAIL` | Federal student roles |
| `COS_USER_ID`, `COS_TOKEN` | CareerOneStop job search |
| `GCAL_CLIENT_ID`, `GCAL_CLIENT_SECRET` | Google Calendar connection |
| `CRON_SECRET` | Shared secret for the hourly tick |
| `RENDER_API_KEY` | Owners' dashboard deploy and health panel |

`grep -oh "process.env.[A-Z_0-9]*" server/*.ts | sort -u` lists every variable the server reads.

Anything unset turns its feature off with a "coming soon" or "needs setup" message instead of failing.

## Working in this repo

Read `CLAUDE.md` first: the rules every change must follow (owner-view gating, the colour contract, phone widths, no invented claims) and how pull requests are handled.
