# One screen again + chat action card (Nov 26)

Dilan (Nov 26, 2:15 UTC): pages scrolled again on his 1920-wide monitor, and Remy's chat action lines ("Started fixing your resume…", "Saved 1 fact", underlined with loose ticks) looked dodgy.

- Cause: #497's big-screen zoom keyed on width (1.15 at ≥1700x1000). His window is about 1920x1023, so 1023/1.15 left ~890px for a layout that needs ~940 (what a 1440x800 laptop gets at 85%); Home ran 90px past the screen. A 1920x1080 test viewport gives 939, so the sweep passed.
- Fix: `fitZoom` in `client/src/main.tsx` sets `--app-zoom` on ≥1700px wide windows from the HEIGHT: floor to 0.05 of height/940, between 1 and 1.5, also capped by width/1450. Runs on resize. The two tall-screen media queries in `index.css` are gone; laptops keep the .85 CSS rule, phones 1. New screen-size rules should use `--app-zoom`, not new media queries.
- Chat action card: `RemyDid.tsx` (+ `.chat-did`/`.did-*` in `index.css`) is one bordered card, a row per thing done: orange tick, bold label, chevron when it opens a page, Undo as a quiet text button; undone rows grey with "Undone". The `card` prop is gone. App: `native/src/components/DidRows.tsx`, used by `native/src/app/remy.tsx` and the office guide answer in `OfficeGuide.tsx`; also hides Undo when `noUndo` (it used to show it).
- Read `docs/ai/status/demetre.md` first: no claims on `native/src/app/remy.tsx` or `OfficeGuide.tsx`.
