# Demetre's AI

Updated: 2026-11-24 06:15 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Rewards, native (handoff P2.1, this PR): `native/src/app/rewards.tsx` ports the website's Rewards page (client/src/pages/Rewards.tsx) as a sheet with Pins, Levels, Outfits and Streak, all read from the shared code that awards them (`shared/pins.ts`, `game.ts`, `daily.ts`, `chest.ts`). Pins get their enamel colour and bronze, silver or gold rim from the `gem*` and `metal*` tokens; tapping one shows how to earn it. Tapping an outfit you own puts it on Remy (`PUT /api/ws/game`). `go("/rewards")` opens it natively, and More's row still follows the `rewards` feature release (open, locked or hidden).
- Merged tonight: native setup (#337), chat sheet on iPhone (#338), live office (#341), What's new and feedback (#342).
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` only (this PR: `src/app/rewards.tsx` (new), `src/app/_layout.tsx`, `src/lib/nav.ts`, `src/components/ui.tsx` (Row `subLines`), `src/components/scholarSvg.ts` (outfit names), `src/app/(tabs)/path.tsx`), plus `shared/news/2026-11-24-0640.ts`.

## Open PRs
- Rewards (this one): owners-only.

## Next
- In-app resume upload and feedback screenshots (both need a new store build with expo-document-picker and expo-image-picker), the pin and level-up moments, and Progress and Calendar natively (P2.4).

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
