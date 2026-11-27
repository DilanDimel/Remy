# Remy

**An AI career coach for college students.** Remy is a fox who helps students go from "I don't know what I want to do" to an offer: he figures out where they stand, shows them the road ahead in their field, finds real openings, and gets their resume, cover letters and interviews ready, without ever inventing a single thing about them.

Built by RemyAI LLC. Live at [remyai.org](https://remyai.org), Free during beta.

## Why it exists

Career centers are stretched thin, and most job tools either spam students with listings or write fake-sounding resumes for them. Remy is built around two ideas:

- **Show up every day, a little at a time.** A short daily round, a streak that forgives a missed day, and a clear picture of what freshman through senior year should look like in your field.
- **Honest by design.** Every AI suggestion is checked against the student's own resume and words. Remy never makes up a skill, number or title, never asks for passwords, and never sends anything on a student's behalf.

## What Remy does

**Home.** A personal start page: what to do today, deadlines coming up, openings worth a look, and Remy's read on how things are going.

**My Path.** A road map of the student's field: the roles, skills, exams and certifications that matter, the 10-year job outlook (BLS and O\*NET data), internship season timing, and a four-year board by semester. A daily round of a few real cards keeps it moving, and the weekly career quest adds bigger missions, levels and a streak.

**Resume.** Reads a PDF or Word resume (or LinkedIn's Save-to-PDF) into a profile the student confirms. First-years with no resume can build one by tapping through a guided builder. An ATS check scores the resume the way hiring software reads it, and a review explains what to fix.

**Opportunities.** Live student roles pulled straight from over 90,000 employers' own career sites (Workday, Greenhouse, Lever and others), plus federal roles from USAJOBS and the Labor Department's job search. Each opening says whether the student qualifies and why, and they can import any posting by link.

**Tailoring and cover letters.** Remy suggests changes for a specific posting, shown as the original line next to the proposed one, with the posting quote that motivated it. The student accepts, edits or rejects each change. Downloads keep their Word file's fonts and layout.

**Interview.** Practice questions built from the actual posting, with the resume line to answer each one. Practice out loud, build a story deck from past experiences, and polish a short pitch.

**Remy, the coach.** Remy lives in a side panel on every page. Students can chat with him about anything career-related, and he can take actions like adding a to-do or saving an opening. The Activity tab shows what he has done and lets them undo it.

**Community, Calendar and Progress.** Contacts the student adds themselves (an alumni directory is planned, not live), Google Calendar deadlines and interviews, a LinkedIn coach, a weekly check-in that turns what they did into resume lines, and an application tracker.

**Emails and texts.** Reminders, a weekly digest and sign-in codes by email, and optional text reminders.

**Owners' dashboard.** For the team: sign-up funnel and outcomes, errors and feedback, the beta list, feature releases, server health and deploys, storage use, and team hours.

## How it's built

```
 Desktop website · phone website · iPhone and Android app (native/)
                         |
        React + Vite front end (client/)   Expo app (native/)
                         |   /api/...  (same server for both)
        Express server (server/)  ----  AI: Claude and Gemini through OpenRouter, zero data retention
                         |         ----  employer career sites, USAJOBS, CareerOneStop, BLS, O*NET
        PostgreSQL (DigitalOcean)  ----  Google sign-in, email codes (Resend), Google Calendar, Cloudflare R2
```

- **One TypeScript codebase.** `client/` is the React website (desktop and phone), `server/` is the Express API, `shared/` holds the types and logic both sides use, and `native/` is the Expo (React Native) phone app that talks to the same API.
- **AI with guardrails.** Every model call goes through one place (`server/ai/ai.ts`) that tries providers in order, enforces daily budgets and uses zero-data-retention providers only. Every rewrite then passes a rules-based claim checker (`server/ai/claims.ts`) before the student sees it.
- **Sign-in.** Remy's own Google sign-in and 6-digit email codes, with a secure session cookie. No outside auth service.
- **Data.** Each student's workspace lives in PostgreSQL (DigitalOcean Managed Postgres), with an encrypted cache in Cloudflare R2 and nightly backups. Public job postings are kept in a shared table with no student data.
- **Hosting.** DigitalOcean App Platform builds and deploys every merge to `main`, with health checks and automatic rollback. Cloudflare sits in front of remyai.org and runs the hourly background tick.
- **Checks.** GitHub Actions runs the type check, the client/server contract check, 700+ server tests and the AI teamwork rules on every pull request.

### Languages

Counted by lines of code in the repo (Nov 27, 2026, about 75,000 lines, not counting docs or generated files):

| Language | Share | Where |
|---|---|---|
| TypeScript | 54% | server, shared logic, scripts, tests |
| TypeScript + React (TSX) | 39% | website pages and components, the native app's screens |
| CSS (Tailwind + tokens) | 6% | `client/src/index.css` and component styles |
| SQL | 0.5% | `server/migrations/` |
| Other | under 1% | GitHub Actions YAML, Gradle/Java and Swift for the app shells, one Apps Script file |

Main frameworks: React 18, Vite 7, Tailwind 3, Radix UI, Express 5 on Node, Expo 58 with expo-router and React Native 0.88 (React 19) for the app, PGlite for local and test databases, `node:test` through `tsx`.

## Run it

Needs Node 20 or newer.

```bash
npm ci
npm run dev                                         # website + API on http://localhost:5000
npm run check && npm run check:contract && npm test # what CI runs
```

With no settings the app still runs on an in-memory database, and AI features say "needs setup". The phone app runs from `native/` (`cd native && npm ci && npx expo start`). Full setup, tests, deploy and configuration are in [`docs/development.md`](docs/development.md).

## Where things are

| Folder | What's in it |
|---|---|
| `client/` | The website: pages, components, the store that talks to the API |
| `server/` | The API, grouped by area: `platform/` `ai/` `resume/` `jobs/` `coach/` `notify/`, plus `migrations/` |
| `shared/` | Types and pure logic used by the website, the server and the app; `shared/news/` is the What's new list |
| `native/` | The Expo phone app (owners preview for now) |
| `ios/` `android/` `mobile/` | The older Capacitor app shells around the live site |
| `script/` | Build, contract, resume, persistence and AI-teamwork checks |
| `docs/` | Development, architecture, the [code map](docs/CODEMAP.md), app notes, and `docs/ai/` |
| `docs/ai/` | Shared context for every AI that works on Remy: current status, decisions, each person's status file |

Every folder, module, route and table is described in [`docs/CODEMAP.md`](docs/CODEMAP.md). How a request flows is in [`docs/architecture.md`](docs/architecture.md). Rules for changes are in [`CLAUDE.md`](CLAUDE.md) (also read by other AI tools through `AGENTS.md`).

## Copyright and license

Copyright © 2026 RemyAI LLC. All rights reserved.

This code is proprietary. It is public on GitHub so people can see it, not so they can use it. No permission is given to copy, use, run, modify or distribute any part of it without written permission from RemyAI LLC. See [`LICENSE`](LICENSE) for the full terms. Infringement will be pursued, including through DMCA takedowns and legal action. For licensing questions, write to hello@remyai.org.
