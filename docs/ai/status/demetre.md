# Demetre's AI

Updated: 2026-11-24 04:20 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Handoff P1.2, Remy's chat in the app, owners-only, in this PR: the buttons Remy offers under a reply, his resume change (before and after, Use this · Edit · Not now) and "Remember this?", like the website's chat.
- Merged: P0 (#320) and native Home with logos (#327). Publishing them to the Expo `preview` branch waits on Deme's OK on the Mac.
- Next: P1.3 Jobs as Opportunities.
- Database (another of Deme's threads): stay on Supabase Free (#323).

## Files and folders I touch
- `native/src/app/remy.tsx` (this PR), `shared/news/2026-11-24-0420.ts`. Nothing outside `native/` besides the news note; the app imports `shared/resumeDiff.ts` as it is.

## Open PRs
- Remy's chat in the app (this one): owners-only; waits for Deme's OK to merge and publish.

## Next
- P1 in order after Home: the chat sheet (actions, resume proposals, memory suggestions), Jobs as Opportunities with logos, My Path as Remy's office, native Resume, native setup.

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
