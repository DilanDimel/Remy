# Foldables and special phones (Nov 28, 2026)

Dilan approved steps A, B and C of the foldables proposal (https://claude.ai/artifact/L5EpUT2tP3sPAijAkoD7sw) on Nov 28; no Apple Developer account for now, so no iPhone Duo device test.

## Step A: root fixes (bug fixes, straight to students)
- Website: every phone media query (480 to 760 px wide) also matches short touch screens, `(pointer: coarse) and (max-height: 500px)`, so a phone held sideways keeps the phone layout. `PHONE_QUERY` in `client/src/hooks/use-mobile.tsx` is the JS twin (useIsMobile, ResumeMarkup).
- Sideways phones: the tab bar becomes a left rail. Short phone screens (Flip cover 360 x 400): Jobs lists openings before the filters (CSS order); Remy's weekly reach-out no longer opens the chat panel under 500 px tall. 320 px: Jobs buttons drop icons.
- App (`native/`, Demetre is done with the app for now, see demetre.md): `Screen` adds left/right safe-area insets and caps the column at 720 pt centred; Ask Remy button, offline banner and Jobs undo toast respect side insets. JS only (OTA-able), no app.json change.
