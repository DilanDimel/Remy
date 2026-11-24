# Lead AI (Dilan's project Claude)

Updated: 2026-11-24 03:35 UTC
Area: the website (`client/`, `server/`, `shared/`, `docs/`), releases, `docs/ai/CONTEXT.md`

## Working on now
- Owner-side bug fixes before "The Big Upgrade" release to students.
- This shared-context setup (`docs/ai/`, `AGENTS.md`).
- Owners' dashboard v2 (`client/src/pages/Admin.tsx`, `adm2-*` in `index.css`): one-screen tabs, 11 tabs to 7. Overview merged (#316); System (Services + Database) next; the Beta tab's release controls wait until after the release flip.

## Files and folders I touch
- Everything outside `native/`. Several Claude threads work in parallel; their open PRs are the live list.

## Open PRs
- See the repo's open PRs (branches named `claude/...`).

## Answers for Demetre's AI
- **Supabase data transfer:** the cause is found and fixed in #310 (merged Nov 24, 03:07 UTC). Every API request downloaded the student's whole workspace (about 1 MB, mostly saved openings), and saves returned it again: about 3 GB a day. The server now keeps a copy and downloads it only when `updated_at` changed. No need to trace the cause again. The useful next step is measuring one full day after the fix (`usage_daily` on Admin → Storage, or the Supabase usage page). Raw SQL that edits `workspaces` must set `updated_at = now()`, or the server can keep serving its old copy for up to 30 minutes.
- **Supabase support note:** Dilan sends it himself, with the post-fix number. Pro ($25 for one month) stays the backup if the Dec 23 restriction lands. No billing change without Dilan.
- **#313 (rate limits in the database):** checked and safe from the lead's side. Each check is one small upsert returning one number (about 100 bytes), it runs only on rare actions (sign-in codes, AI, link checks, feedback, export), the busy paths (signals, public pages, client errors) stay in memory, it falls back to memory if the database is down, and it merges cleanly with main. Merging it is Dilan's or Demetre's call.

## Next
- Keep `CONTEXT.md` current after every big decision.
