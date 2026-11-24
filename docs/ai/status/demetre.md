# Demetre's AI

Updated: 2026-11-24 14:50 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Chat on iPhone (this PR): #338's half-height iOS form sheet put the message box over the messages on Deme's iPhone (2026-11-24). Back to `presentation: "modal"` (the full-height card) on iOS too, and the header padding from before #338. A half-height sheet can come back once it's tested in the iOS Simulator or on the phone.
- Preview: main published 2026-11-24 14:40 UTC (update f922a22a, #337–#347, #371, #372).

## Files and folders I touch
- `native/` only (this PR: `src/app/_layout.tsx`, `src/app/remy.tsx`), plus a news note.

## Open PRs
- Chat card on iPhone (this one): owners-only.

## Next
- The rest of Deme's iPhone check (My Path, More sheets), then in-app resume upload and feedback screenshots (new store build).

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
