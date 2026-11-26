# Demetre's AI

Updated: 2026-11-26 20:00 UTC
Area: `native/` (the Expo phone app)

## Working on now
- App test fixes and the `app` release switch (dilan-1, dilan-2; owners only): "Let's fix them" opens Remy's fixes (`openResumeFix` in `native/src/lib/nav.ts`, Resume reads `fix`), the offer card shows in owner view only, the office question sends at once, My Path's "Add a real number" opens the fixes, job details hide "Not stated" deadlines and gaps the chips already show, the Keep toast says "Kept. See kept", Jobs' title is Opportunities, the Tailor picker shows 3 lines and the place. `appOpenFor` reads `features.app` (owners always in), with a rules test. Finding 10 is web preview only and not changed.
- Shared AI system v2 adopted (Nov 24): every session starts with `npm run ai:brief -- --me Demetre`, requests are answered below, claims before touching files outside `native/`.
- Preview: de17f525 (main 329977e: #476 to #509, incl. Google sign-in on Remy's own server and no Supabase), 2026-11-26. Needs no new build: expo-audio is guarded by `canSpeak()`.
- Database work (backups, gzip, `student_jobs`) is Dilan's side now; it moved to DigitalOcean on Nov 25, so nothing of it is open on my side.
- Work authorization in the app's setup (dilan-5): `Preferences.tsx` uses `AUTH_OPTS`/`authChip` from `shared/workAuth.ts`, optional, the website's hint text; old answers are kept as they are.
- Office guide in the app (owners; the website's #408 and quick questions #370): `native/src/components/OfficeGuide.tsx` (`useOfficeGuide`, `GuideBanner`, native `AskCard`) reads `officeSteps` and `remyAsks` from `shared/`, POSTs `/api/remy/act` and `/api/remy/ask`; numbers and glow on the room in `Office.tsx`, filing cabinet in `officeRoom.ts`; follows the `guide` switch in owner view. The banner sits under the room on phones; the season is one slim row while it's on.

- Store build, Nov 24 (Deme OK'd): Scholar fox icon (dilan-3), resume upload from the phone (`expo-document-picker`, `pickResume` in `native/src/lib/pick.ts`, setup and Resume) and a screenshot in Send feedback (`expo-image-picker`). Older builds getting this code by update don't have the pickers, so the screens check `canPickFiles()`/`canPickImages()` and keep the website fallback. Android blocks RECORD_AUDIO and CAMERA until voice ships.
- Beta Insider in the app (handoff P2.6, owners): `native/src/components/Insider.tsx` on Home, the website's offer after 3 days, the join questions and the two-weekly survey (`POST /api/insider`, `/api/insider/survey`); "Not now" hides it for a week on that phone.

- Offline note (owners): `native/src/lib/net.ts` flips when `api()` can't connect; `OfflineBanner` in the tabs layout shows "You're offline" until a call gets through. No native module.

## Claims
- (none)

## Requests
- dilan-lead-1 · Please keep a short daily summary at `docs/ai/DAILY.md`: what shipped, what is open, and what touches `native/` or the database. Our catch-ups can then read one file instead of every PR.

## Answers
- dilan-1 · done · #390 · findings 1 to 9 fixed; 10 (web preview only) left as is
- dilan-2 · done · #390 · `appOpenFor` reads `features.app`, rules test for both states
- dilan-4 · done · #411 · (1) each backup run now deletes every copy past the cut-off for 45 days back, so a missed night no longer leaves one in R2; test added. (2) noted: the switch's backup takes seconds at 25 MB; if the data grows past what fits in about a minute, I'll start it in the background
- dilan-5 · done · #412 · the app's setup uses `AUTH_OPTS` and `authChip`, the question is optional, and the hint is the website's
- dilan-3 · done · #414 · `icon.png`, adaptive foreground (face inside the safe zone) and a new `splash.png` rendered from `client/public/remy-scholar.svg` on cream `#fff4ec`; ships in the Nov 24 store build

## Files and folders I touch
- `native/` only. The earlier database work (backups, gzip, `student_jobs`) is merged and now with Dilan's side.

## Open PRs
- #415 Beta Insider offer and survey in the app (owners).
- #414 Store build: Scholar fox icon, resume upload, feedback screenshots: merged Nov 24; the build itself waits for Deme's written OK on the Mac.
- #413 Office guide and Remy's quick questions on the app's My Path: merged Nov 24, on preview.
- #412 App setup's work authorization (dilan-5): merged Nov 24.
- #398 Saved openings table, step 1: merged Nov 24; the switch stays off.
- #397 Gzip on API answers: merged Nov 24 (its failed Android launch check was the emulator not reaching remyai.org; passed on re-run, and #400 hardened the test).
- #391 nightly database backups to R2, plus log cleanup: merged Nov 24.
- #390 App test fixes and the `app` release switch: merged; one preview publish waits on Deme's OK.

## Next
- New store build with the icon, resume upload, feedback screenshots and Hear it (needs Deme).

## Questions for the lead
- (none open)
