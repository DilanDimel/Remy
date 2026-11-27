# Architecture

How the pieces fit together. For every folder, module, route and table, see [`CODEMAP.md`](CODEMAP.md).

## How a request flows

1. **Browser.** `client/src/main.tsx` mounts `App.tsx`, which wraps everything in `StoreProvider` (`lib/store.tsx`). The store loads `/api/config`, `/api/me` and the student's workspace, and exposes `api()`, `save()` and `download()`. Pages read state with `useStore()`; `lib/router.ts` is a small router (`go`, `useRoute`).
2. **Server.** `server/index.ts` builds the Express app, waits for the database (`sql.ts`), and calls `registerRoutes` in `routes.ts`. In development Vite runs as middleware (`vite.ts`); in production `static.ts` serves `dist/public`.
3. **Routes to features.** Each route in `routes.ts` checks the session (`auth.ts`), then calls a feature module: `resume.ts` for reading resumes, `openings.ts`/`sources.ts`/`ranking.ts`/`fit.ts` for jobs, `ai.ts` for every model call, `claims.ts` and `safety.ts` to check AI output, and so on.
4. **Storage.** `db.ts` keeps each student's workspace as one JSON document (merged per section on save) plus side tables for sessions, usage, openings and owners' data. `docs/database-plan.md` has the details.
5. **AI.** Everything goes through `ai.ts`, which tries the providers in `OR_AI_CHAIN` in order, enforces the daily budget and per-user limits, and tags owner calls so they can use `OR_AI_CHAIN_OWNERS`.

`shared/` is imported by both sides through the `@shared/*` alias: types (`types.ts`) and pure logic such as roads, seasons and the game.

## Background work

`POST /api/cron/tick` runs the background jobs (deadline reminders, the weekly digest, guest cleanup). A Cloudflare Worker cron (`remy-tick` in Cloudflare, 17 minutes past each hour) calls it hourly, so the jobs run on schedule. It replaced a GitHub Action to save Actions minutes.

## Where new things go

| Adding... | Put it in |
|---|---|
| A screen | `client/src/pages/<Name>.tsx`, wired in `App.tsx` |
| A reusable piece of UI | `client/src/components/` (primitives in `components/ui/`) |
| An API route | `server/routes.ts`, logic in `server/<area>/`, test beside it |
| A type both sides use | `shared/types.ts` |
| Pure logic both sides use | `shared/<topic>.ts` with a test in `server/` |
| A database table or column | next `server/migrations/NNN_name.sql` |
| A check script | `script/`, plus an `npm run` entry |

## Server folders

`index.ts`, `routes.ts`, `vite.ts` and `static.ts` stay at the top of `server/`, with the static data (`data/`, `migrations/`, `certs/`, `fixtures/`, `sample-resume.txt`) that the server reads by path. Features are grouped by area, each test beside the file it tests:

```
server/
  platform/   db sql storage auth admin beta services ids
  ai/         ai chatDo claims safety tailorFix bulletDraft pageGuide
  resume/     resume parse builder docxEdit docs ats trim
  jobs/       openings sources ranking fit future insights signals conferences
  coach/      checkin nudges pitch brief outreachAsk interviewDate keepDecided storyLines noUpgrade
  notify/     email texts gcal reminders
  *.test.ts   tests of routes and of shared/ logic
```

`npm test` runs `server/*.test.ts` and `server/*/*.test.ts`. A later step could split `routes.ts` into one router per folder.
