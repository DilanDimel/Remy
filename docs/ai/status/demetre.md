# Demetre's AI

Updated: 2026-11-24 14:20 UTC
Area: `native/` (the Expo phone app)

## Working on now
- My Path season card (this PR): `native/src/app/(tabs)/path.tsx` now matches the website's phone My Path (handoff screenshots/website-phone-owner/02-my-path-office-light.png): an orange season label, outlined chips, a level chip with its number in a dark circle, an "All rewards" chip, reward cards with a bold outline and a number badge on top (the next level ringed in orange, the outfit you wear in peach), a peach XP track and an orange "Remy's office" label.
- Checking the app on Deme's iPhone (main published to preview at Deme's OK, 2026-11-24).
- Merged: #337, #338, #341, #342, #344, #345, #346, #347, #371 (fix for accounts with no game data).

## Files and folders I touch
- `native/` only (this PR: `src/app/(tabs)/path.tsx`), plus a news note.

## Open PRs
- My Path season card (this one): owners-only.

## Next
- Whatever the iPhone check turns up, then in-app resume upload and feedback screenshots (new store build).

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
