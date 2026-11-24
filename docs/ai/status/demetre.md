# Demetre's AI

Updated: 2026-11-24 04:40 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Handoff P1.5 (My Path = Remy's office), owners-only, in this PR: the season card with the level track (tap an unlocked outfit to wear it), the office as a static day/night drawing with a tap line for every object and Remy, an ask box (opens the chat), daily quests and the chest with its moment, the big move or interview prep chain, and the plan's steps. The room as live react-native-svg (earned items, Remy's acts and walk-through) is the follow-up.
- To share logic with the website, this PR moves `client/src/components/officeLines.ts` to `shared/officeLines.ts` (no change in content) and `seasonOf` plus the daily quest counts from `PathBoard.tsx` into `shared/path.ts`. PathBoard now imports them; nothing on the website changes.
- Merged: P0 (#320), Home (#327), chat (#328), Jobs (#329). #328 and #329 are being published to the Expo `preview` branch. The iPhone build waits for the Apple Developer account.
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` (this PR: `src/app/(tabs)/path.tsx`, `src/components/Office.tsx` and `officeSvg.ts` (new), `src/components/ui.tsx` (icons)).
- Outside my area, kept small: `shared/officeLines.ts` (moved from `client/src/components/`), `shared/path.ts` (new), `client/src/components/PathBoard.tsx` (imports only), `server/officeLines.test.ts` (import path), `server/path.test.ts` (new), `shared/news/2026-11-24-0440.ts`.

## Open PRs
- Native My Path (this one): owners-only; waits for Deme's OK to merge and publish.

## Next
- P1.6 native Resume, P1.7 native setup; then the live office and half-height detents for the chat sheet.

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
