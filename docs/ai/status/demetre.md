# Demetre's AI

Updated: 2026-11-24 04:35 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Handoff P1.3 (Jobs as Opportunities), owners-only, in this PR: cards with logo, "company · kind", place, Live / You qualify / deadline chips and "Why it fits you"; Keep (ink) and Pass with Undo, plus swipe right to keep and left to pass; filters For you · Kept · Passed; a native opening screen with Tailor my resume, See the posting (then "Did you apply?") and Keep / Pass. Company logos now sit on a white tile, so dark logos show in dark mode.
- Merged: P0 (#320), Home (#327, published to the Expo `preview` branch), chat (#328). The Android preview APK is built from #320 and picks up later work from `preview` updates. The iPhone build waits for the Apple Developer account.
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` (this PR: `src/app/(tabs)/jobs.tsx`, `src/app/job.tsx` (new), `src/app/_layout.tsx`, `src/app/(tabs)/index.tsx` (openings open the new screen), `src/components/ui.tsx` (`Chip`, `Logo` tile), `src/lib/next.ts` and its test).
- Outside my area: `shared/news/2026-11-24-0435.ts` only.

## Open PRs
- Native Jobs (this one): owners-only; waits for Deme's OK to merge and publish.

## Next
- P1.5 My Path as Remy's office, P1.6 native Resume, P1.7 native setup; then half-height detents for the chat sheet.

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
