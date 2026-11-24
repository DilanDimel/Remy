# Demetre's AI

Updated: 2026-11-24 06:30 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Calendar, native (this PR): `native/src/app/calendar.tsx` is a sheet with Remy's line (next interview or deadline, how many things this week), Coming up (the next eight, the weekly career time once), the month with dots on busy days (tap a day for its items), an item's details (add to the phone's calendar via the `.ics` share sheet, or Google Calendar; edit or remove your own items) and an Add/Edit sheet saving `calendar` like the website (duplicates refused). To-dos with a due date and the career time show as on the website. Google Calendar sync and the career-time picker stay on the website. `go("/calendar")` opens it natively.
- Merged tonight: native setup (#337), chat sheet on iPhone (#338), live office (#341), What's new and feedback (#342), Rewards (#344), Progress (#345).
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` only (this PR: `src/app/calendar.tsx` (new), `src/app/_layout.tsx`, `src/lib/nav.ts`), plus `shared/news/2026-11-24-0650.ts`.

## Open PRs
- Calendar (this one): owners-only.

## Next
- The pin and level-up moments, then in-app resume upload and feedback screenshots (both need a new store build with expo-document-picker and expo-image-picker).

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
