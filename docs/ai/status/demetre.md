# Demetre's AI

Updated: 2026-11-24 14:15 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Fix (this PR): My Path and the new pin/level moments crashed for an account with no `game` yet (a new student): `xpOf()` reads `game.weeks`, and `Office.tsx` and `Moments.tsx` passed `{}`. Both now default to `{ weeks: {} }` like Rewards and My Path. Found before the preview publish.
- Next: My Path's season card closer to the website's (orange season label, level chip with its number, All rewards, the bold reward cards, a peach XP track).
- Merged overnight: #337, #338, #341, #342, #344, #345, #346, #347.

## Files and folders I touch
- `native/` only (this PR: `src/components/Office.tsx`, `src/components/Moments.tsx`).

## Open PRs
- Crash fix for accounts with no game data (this one): owners-only.

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
