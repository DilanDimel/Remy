# Demetre's AI

Updated: 2026-11-24 20:30 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Database improvements (Deme, Nov 24; plan: https://claude.ai/artifact/2fnC7NbVyUnMBd1aPeMAk5). Egress work stopped (Dilan: the team moved on). First: nightly backups, since the free plan keeps none. `server/platform/backup.ts` copies changed accounts and files nightly and everything weekly (no caches, sessions or codes) into the private R2 bucket, sealed like the workspace cache; `npm run restore-backup` restores. About 0.2 GB a month of transfer, no big `RETURNING`, no polling. Same PR: the sweep drops `team_activity` and `usage_events` rows older than 180 days (`pruneLogs` in `server/platform/storage.ts`).
- App test fixes and the `app` release switch (dilan-1, dilan-2; owners only): "Let's fix them" opens Remy's fixes (`openResumeFix` in `native/src/lib/nav.ts`, Resume reads `fix`), the offer card shows in owner view only, the office question sends at once, My Path's "Add a real number" opens the fixes, job details hide "Not stated" deadlines and gaps the chips already show, the Keep toast says "Kept. See kept", Jobs' title is Opportunities, the Tailor picker shows 3 lines and the place. `appOpenFor` reads `features.app` (owners always in), with a rules test. Finding 10 is web preview only and not changed.
- Shared AI system v2 adopted (Nov 24): every session starts with `npm run ai:brief -- --me Demetre`, requests are answered below, claims before touching files outside `native/`.
- Preview: f922a22a (main with #337–#347, #371, #372) and f9caa545 (#373), 2026-11-24. Merged since, not yet published: #374 (iPhone chat keyboard).

## Claims
- `server/platform/backup.ts`, `server/platform/backup.test.ts`, `script/restore-backup.ts` · branch claude/project-thread-87dr74-backup · until 2026-11-27

## Requests
- (none open; demetre-1, the competitions review, is done: #382 merged)

## Answers
- dilan-1 · done · #390 · findings 1 to 9 fixed; 10 (web preview only) left as is
- dilan-2 · done · #390 · `appOpenFor` reads `features.app`, rules test for both states
- dilan-3 · seen · Scholar fox icon, adaptive foreground and splash go in the next store build (icons need a new build, not an Expo update)

## Files and folders I touch
- `native/`, plus (database work, outside my area) the files claimed above, `r2Store` added at the end of `server/platform/r2.ts` (the lead's R2 helper; existing functions unchanged, `call` takes an optional timeout), two lines in `server/routes.ts` (the sweep and `/api/admin/storage`), a `restore-backup` script in `package.json`, and `docs/database-plan.md`.

## Open PRs
- #391 nightly database backups to R2, plus log cleanup: owners-only server job, nothing students see. Deme OK'd; merges when checks pass.
- #390 App test fixes and the `app` release switch: merged; one preview publish waits on Deme's OK.

## Next
- Preview publish of the app PR, then the icon (dilan-3), in-app resume upload and feedback screenshots in the next store build.

## Questions for the lead
- Next database items wait for your call (see the plan link above): gzip on API answers (every request), and splitting saved openings out of the workspace blob into a `student_jobs` table. OK to start either?
