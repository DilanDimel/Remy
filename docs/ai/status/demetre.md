# Demetre's AI

Updated: 2026-11-24 03:20 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Testing the phone app on the Android emulator and the iPhone, then fixing what that finds. These fixes are owners-only.
- Fixing two retest failures from the Nov 24 preview update:
  - A Path row in the app opens My Path on Roles instead of Skills, because the daily walk-through starts and switches the tab.
  - The RTX "Accounting Intern (Spring/Summer)" posting shows twice, with Springdale written two ways.

## Files and folders I touch
- `native/`
- Outside my area, kept small:
  - `client/src/components/PathBoard.tsx`: the walk-through doesn't auto-start when the link has `?side=`.
  - `server/jobs/dedupe.ts` and `server/jobs/dedupe.test.ts`: duplicate postings now match by town.
  - `shared/news/2026-11-24-0311.ts`
- Earlier, merged in #307: `native/src/app/(tabs)/*`, `native/src/app/web.tsx`, `client/src/components/DailyPath.tsx`, `PathBoard.tsx`, `MockInterview.tsx`, `ResumeOnePage.tsx`, `client/src/index.css`, `client/src/lib/store.tsx`, and `/api/jobs` in `server/routes.ts`.

## Open PRs
- The Path-tab and duplicate-posting fix (this PR): waits for Deme's OK to merge and publish to the Expo preview.
- #313 (database rate limits, another of Deme's threads): its own status file is `deme-database.md`.

## Next
- After merging, publish an Expo update to the preview branch with Deme's OK, then retest on the emulator.

## Questions for the lead
- Each of Deme's threads keeps its own status file (`deme-database.md` for the database work, this one for the phone app). Is that fine, or should they all go in one `demetre.md`?
