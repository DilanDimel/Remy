# Demetre's AI

Updated: 2026-11-24 06:20 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Progress, native (handoff P2.4, this PR): `native/src/app/progress.tsx` is a sheet with Applications (Remy's line from the real counts, lanes Saved / Applied / Heard back / Interview / Offer / Closed, kept openings under Saved, a dot when one has gone 7 days quiet; tap one to change its status, which adds a "Manual correction" event as on the website, see its timeline with email evidence, keep notes, open its materials or stop tracking; track one by hand) and To-dos (count tiles, add, tick, delete, show completed). Email updates and Hours open the website's tabs. `go("/progress")` and `?tab=todos` open it natively.
- Merged tonight: native setup (#337), chat sheet on iPhone (#338), live office (#341), What's new and feedback (#342), Rewards (#344).
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` only (this PR: `src/app/progress.tsx` (new), `src/app/_layout.tsx`, `src/lib/nav.ts`), plus `shared/news/2026-11-24-0645.ts`.

## Open PRs
- Progress (this one): owners-only.

## Next
- Calendar natively, the pin and level-up moments, then in-app resume upload and feedback screenshots (both need a new store build with expo-document-picker and expo-image-picker).

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
