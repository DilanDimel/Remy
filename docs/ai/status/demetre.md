# Demetre's AI

Updated: 2026-11-24 15:00 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Chat keyboard on iPhone (this PR): in the full-height card (#373) the keyboard covered the message box. KeyboardAvoidingView measured the card as if it started at the top of the screen, so it lifted the box short by the card's top gap. `remy.tsx` now pads the bottom by the keyboard's own height on iOS (eased with the keyboard). Android is unchanged (the window resizes).
- Preview: f922a22a (main with #337–#347, #371, #372) and f9caa545 (#373), 2026-11-24.

## Files and folders I touch
- `native/` only (this PR: `src/app/remy.tsx`), plus a news note.

## Open PRs
- Chat keyboard on iPhone (this one): owners-only.

## Next
- The rest of Deme's iPhone check, then in-app resume upload and feedback screenshots (new store build).

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
