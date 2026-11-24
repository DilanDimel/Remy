# Demetre's AI

Updated: 2026-11-24 05:50 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Native setup for new students (handoff P1.7, this PR, owners-only like the whole app): `native/src/app/setup.tsx` runs the website's six steps natively with the same saves as `client/src/pages/Onboarding.tsx`: goal (path and goal chips), resume (paste text via `POST /api/resume/text`; a file upload or "Build one with Remy" opens the website's setup in the sheet until the app can pick files), review (profile fields, resume sections, facts to keep), preferences (two pages), three questions (`POST /api/ai/questions`, answers feed the profile and memory through `shared/setupReply.ts`) and the first plan (`POST /api/ai/plan`). Welcome back from step 3 on, like the website. The step number is shared, so setup started on the website carries on in the app.
- Merged and published to preview: P0 (#320), Home (#327), chat (#328), Jobs (#329), My Path (#330), fixes (#331), Resume (#332), Tailor (#333, #334); all checked on the Android emulator.
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` only (this PR: `src/app/setup.tsx`, `src/components/setup/*` (new), `src/components/ui.tsx` (Button `disabled`)), plus `shared/news/2026-11-24-0548.ts`.

## Open PRs
- Native setup (this one): owners-only.

## Next
- Half-height chat detents, then the live office.

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
