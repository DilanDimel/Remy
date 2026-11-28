# Code map

A tour of every part of the Remy repo: what each folder and key module does, why it is there, and how the pieces connect. Read `README.md` first for what Remy is, `docs/architecture.md` for how one request flows, and `docs/development.md` for running, testing and deploying. Numbers here are from Nov 27, 2026; update this file when a folder, route group, table or workflow is added or removed.

## At a glance

| | |
|---|---|
| Product | AI career coach for college students, remyai.org, Free during beta |
| Languages | TypeScript (54% of lines), TSX/React (39%), CSS (6%), SQL (0.5%), small amounts of YAML, Gradle/Java, Swift |
| Website | React 18 + Vite 7 + Tailwind 3 + Radix UI primitives, one small custom router |
| Server | Node 20+ (CI uses 22), Express 5, plain PostgreSQL through `server/platform/sql.ts`, bundled to `dist/index.cjs` by `script/build.ts` (esbuild + Vite) |
| Phone app | Expo 58, expo-router, React Native 0.88 (React 19), in `native/` |
| Database | DigitalOcean Managed Postgres 17 in production (schema `remy`); PGlite (Postgres in Node) locally and in tests |
| Hosting | DigitalOcean App Platform app `remy` deploys `main`; Cloudflare in front; Cloudflare R2 for caches, files and backups |
| AI | `server/ai/ai.ts`: provider chain (`OR_AI_CHAIN`, Claude Haiku first, through OpenRouter with zero data retention), budgets, then `claims.ts` checks every rewrite |
| Size | about 75,000 lines of code: client 21.9k, server 25.1k, shared 10.8k, native 10.0k, script 1.5k (TS/TSX lines) |
| Tests | 715 server and script tests (`npm test`, `node:test` via `tsx`), plus the native app's own tests |

## Top-level layout

```
client/        the website (desktop and phone)        React + Vite
server/        the API, background jobs, migrations    Express
shared/        types + pure logic for all three apps   TypeScript, no DOM, no Node APIs
native/        the Expo phone app                      React Native
ios/ android/  Capacitor shells that load remyai.org   Swift / Java + Gradle
mobile/        icons, splash and offline page for the Capacitor shells
script/        build and check scripts (npm run ...)
docs/          how-to docs, this map, docs/ai/ for the AI team
.github/       CI workflows, CODEOWNERS, PR template
.claude/       design and writing skills the AI tools use (see .claude/skills/README)
```

Root files: `package.json` (all scripts), `tsconfig.json` (aliases `@/*` → `client/src`, `@shared/*` → `shared`), `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `components.json` (shadcn/ui config), `capacitor.config.ts` (app id `org.remyai.app`, loads remyai.org), `render.yaml` (old Render blueprint, kept for reference; the live site is on DigitalOcean), `CLAUDE.md` (rules for every change), `AGENTS.md` and `GEMINI.md` (point other AI tools to the same rules), `LICENSE` (proprietary, all rights reserved).

## How the three front ends relate

| Surface | Code | How it gets updates |
|---|---|---|
| Desktop website | `client/` | Every merge to `main` deploys |
| Phone website | the same `client/` code, with phone layouts (344 to 690 px) in the same pages and `useIsMobile` | Same deploy |
| Phone app (new) | `native/`, its own screens and native design, calling `https://remyai.org/api/...` and importing `../shared` | `eas update --branch preview` after a merge (owners only until the team releases it) |
| Phone app (old shell) | `ios/`, `android/`, `mobile/` (Capacitor) | Loads the live site, so it follows every deploy |

All three use the same server routes, the same `shared/types.ts` shapes and the same rules (`shared/features.ts`, `shared/beta.ts`, `shared/storyEntry.ts`, `shared/nextAction.ts`, `shared/path.ts`...), so a fix in `shared/` reaches all of them. Owner view versus student view is `useOwnerView()` on the website, `appOpenFor`/rules in `native/src/lib/rules.ts` in the app, and `isOwner` on the server.

## client/ (the website)

```
client/index.html, client/public/   page shell, theme.js (sets dark/light before paint), static files
client/src/main.tsx                 mounts App
client/src/App.tsx                  routes, layout, Remy's side panel, providers
client/src/index.css                design tokens ("paper, ink, one orange"), light and dark
client/src/pages/                   one file per screen
client/src/components/              feature components; ui/ holds shadcn/Radix primitives
client/src/lib/                     store, router, API helpers, analytics, native bridge
client/src/hooks/                   useIsMobile, useToast
```

**Pages:** `Landing2` (public front page), `Welcome`, `Onboarding` (setup), `Home`, `Path` (My Path, Remy's office, daily round), `Resume` (upload, builder, review, tailoring), `Opportunities` (openings, fit, import by link), `Interview`, `Progress` (tracker, check-ins), `Calendar`, `Community`, `Rewards`, `Accounts` (profile, settings, memory, data), `Info` (about, privacy, terms), `Admin` (owners' dashboard), `not-found`.

**Key lib files:**
- `lib/store.tsx`: the app's state and the only way to call the server: `api()`, `save()`, `download()` with literal `/api/...` URLs (the contract check reads them). Also `useOwnerView()`.
- `lib/router.ts`: `go()`, `useRoute()`, a small router instead of a library.
- `lib/native.ts`: Capacitor-only behaviour (downloads, links); does nothing on the web.
- `lib/analytics.ts` (PostHog), `lib/signals.ts` (automatic problem signals), `lib/presence.ts` (owner activity), `lib/i18n.ts` (languages), `lib/voice.ts` (Remy reading aloud), `lib/news.ts` (What's new), `lib/tailorChat.ts`, `lib/jobs.ts`, `lib/wordPdf.ts`.

**Key components:** Remy's panel and coaching (`RemyAsk`, `RemyOffer`, `RemyDid`, `WhatsThat`, `Tour`), resume (`ResumeReal`, `ResumeBuilder`, `StoryEntry` (add an experience from a story), `ResumeReview`, `ResumeMarkup`, `AtsCard`, `AtsXray`, `FormatCheck`, `WordPreview`), path and game (`PathBoard`, `DailyPath`, `RoadCard`, `SeasonCard`, `Game`, `Places`, `PinMoment`, `Celebrate`), interviews (`JobInterview`, `MockInterview`, `InterviewCoach`, `PracticeOutLoud`, `StoryDeck`, `PitchCard`), plus `GoogleCalendar`, `LinkedInCoach`, `SchoolVerify`, `OrgLogo`, `WhatsNew`, `ThemeToggle`, `ErrorBoundary`. Remy's drawing and office styles live in `scholar.ts`, `scholar.css`, `office.css`.

## server/ (the API)

```
server/index.ts      Express app, security headers, compression, waits for the database, starts routes
server/routes.ts     every /api route (about 150), each one checks the session then calls a feature module
server/vite.ts       Vite as middleware in development
server/static.ts     serves dist/public in production, with long caching for hashed assets
server/platform/     infrastructure: database, sessions, sign-in, owners, limits, storage, Slack
server/ai/           every model call and every check on what the AI says
server/resume/       reading, scoring, building and exporting resumes
server/jobs/         finding, checking, ranking and explaining openings
server/coach/        coaching flows: check-ins, nudges, pitch, interviews, briefs
server/notify/       email, texts, Google Calendar, reminders
server/migrations/   numbered SQL files, run once each at startup
server/data/         public datasets (BLS outlook, O*NET titles and tasks, employers, US metros) and SOURCES.md
server/fonts/        open fonts used to rebuild PDF and Word resumes
server/fixtures/     test data for ranking and job relevance
server/certs/        a public CA certificate (from the old database provider), read only if DB_SSL_CA_FILE points to it
server/*.test.ts     tests of routes and shared/ logic; feature tests sit beside their file
```

### server/platform/
- `sql.ts`: the one place Remy talks to Postgres (`$1` parameters, TLS with certificate checks, PGlite fallback).
- `db.ts`: users, sessions, the student workspace (one JSON document per student, merged per section on save).
- `auth.ts`: resolves the caller from the `__Host-or_sid` session cookie; guests; owner tagging.
- `oauth.ts`: Remy's own Google (and LinkedIn) sign-in with OpenID Connect, code flow on the server. Email codes live in `routes.ts` with `signin_codes`.
- `admin.ts`: the owners' dashboard data and `isOwner` (`OWNER_EMAILS`).
- `beta.ts`, `features.ts`: Founding Cohort access, beta terms, and Feature releases (owners-only until released).
- `limits.ts`: rate limits stored in the database so restarts don't reset them. `readOnly.ts`: `READ_ONLY=1` maintenance mode.
- `r2.ts`, `backup.ts`, `storage.ts`, `upload.ts`, `compress.ts`, `stream.ts`: R2 cache, nightly backups, database size, upload cap, gzip, streaming headers.
- `studentJobs.ts`: saved openings in their own table (moving out of the workspace document).
- `services.ts`: health, live version and AI balance for the dashboard. `posthog.ts`: analytics config. `presence.ts`: owners' own usage.
- `contrib.ts`: team hours and AI cost from merged PRs. `aiKey.ts`: the lead AI's own key (`REMY_AI_KEY`). `slack.ts`, `library.ts`: Remy in the team Slack and its private team library.

### server/ai/
- `ai.ts`: provider chain, daily budget, per-user limits, owner chain, privacy routing.
- `claims.ts`: deterministic unsupported-claim checker; nothing invented reaches a student. `safety.ts`: shared safeguards and a crisis check that doesn't depend on the AI.
- `tailorFix.ts` (one repair pass), `bulletDraft.ts` (checks one improved bullet), `chatDo.ts` and `remyTools.ts` (actions Remy can take from chat, with undo), `pageGuide.ts` (what each page shows, so Remy can explain it), `streamReply.ts`, `term.ts`, `voice.ts` (ElevenLabs voice, cached).

### server/resume/
`parse.ts` (PDF/Word by file bytes), `resume.ts` (text → `ResumeDoc`), `ats.ts` (suggestions from the resume itself, no AI), `format.ts` (format check), `builder.ts` (guided builder, student's own words only; also drafts lines for one experience told as a story, `POST /api/resume/story`), `docxEdit.ts` (edit only changed bullets inside the student's Word file), `pdfTwin.ts` and `twinDocx.ts` (keep a PDF resume's look in PDF and Word), `docs.ts` (page geometry), `langs.ts` (resume words in other languages), `transcript.ts` (transcript reader instructions; GPA and credits must be printed on the transcript), `trim.ts` (keeps saved lists small).

### server/jobs/
`sources.ts` (live openings from Greenhouse, Lever, Ashby, Workday, SmartRecruiters and more, plus USAJOBS and CareerOneStop), `catalog.ts` (about 80,000 employers' public boards), `openings.ts` (shared checked-openings table), `fit.ts` (deterministic eligibility and fit; `NO_RESUME_WHY` for rough matches without a resume), `ranking.ts`, `dedupe.ts`, `fullPosting.ts`, `soc.ts` and `metros.ts` (occupation codes and metro areas), `future.ts` (10-year outlook), `logo.ts`, `competitions.ts`, `conferences.ts`, `signals.ts`, `insights.ts` (funnel and outcomes for owners).

### server/coach/
`checkin.ts` (weekly check-in → resume line), `nudges.ts` (Remy reaches out first), `brief.ts` (company and role brief before tailoring), `pitch.ts`, `interview.ts` and `interviewDate.ts` (mock interview), `asks.ts`, `keepDecided.ts`, `noUpgrade.ts`, `outreachAsk.ts`, `storyLines.ts`, `language.ts`.

### server/notify/
`email.ts` (Resend first, Gmail fallback), `layout.ts` (branded email), `texts.ts` (opt-in Twilio texts for urgent deadlines), `gcal.ts` (Remy's own calendar in the student's Google account), `reminders.ts`.

### Main API routes

All under `/api`, defined in `server/routes.ts`. Groups by count: `admin` (36), `resume` (13), `applications` (10), `jobs` (9), `auth` (9), `ai` (9), `calendar` (6), `interviews` (5), then smaller groups.

| Area | Routes |
|---|---|
| Start-up | `GET /api/config`, `GET /api/me` |
| Sign-in | `POST /api/auth/email/start`, `/email/verify`, `/google`, `/guest`, `/logout`, `GET /api/auth/oauth/:provider/start` and `/callback`, `POST /api/auth/oauth/redeem`, `GET /api/auth/app-handoff` (app sign-in) |
| Workspace | `PUT /api/ws/:section` (save one section), `DELETE /api/ws`, `GET /api/export/data`, memory (`/api/memory/...`) |
| Resume | `/api/resume/...` (upload, review, tailor, export, story), `/api/builder/...` |
| Jobs | `/api/jobs/...`, `/api/import`, `/api/applications/...`, `/api/careers`, `/api/occupation`, `/api/future`, `/api/logo` |
| Remy and AI | `/api/ai/...`, `/api/chat/...`, `/api/remy/...`, `/api/voice`, `/api/nudges`, `/api/checkin`, `/api/stories`, `/api/interviews/...` |
| Calendar | `/api/calendar/...`, `/api/calendar.ics`, `/api/reminders` |
| Owners | `/api/admin/...`: overview, funnel, outcomes, students, errors, feedback, beta list and applications, features, team, tasks, events, hours, clock, services, storage, db-traffic, openings, student-jobs, signals, activity |
| Team and bots | `/api/team/library`, `/api/team/presence`, `/api/slack/events`, `/commands`, `/interact` |
| Background | `POST /api/cron/tick` (hourly, called by the `remy-tick` Cloudflare Worker with `CRON_SECRET`) |
| Public | `/api/public/careers`, `/api/client-error`, `/api/stream-check` |

`npm run check:contract` fails if the client calls a route that doesn't exist.

## Data model

Shapes live in `shared/types.ts`. Each student's whole account (profile, resume, openings, applications, tracker, chat) is one JSON document in `workspaces`, saved per section; heavy or shared data is moving into its own tables (saved openings already have). Tables from `server/migrations/`:

| Table(s) | Migration | What it holds |
|---|---|---|
| `users`, `sessions`, `workspaces`, `files`, `ai_usage` | 001 | Accounts, sessions, each student's document, uploaded files, AI usage |
| (views) | 002 | Read-only views that turn workspaces into rows for analysis |
| `school_email_codes` | 003 | School email proof codes |
| `google_calendar` | 004 | Calendar connection per student |
| `error_reports`, `team_tasks`, `team_events`, `time_entries`, `team_members`, `team_activity`, `team_calendar`, `team_event_rsvps` | 005-008 | Owners' dashboard: errors, to-dos, meetings, hours, teammates, team calendar and RSVPs |
| `board_cache` | 009 | What one employer career site returned, shared by everyone |
| `agent_runs` | 010 | Runs of the old owners' Agents tab (tab removed, table kept) |
| `signin_codes` | 011 | Hashed 6-digit sign-in codes |
| `beta_list`, `beta_applications` | 012-013 | Founding Cohort access and applications |
| `checked_openings` | 014 | One shared row per public posting, no student data |
| `usage_daily`, `usage_events` | 015-016 | Database transfer estimate, automatic page and problem signals |
| `site_settings` | 017 | Site-wide switches (open access, feature releases) |
| `rate_limits` | 018 | Counters per key per window |
| (columns) | 019 | Hours and AI cost from merged PRs, next to clocked time |
| `student_jobs`, `student_jobs_state` | 020 | Saved openings in their own table |
| `deleted_accounts` | 021 | One-way hashes of deleted accounts only |
| `owner_minutes`, `owner_actions` | 022 | How owners use Remy (owner accounts only) |
| `slack_messages` | 023 | Team Slack messages for @Remy |
| `team_library` | 024 | Remy's private team library index (files sealed in R2) |

Never edit a migration that has shipped; add the next number.

## shared/

Imported by the website, the server and the app (`@shared/*`, `../shared` in native). No DOM and no Node APIs, so every file runs everywhere and is tested from `server/*.test.ts`.

- **Model:** `types.ts` (every shape), `news.ts` + `news/*.ts` (What's new, one file per note, about 450), `i18n.ts` + `i18n/es.ts` (languages).
- **Rules:** `features.ts` (feature releases), `beta.ts` (terms version), `limits.ts`, `workAuth.ts`, `names.ts`, `junk.ts`.
- **Career content:** `roads.ts` and `roads-business.ts`, `roads-engineering.ts`, `roads-health.ts` (field roads from official sources), `seasons.ts` (recruiting timing), `fields.ts`, `regions.ts`, `screening.ts`, `requirements.ts`, `questionBank.ts` (interview questions with sources), `interviewRubric.ts`, `interviewCoach.ts`, `interview.ts`, `jobInterview.ts`, `prep.ts`.
- **Jobs logic:** `order.ts`, `roleMatch.ts`, `opportunityType.ts`, `employer.ts`, `org.ts`, `pay.ts` (only what a posting states), `postingText.ts`, `logos.ts`, `words.ts`.
- **Resume logic:** `bullets.ts`, `markup.ts`, `review.ts`, `resumeDiff.ts`, `linkedin.ts`.
- **Remy and the game:** `nextAction.ts`, `homeLine.ts`, `greeting.ts`, `officeLines.ts`, `officeSteps.ts`, `remyAsks.ts`, `remyOffers.ts`, `activity.ts`, `path.ts`, `daily.ts`, `game.ts`, `chest.ts`, `pins.ts`, `places.ts`, `progress.ts`, `calendarPlan.ts`, `checkin.ts`, `stories.ts`, `speech.ts`, `setupDefaults.ts`, `setupReply.ts`, `plainSkills.ts` (skills in plain words), `exploreLanes.ts` (My Path explore mode).
- **Team tooling:** `aiStatus.ts` and `autoHours.ts` (read `docs/ai/` for `check:ai` and team hours), `acceptEmail.ts`.

## native/ (the Expo app)

Owned by Demetre (`docs/ai/owners.json`); read `docs/ai/status/demetre.md` before changing it. Details in `native/README.md`.

```
native/src/app/          expo-router screens: (tabs)/ Home, My Path, Resume, Jobs, More;
                         plus sign-in, setup, job, tailor, interview, prep, round, progress, calendar,
                         community, rewards, account, profile, news, feedback, remy (chat), admin-* screens
native/src/components/   native components (Remy's office, setup steps, cards, steppers)
native/src/lib/          API client, session, jobs provider, tokens (generated from client/src/index.css), rules
app.json, eas.json       Expo app config and EAS build profiles (preview, production)
```

Screens not yet rebuilt natively open the website in a signed-in sheet (`src/app/web.tsx`). Sign-in in the app uses the email code; `GET /api/auth/app-handoff` passes a session back from the browser.

## script/

| Script | npm command | What it does |
|---|---|---|
| `build.ts` | `npm run build` | Vite builds the client, esbuild bundles the server to `dist/index.cjs` |
| `contract.ts` | `npm run check:contract` | Every client API call has a real route; no raw colours outside `color-allowlist.json` |
| `resume-check.ts` | `npm run check:resume` | Resume reading against fixtures, no server or AI |
| `persist.ts` | `npm run check:persist` | Builds, restarts on a throwaway database, checks nothing is lost |
| `ai.ts` | `npm run ai:brief`, `npm run check:ai` | The AI team briefing and CI rules (owned files, claims, status files) |
| `hours.ts` | `npm run hours:estimate` | Rebuilds `docs/ai/hours/estimated.json` from commits and PRs |
| `restore-backup.ts` | `npm run restore-backup` | Restores the database from the nightly R2 backups |
| `copy-database.ts` | (run with tsx) | Copies every account between databases and checks counts (used for the database moves) |
| `coverage.ts`, `regression.ts` | (run with tsx) | Older idea-coverage and regression reports (`docs/idea-inventory.json`, `docs/mindmap-coverage.csv`, `docs/regression-results.json`) |

## Tests and CI

- `npm test` runs `server/*.test.ts`, `server/*/*.test.ts` and `script/*.test.ts` with Node's built-in test runner through `tsx` (715 tests on Nov 27). They use PGlite, so no database or AI key is needed.
- `.github/workflows/checks.yml` (every PR and `main`): type check, contract check, tests, and `check:ai` on PRs.
- `native.yml`: the app's type check and tests when `native/` or `shared/` change.
- `mobile.yml` and `mobile-ios.yml`: build the Capacitor Android and iPhone shells when their files change. `mobile-release.yml`: a branch named `app-release/<version>` publishes an Android APK as a GitHub release.
- `CODEOWNERS` asks Julio to review `client/`, `server/`, `shared/` and Demetre to review `native/`; reviews don't block merging.

## Deploy and outside services

- **DigitalOcean App Platform** (app `remy`): builds `npm ci && npm run build`, runs `node dist/index.cjs`, health check `/api/config`, automatic rollback. Secrets live in the app's settings, never in the repo.
- **DigitalOcean Managed Postgres** (`remy-db`, PG 17).
- **Cloudflare**: DNS and proxy for remyai.org, the `remy-tick` Worker cron (hourly `POST /api/cron/tick`), R2 for the workspace cache, voice lines, the team library and nightly backups.
- **OpenRouter** (AI, zero data retention), **ElevenLabs** (Remy's voice), **Resend** (email), **Twilio** (optional texts), **Google** (sign-in and Calendar), **PostHog** (website analytics), **Slack** (team bot).
- **Expo EAS**: app builds and over-the-air updates for `native/`.

## docs/

| File or folder | What it is |
|---|---|
| `development.md` | Run, test, deploy, configuration (every environment variable) |
| `architecture.md` | How a request flows, where new things go |
| `CODEMAP.md` | This file |
| `FRONTEND-RULES.md` | Longer UI rules |
| `mobile-app.md` | The Capacitor shells and how they relate to `native/` |
| `slack-app.md` | The team Slack's Remy app |
| `database-plan.md` | October plan for moving out of the one-document workspace (partly done) |
| `ai/` | The AI team: `CONTEXT.md` (what's true now), `DECISIONS.md`, `TEAM.md`, `owners.json`, `status/` (one file per person, `status/lead/` one file per lead thread), `findings/`, `hours/`, `review-checklist.md` |
| `evidence/` | Saved AI runs and before/after resume pairs used to test honesty |
| `finance/` | Cost model (Julio's) |
| `superpowers/specs/` | Older design specs |
| `archive/` | Notes that no longer describe how Remy works, kept for history |
| `beta-form-hook.gs` | Google Apps Script that posts Founding Cohort applications to the server |
| `idea-inventory.json`, `mindmap-coverage.csv`, `regression-results.json` | Data read and written by `script/coverage.ts` and `script/regression.ts` |
