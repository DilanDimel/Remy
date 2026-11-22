# Architecture

## How a request flows

1. **Browser.** `client/src/main.tsx` mounts `App.tsx`, which wraps everything in `StoreProvider` (`lib/store.tsx`). The store loads `/api/config`, `/api/me` and the student's workspace, and exposes `api()`, `save()` and `download()`. Pages read state with `useStore()`; `lib/router.ts` is a small router (`go`, `useRoute`).
2. **Server.** `server/index.ts` builds the Express app, waits for the database (`sql.ts`), and calls `registerRoutes` in `routes.ts`. In development Vite runs as middleware (`vite.ts`); in production `static.ts` serves `dist/public`.
3. **Routes to features.** Each route in `routes.ts` checks the session (`auth.ts`), then calls a feature module: `resume.ts` for reading resumes, `openings.ts`/`sources.ts`/`ranking.ts`/`fit.ts` for jobs, `ai.ts` for every model call, `claims.ts` and `safety.ts` to check AI output, and so on.
4. **Storage.** `db.ts` keeps each student's workspace as one JSON document (merged per section on save) plus side tables for sessions, usage, openings and owners' data. `docs/database-plan.md` has the details.
5. **AI.** Everything goes through `ai.ts`, which tries the providers in `OR_AI_CHAIN` in order, enforces the daily budget and per-user limits, and tags owner calls so they can use `OR_AI_CHAIN_OWNERS`.

`shared/` is imported by both sides through the `@shared/*` alias: types (`types.ts`) and pure logic such as roads, seasons and the game.

## Background work

`POST /api/cron/tick` runs the background jobs (deadline reminders, the weekly digest, guest cleanup). GitHub Actions calls it hourly (`.github/workflows/tick.yml`) so it runs even while the free Render server sleeps.

## Where new things go

| Adding... | Put it in |
|---|---|
| A screen | `client/src/pages/<Name>.tsx`, wired in `App.tsx` |
| A reusable piece of UI | `client/src/components/` (primitives in `components/ui/`) |
| An API route | `server/routes.ts`, logic in a feature file, test beside it |
| A type both sides use | `shared/types.ts` |
| Pure logic both sides use | `shared/<topic>.ts` with a test in `server/` |
| A database table or column | next `server/migrations/NNN_name.sql` |
| A check script | `script/`, plus an `npm run` entry |

## Proposed folder structure (not done yet)

`server/` has about 50 feature files and 66 tests side by side in one folder, and `routes.ts` is about 2,800 lines. Grouping them by area would make it faster to find things. This is a proposal: the moves wait until the open feature PRs have merged so nothing collides, and they are purely mechanical (`git mv` plus import path updates, no logic changes).

```
server/
  index.ts  routes.ts  vite.ts  static.ts
  platform/   db.ts sql.ts storage.ts auth.ts admin.ts beta.ts services.ts ids.ts migrations/ certs/
  ai/         ai.ts agents.ts chatDo.ts claims.ts safety.ts tailorFix.ts bulletDraft.ts pageGuide.ts
  resume/     resume.ts parse.ts builder.ts docxEdit.ts docs.ts ats.ts trim.ts
  jobs/       openings.ts sources.ts ranking.ts fit.ts future.ts insights.ts signals.ts conferences.ts data/
  coach/      checkin.ts nudges.ts pitch.ts brief.ts outreachAsk.ts interviewDate.ts keepDecided.ts storyLines.ts noUpgrade.ts
  notify/     email.ts texts.ts gcal.ts reminders.ts
```

Tests move with the file they test, and `npm test` becomes `tsx --test 'server/**/*.test.ts'`. A later step could split `routes.ts` into one router file per folder. The client is already organized by pages, components and lib, so it stays as it is.
