# Remy

A functional, private-preview student career demo for the Neeley AI Forward job search case. Its motto: "Don't Hunt for a Job Alone." The brand is black, orange and white, with Remy the fox as the guide.

Live at https://offer-ready.onrender.com (Render deploys `main`; see `render.yaml`).

## Run

- `npm ci`
- `npm run dev` starts Express and Vite on port 5000.
- `npm run check` runs TypeScript checks; `npm run check:contract` checks every client API call hits a real server route.
- `npm test` runs the claim-checker and eligibility tests (`server/*.test.ts`). GitHub Actions runs all three on every push and pull request.
- `npm run build` builds `dist/public` and the Node server; `NODE_ENV=production node dist/index.cjs` runs it.
- `npm run check:persist` restarts a production build on a throwaway database and confirms a session keeps its workspace.
- `npx tsx script/coverage.ts` rebuilds the 155-node coverage inventory.
- `npm run check:resume` checks resume reading (PDF/Word/text extraction, the rules reader, the checks on AI output and profile prefill) against synthetic fixtures. No server, database or AI key needed.

Sign-in: a guest workspace (secure cookie), or Google / LinkedIn / email link through Supabase Auth (the server verifies the Supabase token, then keeps its own session). TCU alumni matches are only shown to students signed in with a school email.

## Configuration (environment variables)

| Variable | What it does |
|---|---|
| `OR_AI_CHAIN` | AI providers to try in order, e.g. `openrouter:google/gemini-3.8-flash,openrouter:openai/gpt-5-mini,gemini:gemini-3.8-flash`. Keys come from `OPENROUTER_API_KEY` / `GEMINI_API_KEY` (Render secrets, never committed). With no provider, AI features say "needs setup" and everything else works. |
| `OR_AI_TAILOR_CHAIN` | Optional: a different (stronger) chain for resume tailoring only. Unset = use `OR_AI_CHAIN`. |
| `OR_AI_DAILY_BUDGET` | AI requests allowed per 24 hours for the whole site (default 1500). Guests also get 40/day each, signed-in students 120/day, and each network 60/hour. |
| `OR_ALUMNI_EMAIL_DOMAINS` | Email domains that may see TCU alumni matches (default `tcu.edu`). |
| `OR_DB_PATH` | SQLite file (Render: `/data/data.db` on the persistent disk). |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase Auth project (the publishable key is public by design). |
| `GOOGLE_CLIENT_ID` | Optional Google Identity button (Google sign-in also works through Supabase without it). |

Rate limits that protect the shared AI budget (guest creation, AI per network, link fetching) are kept in memory: they reset on restart and assume one server process.

## Implemented experience

- Editable synthetic Finance and Marketing profiles, plain-text resume import, confirmed experience and personal preferences.
- Demo connection choices; optional live contextual onboarding questions; notification category opt-outs.
- Semester tasks, role exploration, learning examples, campus activities and optional experiments.
- Explained opportunity ranking, known conflicts versus unknown eligibility, saved roles, dated public snapshots and manual public URL/text import.
- Three initial application pairs, live tailoring, original-versus-proposed statements, requirement evidence, human flags, corrections, review, plain-text and DOCX export, status and version history.
- Tentative advising plans, sample class-conflict checks, Central-time ICS download, manual notes, live summaries and approved tasks.
- Contextual live AI guide, workspace data export, activity log and full scope documentation.

## Honest boundaries

No real TCU, Stellic, Outlook, LinkedIn, Handshake or GitHub account is connected. No job application, message, email, appointment or invitation is sent. All academic and campus examples are illustrative, not an official degree audit or verified activity directory. Public job snapshots were researched on October 17, 2026; the demo is not a live or exhaustive feed.

Application checks are conservative rules plus mandatory student review, not a guarantee of truth. A real test draft introduced an unsupported reporting detail; the UI allows it to be flagged, logged and corrected. Constructed tests are separately labeled and must not be presented as actual AI errors.

Workspace edits are stored in SQLite, one row per account. This is not university SSO, a FERPA-reviewed service or production storage; see `docs/database-plan.md` before opening Remy to more students. "Delete everything" removes the workspace, files, AI usage, sessions and account record; guest accounts idle for 30 days are removed automatically.

## Scope preservation

`docs/idea-inventory.json` retains all 155 original mind-map nodes. `docs/mindmap-coverage.csv` maps every node to a screen and an honest working, partial, simulated, context or parked status. `docs/product-brief.md` preserves the full specification; both the brief and coverage CSV can be downloaded from the app’s product-scope screen.

The application does not replace the competition pitch deck, final source re-verification, team validation or judging submission.

## Verification and production follow-up

See `docs/qa.md` and `docs/regression-results.json`. A dependency audit still reports issues in the inherited Tailwind/build-tool dependency tree with no non-breaking fix; do not represent this demo as production-hardened. Before production, resolve the tooling dependencies, establish institutional permissions, add authentication and monitoring, validate accessibility comprehensively and migrate to durable storage.
