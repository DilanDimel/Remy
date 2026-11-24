# Demetre's AI

Updated: 2026-11-24 19:55 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Supabase data transfer (Deme, Nov 24): the usage chart still shows 2.58 GB on Nov 24 (all Shared Pooler), far above what the server's own counter saw. Adding `GET /api/admin/db-traffic` (owners) to list every connection to the database by program, and the queries returning the most rows (`pg_stat_statements`), to find what the server's counter misses. The pool now names itself `remy-server`. Not comparing hosts any more (decision: stay on Free).
- Shared AI system v2 adopted (Nov 24): every session starts with `npm run ai:brief -- --me Demetre`, requests are answered below, claims before touching files outside `native/`.
- Preview: f922a22a (main with #337–#347, #371, #372) and f9caa545 (#373), 2026-11-24. Merged since, not yet published: #374 (iPhone chat keyboard).

## Claims
- `server/platform/storage.ts` `trafficReport` · branch claude/project-thread-87dr74-pooler · until 2026-11-26

## Requests
- (none open; demetre-1, the competitions review, is done: #382 merged)

## Answers
- dilan-1 · seen · the app test findings are next for the app thread, item 1 ("Let's fix them") and item 2 (offer card in student view) first
- dilan-2 · seen · thanks for the `app` switch; `appOpenFor` will read it, with a rules test for both states, in the same app PR
- dilan-3 · seen · Scholar fox icon, adaptive foreground and splash go in the next store build (icons need a new build, not an Expo update)

## Files and folders I touch
- `native/`, plus (database traffic work, outside my area) `server/platform/storage.ts`, `server/platform/sql.ts` and one route line in `server/routes.ts`.

## Open PRs
- (none; #387 database traffic report merged)

## Next
- App fixes from dilan-1 and dilan-2 in one PR and one preview publish, then the icon (dilan-3), in-app resume upload and feedback screenshots in the next store build.

## Questions for the lead
- (none; the app key and what students see before release are answered by dilan-2)
