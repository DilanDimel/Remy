# Foldables and special phones (Nov 28, 2026)

Dilan approved steps A, B and C of the foldables proposal (https://claude.ai/artifact/L5EpUT2tP3sPAijAkoD7sw) on Nov 28; no Apple Developer account for now, so no iPhone Duo device test.

## Step A: root fixes (bug fixes, straight to students)
- Website: every phone media query (480 to 760 px wide) also matches short touch screens, `(pointer: coarse) and (max-height: 500px)`, so a phone held sideways keeps the phone layout. `PHONE_QUERY` in `client/src/hooks/use-mobile.tsx` is the JS twin (useIsMobile, ResumeMarkup).
- Sideways phones: the tab bar becomes a left rail. Short phone screens (Flip cover 360 x 400): Jobs lists openings before the filters (CSS order); Remy's weekly reach-out no longer opens the chat panel under 500 px tall. 320 px: Jobs buttons drop icons.
- App (`native/`, Demetre is done with the app for now, see demetre.md): `Screen` adds left/right safe-area insets and caps the column at 720 pt centred; Ask Remy button, offline banner and Jobs undo toast respect side insets. JS only (OTA-able), no app.json change.

## Step B: open foldables (improves existing pages, straight to students)
- `MID_QUERY` (768 to 1,099 wide) and `useMedia` in `client/src/hooks/use-mobile.tsx`. In that range the sidebar starts collapsed (App.tsx `mid`/`midOpen`; doesn't change the saved desktop choice), and Remy's panel overlays up to 1,099 (JS checks were 1,020).
- Jobs (Opportunities.tsx): `PickCtx` holds the one open opening for both the phone sheet and the right pane (`.op-split` / `.op-pane`, portal). Same pick survives fold/unfold. Follows the redesign switch (`useOwnerView`), like the phone rows. Viewport Segments set the gap on the fold in Chrome.
- Resume line-by-line walk: `.rm-coach` becomes a sticky second column in the middle range (CSS); the paper re-fits via a ResizeObserver on the paper.
- App: `TWO_PANE_W` 768 in ui.tsx; Jobs shows the list beside `JobView` (job.tsx, `inPane`); folding pushes `/job` for the picked opening. `Screen wide` raises the column cap to 1,200.

## Step C: brand-new, owners first (useOwnersOnly on website and app)
- Tabletop interview practice. Website `MockInterview.tsx` (Julio's area, he's credited): `(device-posture: folded) and (vertical-viewport-segments: 2)` → `.ivc-tabletop`, rows follow `env(viewport-segment-*)`. Tested in Chromium with CDP `Emulation.setDevicePostureOverride` + `setDeviceMetricsOverride({displayFeature})`; take screenshots with CDP `Page.captureScreenshot` (Playwright's screenshot resets the fold).
- App `interview.tsx` + `src/lib/posture.ts` (`useTabletop`, expo-hinge ~58.0.2 added: NEW NATIVE BUILD needed before it works; old builds get null from the optional module, no crash). Heuristic: half-open hinge + wider-than-tall window; check on a real device.
- Cover glance on Home (`CoverGlance`, short phone screens ≤560 tall): next date, today's round, Ask Remy; hides "Remy noticed" while it shows.
