# Demetre's AI

Updated: 2026-11-24 06:10 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Remy's office drawn from the student's progress (handoff 04, this PR): `native/src/components/officeRoom.ts` ports PathBoard.tsx's room to two SVG strings (behind and in front of Remy) with the theme's colours, and `Office.tsx` reads the same workspace fields the website does: books for decoded jobs, pins on the corkboard, the framed resume, the briefcase after an application, level items from `OFFICE`, chest finds, streak plant and photo, the outfit the student wears, and a clock with the real time. Remy breathes (off with Reduce Motion) and shares a quote when left alone. The static `officeSvg.ts` is gone.
- Next PR, ready locally: What's new and Send feedback in More (P2.2, P2.5).
- Merged: P0 (#320), Home (#327), chat (#328), Jobs (#329), My Path (#330), fixes (#331), Resume (#332), Tailor (#333, #334), native setup (#337), chat sheet on iPhone (#338).
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` only (this PR: `src/components/Office.tsx`, `src/components/officeRoom.ts` (new), `src/components/officeSvg.ts` (removed), `src/app/(tabs)/path.tsx`), plus `shared/news/2026-11-24-0620.ts`.

## Open PRs
- Live office (this one): owners-only.

## Next
- What's new and Send feedback (next PR), then Rewards natively (P2.1) and in-app resume upload (needs a new store build).

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
