# Demetre's AI

Updated: 2026-11-24 19:50 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Supabase data transfer (Deme, Nov 24): the usage chart still shows 2.58 GB on Nov 24 (all Shared Pooler), far above what the server's own counter saw. Adding `GET /api/admin/db-traffic` (owners) to list every connection to the database by program, and the queries returning the most rows (`pg_stat_statements`), to find what the server's counter misses. The pool now names itself `remy-server`. Not comparing hosts any more (decision: stay on Free).
- Competitions and challenges (Deme, Nov 24; owners only, its own `competitions` switch in Feature releases): Remy finds case competitions, trading challenges (like the Bloomberg Global Trading Challenge), hackathons and pitch contests for the student's field and lists them as event openings. Built like the conference finder: `server/jobs/competitions.ts`, one researcher search per field per month in `board_cache` (`competitions|<road>`), kept only when the official page shows the date and calls itself a competition. Hooked into `findOpenings` in `server/routes.ts` next to conferences. Outside `native/`: see the request to the lead below.
- Chat keyboard on iPhone (merged): in the full-height card (#373) the keyboard covered the message box. KeyboardAvoidingView measured the card as if it started at the top of the screen, so it lifted the box short by the card's top gap. `remy.tsx` now pads the bottom by the keyboard's own height on iOS (eased with the keyboard). Android is unchanged (the window resizes).
- Preview: f922a22a (main with #337–#347, #371, #372) and f9caa545 (#373), 2026-11-24.

## Claims
- `server/platform/storage.ts` `trafficReport` · branch claude/project-thread-87dr74-pooler · until 2026-11-26
- `server/jobs/competitions.ts`, `server/jobs/competitions.test.ts` · branch claude/project-thread-g2mbqo · until 2026-11-27

## Requests
- demetre-1 to Dilan (2026-11-24): please review the competitions PR (it touches `server/routes.ts` `findOpenings`, `server/jobs/sources.ts` `pruneBoardCache` and adds a `competitions` row to `shared/features.ts`). No shape or route changes: competitions are ordinary `kind: "event"` openings. The phone app's Jobs tab will show them with no native change.

## Files and folders I touch
- `native/`, plus (competitions PR, outside my area) `server/jobs/competitions*.ts`, `server/routes.ts`, `server/jobs/sources.ts`, `shared/features.ts` and a news note.

## Open PRs
- Database traffic report (`/api/admin/db-traffic`, owners only, read-only): one route line in `server/routes.ts`, `application_name` in `server/platform/sql.ts`.
- Competitions and challenges in Opportunities (this one): owners-only, waits on Dilan's look and Deme's OK to merge.

## Next
- The rest of Deme's iPhone check, then in-app resume upload and feedback screenshots (new store build).

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
