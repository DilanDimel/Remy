# Remy

Remy is an AI career coach for college students. It reads your resume into a profile, finds real openings from employers' own career sites, checks your resume the way hiring software does, tailors resumes and cover letters without inventing anything, and keeps track of every application. Remy the fox is the guide; the brand is black, orange and white.

Render deploys `main` (see `render.yaml`). The iPhone and Android apps (`ios/`, `android/`) wrap the live site; see `docs/mobile-app.md`.

## Run

- `npm ci`
- `npm run dev` starts Express and Vite on port 5000.
- `npm run check` runs TypeScript checks; `npm run check:contract` checks every client API call hits a real server route.
- `npm test` runs the claim-checker and eligibility tests (`server/*.test.ts`). GitHub Actions runs all three on every push and pull request.
- `npm run build` builds `dist/public` and the Node server; `NODE_ENV=production node dist/index.cjs` runs it.
- `npm run check:persist` restarts a production build on a throwaway database and confirms a session keeps its workspace.
- `npx tsx script/coverage.ts` rebuilds the 155-node coverage inventory.
- `npm run check:resume` checks resume reading (PDF/Word/text extraction, the rules reader, the checks on AI output and profile prefill) against synthetic fixtures. No server, database or AI key needed.

Sign-in: a guest workspace (secure cookie), or Google / LinkedIn / email link through Supabase Auth (the server verifies the Supabase token, then keeps its own session). Alumni matches are only shown to students who verify a school email.

## Configuration (environment variables)

| Variable | What it does |
|---|---|
| `OR_AI_CHAIN` | AI providers to try in order, e.g. `openrouter:google/gemini-3.8-flash,openrouter:openai/gpt-5-mini,gemini:gemini-3.8-flash`. Keys come from `OPENROUTER_API_KEY` / `GEMINI_API_KEY` (Render secrets, never committed). With no provider, AI features say "needs setup" and everything else works. |
| `OR_AI_TAILOR_CHAIN` | Optional: a different (stronger) chain for resume tailoring only. Unset = use `OR_AI_CHAIN`. |
| `OR_AI_DAILY_BUDGET` | AI requests allowed per 24 hours for the whole site (default 1500). Guests also get 40/day each, signed-in students 120/day, and each network 60/hour. |
| `OR_ALUMNI_EMAIL_DOMAINS` | Email domains that may see TCU alumni matches (default `tcu.edu`). |
| `SMTP_URL` | Sender for school-email verification codes, e.g. `smtps://remy.account%40gmail.com:<app-password>@smtp.gmail.com:465`. Unset: verification shows "coming soon" (local dev prints codes to the server log). `MAIL_FROM` optionally overrides the From line. |
| `DATABASE_URL` | Postgres connection string (Supabase today). `DB_SCHEMA` picks the schema (default `remy`); `DB_SSL_CA_FILE` the certificate. Unset: PGlite (Postgres inside Node) in the `OR_DB_PATH` folder, or in memory for tests. |
| `USAJOBS_KEY`, `USAJOBS_EMAIL` | Free USAJOBS API key for federal student and recent-graduate roles. Unset: federal roles are skipped. |
| `COS_USER_ID`, `COS_TOKEN` | Free CareerOneStop (U.S. Department of Labor) key: city, county, state and other jobs from the National Labor Exchange. Unset: skipped. |
| `GCAL_CLIENT_ID`, `GCAL_CLIENT_SECRET` | Google Calendar connection (adds deadlines and interviews to a calendar Remy creates). Unset: shows "coming soon". |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase Auth project (the publishable key is public by design). |
| `GOOGLE_CLIENT_ID` | Optional Google Identity button (Google sign-in also works through Supabase without it). |

Rate limits that protect the shared AI budget (guest creation, AI per network, link fetching) are kept in memory: they reset on restart and assume one server process.

## What Remy does

- **Profile from your resume:** reads a PDF or Word resume (or LinkedIn's Save-to-PDF) into a profile you confirm; first-year students can build one by tapping through a guided builder instead.
- **Openings:** reads live student roles from about 180 employers' own career sites (Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Oracle, Eightfold, Phenom, and school districts on Frontline AppliTrack, Taleo and SchoolSpring) plus federal roles from USAJOBS and, with a key, the Labor Department's CareerOneStop job search, and says whether you qualify and why.
- **Resume check:** an ATS-readiness score based on how hiring software reads resumes, with the keywords for each posting.
- **Tailoring and cover letters:** suggested changes you approve one by one; every claim must come from your own resume, and downloads keep your Word file's fonts and layout.
- **Path, community and progress:** semester plan, alumni matches for verified school emails, Google Calendar deadlines and an application tracker.

## Honest boundaries

Remy never asks for passwords and never sends an application, email or message for you. Handshake, Stellic and similar school systems aren't connected: you upload or paste from them. Tailoring checks are rules plus your own review, not a guarantee. Job sites such as GovernmentJobs (NEOGOV) and Handshake don't allow automated reading, so their postings only appear when you import them.

Deleting your account removes your workspace, files, AI usage, sessions and sign-in. Guest workspaces idle for 30 days are removed automatically. See `docs/database-plan.md` for how data is stored.

## Checks

`npm run check`, `npm run check:contract` and `npm test` run on every push (GitHub Actions). Design notes live in `docs/superpowers/specs/`.
