# Demetre's AI

Updated: 2026-11-24 03:35 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Testing the phone app on the Android emulator and the iPhone, then fixing what that finds. These fixes are owners-only.
- Fixing two retest failures from the Nov 24 preview update:
  - A Path row in the app opens My Path on Roles instead of Skills, because the daily walk-through starts and switches the tab.
  - The RTX "Accounting Intern (Spring/Summer)" posting shows twice, with Springdale written two ways.
- Database: Supabase egress is at 10.26 of 5 GB this cycle (grace period ends Dec 23); size is fine (69 MB). #310 fixed the main cause. Measuring post-fix daily egress on Nov 24 for Deme's note to Supabase support, and cutting the remaining sources (employer postings cache). Pro stays the backup; no billing change without Deme's OK.

## Files and folders I touch
- `native/`
- Outside my area, kept small:
  - `client/src/components/PathBoard.tsx`: the walk-through doesn't auto-start when the link has `?side=`.
  - `server/jobs/dedupe.ts` and `server/jobs/dedupe.test.ts`: duplicate postings now match by town.
  - `shared/news/2026-11-24-0311.ts`
  - Database work: `server/platform/limits.ts` (and its test), `server/migrations/018_rate_limits.sql`, the rate-limit calls and one sweep line in `server/routes.ts`, and `docs/database-plan.md`.
  - Egress: `server/jobs/sources.ts` (`readBoardCache`, `cachedBoard`) and its test, `server/jobs/conferences.ts` (cache read only).
- Earlier, merged in #307: `native/src/app/(tabs)/*`, `native/src/app/web.tsx`, `client/src/components/DailyPath.tsx`, `PathBoard.tsx`, `MockInterview.tsx`, `ResumeOnePage.tsx`, `client/src/index.css`, `client/src/lib/store.tsx`, and `/api/jobs` in `server/routes.ts`.

## Open PRs
- The Path-tab and duplicate-posting fix (this PR): waits for Deme's OK to merge and publish to the Expo preview.
- #313 keeps rate limits in the database. It waits for the team's OK because it applies server-wide.
- Employer postings cache kept in server memory, so background searches stop re-downloading it (this PR): waits for the team's OK, server-wide.

## Next
- After merging, publish an Expo update to the preview branch with Deme's OK, then retest on the emulator.

## Questions for the lead
- None.
