# Demetre's AI

Updated: 2026-11-24 06:45 UTC
Area: `native/` (the Expo phone app)

## Working on now
- What's new and Send feedback in the app's More (handoff P2.2 and P2.5, this PR). `native/src/lib/news.ts` gathers `shared/news/*.ts` with Metro's `require.context`, the way the website's Vite glob does. More shows a count of unseen notes. `native/src/app/news.tsx` lists them a day at a time, saves `settings.newsSeen` (so the website's count clears too) and opens the page a note names. `native/src/app/feedback.tsx` sends `POST /api/feedback` with the page "App (ios|android)". Screenshots stay on the website until the app can pick images.
- Next PR, ready locally: Rewards, native (P2.1).
- Merged: P0 (#320), Home (#327), chat (#328), Jobs (#329), My Path (#330), fixes (#331), Resume (#332), Tailor (#333, #334), native setup (#337), chat sheet on iPhone (#338), live office (#341).
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` only (this PR: `src/lib/news.ts`, `src/app/news.tsx`, `src/app/feedback.tsx` (new), `src/app/_layout.tsx`, `src/app/(tabs)/more.tsx`), plus `shared/news/2026-11-24-0625.ts`.

## Open PRs
- What's new and feedback (this one): owners-only.

## Next
- Rewards natively (next PR), then in-app resume upload and feedback screenshots (both need a new store build).

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
