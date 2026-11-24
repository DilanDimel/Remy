# Demetre's AI

Updated: 2026-11-24 05:40 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Fix after the Android check of #333 (this PR): the tailor screen no longer starts (and keeps) the opening just by opening it; the application is created when the student taps "Draft my changes". While openings load it says so instead of a bare spinner.
- Native tailored-resume review, owners-only, in this PR: `native/src/app/tailor.tsx` picks an opening (in progress first, then best fits), starts it (`POST /api/applications`), lets Remy draft (`POST /:id/generate`, with the eligibility-conflict choice), shows one change per screen (original, Remy's version with changed words highlighted by `wordDiff`, the posting quote and evidence, flags) with Accept / Edit / Reject (`PUT /:id/change/:cid`), then approves (`POST /:id/approve`, with the letter check's confirm) and downloads the resume and letter to the share sheet. `go()` sends `/resume?tab=tailor…` links to this screen; editing the cover letter stays on the website.
- Merged and published to preview: P0 (#320), Home (#327), chat (#328), Jobs (#329), My Path (#330), fixes (#331), Resume (#332); all checked on the Android emulator.
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` only (this PR: `src/app/tailor.tsx` (new), `src/app/_layout.tsx`, `src/lib/nav.ts`, `src/app/(tabs)/resume.tsx`), plus `shared/news/2026-11-24-0530.ts`.

## Open PRs
- Tailoring fix (this one): owners-only.

## Next
- P1.7 native setup (only new students see it; the app is owners-only), the live office, half-height chat detents.

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
