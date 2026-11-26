# Students vs owners audit (Nov 26, 2026)

Dilan asked (Nov 25, 7:31 PM CT) for every fix to reach both views on desktop web, phone web and the app, and for a list of what students see vs what only owners see.

- Live releases (remyai.org /api/config, Nov 26 01:33 UTC): redesign (The Big Upgrade), rewards, places, guide, competitions = released; interview, community = locked (students see them with a lock); app = owners (students who sign in to the app get "almost here").
- Owners-only on purpose: owner/student switch, Owners' dashboard (/admin), owner-only What's new notes, overnight drafts, nudges and urgent texts (server/coach/nudges.ts, server/notify/texts.ts, routes overnightDrafts).
- Found: the app's format check (`native/src/components/FormatCard.tsx`) still used `useOwnersOnly()` after the website released it (#467). Now `useOwnerView()`, like the website.
- Checked in student and owner view on the local build with live releases: 8 pages × 1440x800, 390, 344: no page errors, no sideways scroll, no page scroll.
- Rule added to CLAUDE.md ("Both views, all three places, every time").
