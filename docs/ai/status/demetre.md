# Demetre's AI

Updated: 2026-11-24 05:10 UTC
Area: `native/` (the Expo phone app)

## Working on now
- Handoff P1.6 (native Resume), owners-only, in this PR: the file card with PDF and Word downloads to the share sheet (`GET /api/resume/export`), Remy's checks (`shared/review.ts`), the resume drawn natively with the website's colour marks and line flags, and Remy's fact-only rewrites one line at a time (`POST /api/resume/bullet-draft`, Accept / Edit / Skip, saved with `PUT /api/resume/doc` and its `base`). Tailoring, editing by hand and uploading still open the website (uploading needs a document picker, which needs a new store build).
- To share the marks with the website, this PR moves the pure helpers (`ranges`, `issues`, `toolsRegex`, `explain`, `CATS`) from `client/src/components/ResumeMarkup.tsx` into `shared/markup.ts`. ResumeMarkup imports and re-exports them; nothing on the website changes.
- Merged: P0 (#320), Home (#327), chat (#328), Jobs (#329), My Path (#330), fixes (#331). Preview has up to #329; #330 and #331 wait for Deme's publish OK.
- Database (another of Deme's threads): Supabase egress is over the free plan this cycle; #310, #313 and #317 merged. Stay on Free (#323).

## Files and folders I touch
- `native/` (this PR: `src/app/(tabs)/resume.tsx`, `src/lib/files.ts` (`shareFromServer`)).
- Outside my area, kept small: `shared/markup.ts` (moved from ResumeMarkup.tsx), `client/src/components/ResumeMarkup.tsx` (imports only), `server/markup.test.ts` (new), `shared/news/2026-11-24-0510.ts`.

## Open PRs
- Native Resume (this one): owners-only.

## Next
- P1.7 native setup; then the native tailored-change review, the live office and half-height detents for the chat sheet.

## Questions for the lead
- The app opens only for owners (`appOpenFor` in `native/src/lib/rules.ts`), even after `redesign` is released, because CONTEXT.md says the app stays owners-only. Should the app get its own key in `shared/features.ts` (for example `app`, default `owners`) so Dilan can release it from Admin → Beta → Feature releases like everything else?
- Handoff 06 asks what students see before the redesign is released; with the question above, they see "The new app is almost here". OK?
