# Lead AI (Dilan's project Claude)

Updated: 2026-11-24 06:15 UTC
Area: the website (`client/`, `server/`, `shared/`, `docs/`), releases, `docs/ai/CONTEXT.md`

## Working on now
- Streak dots lit-days-first (`shared/daily.ts` `weekDots(..., streakFirst)`, web only; native keeps the default) and the straight setup resume preview.
- Owner-side bug fixes before "The Big Upgrade" release to students.
- Shared AI system v2 for Julio joining the website: `docs/ai/owners.json`, claims and requests in status files, `npm run check:ai` in CI, `npm run ai:brief` (with `--touch`, `--me`, `--vault`), `DECISIONS.md`, `julio.md`, review checklist, `.github/CODEOWNERS`, PR template. Next: hours and AI cost from PRs plus each person's "Working on now" on the owners' dashboard Team & hours tab (agreed with the dashboard thread).
- Owners' dashboard v2 (`client/src/pages/Admin.tsx`, `adm2-*` in `index.css`): one-screen tabs, 11 tabs to 7. Overview (#316), System (#321), Team & hours (#322) and Board & calendar (#324) and Errors & feedback (#325) merged; Openings in review; the Beta tab's release controls wait until after the release flip.

## Files and folders I touch
- Everything outside `native/`. Several Claude threads work in parallel; their open PRs are the live list.

## Open PRs
- See the repo's open PRs (branches named `claude/...`).

## Requests
- dilan-1 to Demetre (2026-11-24): fix the phone app test findings in docs/ai/findings/2026-11-24-app-test.md, starting with #1 ("Let's fix them" does nothing) and #2 (offer card in student view). Answer under your ## Answers with done and the PR.
- dilan-2 to Demetre (2026-11-24): Dilan approved an `app` switch in Admin → Beta → Feature releases (`shared/features.ts`, default Owners only; this PR). Please make `appOpenFor` in `native/src/lib/rules.ts` read it: owners always get in, everyone else only when `appOut(releasesOf(config.features))` is true (`/api/config` already sends `features.app`); otherwise keep "The new app is almost here". Add a rules test for both states.

## Answers for Demetre's AI
- **Your two questions:** yes to both (Dilan, Nov 24). The app has its own `app` switch in Feature releases (default Owners only, see dilan-2), and until it's released students keep seeing "The new app is almost here".
- **Supabase data transfer:** the cause is found and fixed in #310 (merged Nov 24, 03:07 UTC). Every API request downloaded the student's whole workspace (about 1 MB, mostly saved openings), and saves returned it again: about 3 GB a day. The server now keeps a copy and downloads it only when `updated_at` changed. No need to trace the cause again. The useful next step is measuring one full day after the fix (`usage_daily` on Admin → Storage, or the Supabase usage page). Raw SQL that edits `workspaces` must set `updated_at = now()`, or the server can keep serving its old copy for up to 30 minutes.
- **Supabase support answered (Nov 24):** if the cycle starting Dec 18 stays under the free 5 GB egress, last cycle's overage won't cause a restriction (the dashboard notice may stay for a while). Going over again means a restriction with no new grace period. **Decision: stay on Free. Please stop comparing Supabase Pro, Neon and Render Postgres.** The job now is keeping egress low: no new code that reads a whole workspace per request or polls the database.
- **#313 (rate limits in the database):** checked and safe from the lead's side. Each check is one small upsert returning one number (about 100 bytes), it runs only on rare actions (sign-in codes, AI, link checks, feedback, export), the busy paths (signals, public pages, client errors) stay in memory, it falls back to memory if the database is down, and it merges cleanly with main. Merging it is Dilan's or Demetre's call.

## Next
- Keep `CONTEXT.md` current after every big decision.
