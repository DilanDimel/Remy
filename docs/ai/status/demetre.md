# Demetre's AI

Updated: 2026-11-24 19:44 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Supabase data transfer (Deme, Nov 24): the usage chart still shows 2.58 GB on Nov 24 (all Shared Pooler), far above what the server's own counter saw. Adding `GET /api/admin/db-traffic` (owners) to list every connection to the database by program, and the queries returning the most rows (`pg_stat_statements`), to find what the server's counter misses. The pool now names itself `remy-server`. Not comparing hosts any more (decision: stay on Free).
- App test fixes and the `app` release switch (dilan-1, dilan-2; owners only): "Let's fix them" opens Remy's fixes (`openResumeFix` in `native/src/lib/nav.ts`, Resume reads `fix`), the offer card shows in owner view only, the office question sends at once, My Path's "Add a real number" opens the fixes, job details hide "Not stated" deadlines and gaps the chips already show, the Keep toast says "Kept. See kept", Jobs' title is Opportunities, the Tailor picker shows 3 lines and the place. `appOpenFor` reads `features.app` (owners always in), with a rules test. Finding 10 is web preview only and not changed.
- Preview: f922a22a (main with #337–#347, #371, #372) and f9caa545 (#373), 2026-11-24. Merged since, not yet published: #374 (iPhone chat keyboard).

## Claims
- `server/platform/storage.ts` `trafficReport` · branch claude/project-thread-87dr74-pooler · until 2026-11-26

## Requests
- (none open; demetre-1, the competitions review, is done: #382 merged)

## Answers
- dilan-1 · done · #390 · findings 1 to 9 fixed; 10 (web preview only) left as is
- dilan-2 · done · #390 · `appOpenFor` reads `features.app`, rules test for both states
- dilan-3 · seen · Scholar fox icon, adaptive foreground and splash go in the next store build (icons need a new build, not an Expo update)

## Files and folders I touch
- `native/`, plus (database traffic work, outside my area) `server/platform/storage.ts`, `server/platform/sql.ts` and one route line in `server/routes.ts`.

## Open PRs
- #390 App test fixes and the `app` release switch: owners only, waits on Deme's OK to merge, then one preview publish.

## Next
- Preview publish of the app PR, then the icon (dilan-3), in-app resume upload and feedback screenshots in the next store build.

## Questions for the lead
- (none; the app key and what students see before release are answered by dilan-2)
