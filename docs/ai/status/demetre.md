# Demetre's AI

Updated: 2026-11-24 03:55 UTC
Area: `native/` (the Expo phone app)

## Working on now
- The app handoff's P0 list (`07-gap-list.md`), owners-only. This PR does P0.3 to P0.11 together: website tokens, Calm/Soul removed, Scholar Remy, `/api/config` with owner/student/feature releases, the owner toggle and theme in More, the website's gate order (sign-in, beta list, beta terms, setup), the beta terms screen, the theme following the account, and the tab bar Home · My Path · Resume · Jobs · More with Remy as a floating fox that opens his chat.
- P0.1 (publish to the Expo preview branch) and P0.2 (a preview build instead of Expo Go) wait for Deme's OK and Expo login.
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle (grace period ends Dec 23); #310 and #317 cut the main sources. Pro stays the backup; no billing change without Deme's OK.

## Files and folders I touch
- `native/` (this PR: `src/app/*`, `src/app/(tabs)/*`, `src/components/ui.tsx`, `src/components/scholarSvg.ts` (new, replaces `foxSvg.ts`), `src/lib/{tokens.ts,theme.tsx,rules.ts,config.tsx,gate.tsx,session.tsx,nav.ts}`, `tsconfig.json`, `README.md`).
- Outside my area: `shared/news/2026-11-24-0341.ts` (owners-only note). No `client/`, `server/` or `shared/` logic changes; the app imports `shared/features.ts` and `shared/beta.ts` as they are.
- Database work (other thread): `server/platform/limits.ts` (and test), `server/migrations/018_rate_limits.sql`, rate-limit calls in `server/routes.ts`, `docs/database-plan.md`.

## Open PRs
- The P0 app PR (this one): owners-only; waits for Deme's OK to merge, then an Expo preview publish with Deme's OK.
- Merged: #313 rate limits kept in the database, #317 postings cache in server memory.

## Next
- P0.1/P0.2 with Deme: publish to `preview`, then a preview build, and retest on the Android emulator and the iPhone.
- P1 in order: native Home, the chat sheet (actions, resume proposals, memory suggestions), Jobs as Opportunities with logos, My Path as Remy's office, native Resume, native setup.

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
