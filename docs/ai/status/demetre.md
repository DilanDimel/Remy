# Demetre's AI

Updated: 2026-11-24 04:10 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Handoff P1.1 (native Home) with P1.4 (company logos), owners-only, in this PR. Home's "one thing" rules move from `client/src/pages/Home.tsx` into `shared/nextAction.ts` (no behaviour change on the website; Home.tsx now calls it), and the app uses the same function.
- P0 is merged (#320) and published to the Expo `preview` branch; an Android preview APK is building. The iPhone build waits for the Apple Developer account.
- Next: P1.2 the chat sheet.
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` (this PR: `src/app/(tabs)/index.tsx`, `src/app/(tabs)/jobs.tsx`, `src/components/ui.tsx` (`Logo`), `src/lib/next.ts` and its test).
- Outside my area, kept small: `shared/nextAction.ts` (new, moved from the website's Home), `client/src/pages/Home.tsx` (calls it instead of its own copy), `server/nextAction.test.ts` (new), `shared/news/2026-11-24-0410.ts`.

## Open PRs
- Native Home (this one): owners-only; waits for Deme's OK to merge and publish.

## Next
- P1 in order after Home: the chat sheet (actions, resume proposals, memory suggestions), Jobs as Opportunities with logos, My Path as Remy's office, native Resume, native setup.

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
