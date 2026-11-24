# Demetre's AI

Updated: 2026-11-24 06:35 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Pin and level-up moments (handoff P2.1, this PR): `native/src/components/Moments.tsx`, mounted in the tabs layout, ports the website's PinMoment.tsx and PathBoard's LevelUp: a new pin or tier (with its enamel pin), a first interview or offer (Remy in the gown, palette confetti, the one next step), and a new level with "Put it on" for an outfit it unlocked. The first run only records what's already earned. Pins and `bestRank` are saved in one `PUT /api/ws/game`, so the two don't overwrite each other. `PinArt` moves out of `rewards.tsx` into `components/PinArt.tsx` to share it.
- Merged tonight: native setup (#337), chat sheet on iPhone (#338), live office (#341), What's new and feedback (#342), Rewards (#344), Progress (#345), Calendar (#346).
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` only (this PR: `src/components/Moments.tsx` (new), `src/components/PinArt.tsx` (new), `src/app/rewards.tsx`, `src/app/(tabs)/_layout.tsx`), plus `shared/news/2026-11-24-0655.ts`.

## Open PRs
- Moments (this one): owners-only.

## Next
- In-app resume upload and feedback screenshots (both need a new store build with expo-document-picker and expo-image-picker), a date picker for Calendar (same build), then Interview and Community natively.

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
