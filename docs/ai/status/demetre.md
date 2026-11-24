# Demetre's AI

Updated: 2026-11-24 06:00 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Remy's chat as a half-height sheet on iPhone (handoff P1.2 detents, this PR): `native/src/app/_layout.tsx` presents `remy` as a `formSheet` with detents 0.6 and 1 and a grabber on iOS. Android keeps the full-screen page, because its form sheets don't keep a text field above the keyboard reliably. Not tested on an iPhone yet (no iOS device or simulator in this setup).
- Next PR, ready locally: Remy's office drawn from the student's progress (books, pins, framed resume, level items, chest finds, outfit, clock) instead of the static picture.
- Merged: P0 (#320), Home (#327), chat (#328), Jobs (#329), My Path (#330), fixes (#331), Resume (#332), Tailor (#333, #334), native setup (#337).
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` only (this PR: `src/app/_layout.tsx`, `src/app/remy.tsx`), plus `shared/news/2026-11-24-0600.ts`.

## Open PRs
- Chat sheet on iPhone (this one): owners-only.

## Next
- The live office (next PR), then the website's tailoring brief and in-app resume upload (needs a new store build).

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
