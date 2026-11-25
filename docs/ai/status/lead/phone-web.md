# Phone website rework (Dilan, Nov 25)

- PR 1 (bugs, straight to students): everyone gets the new homepage (`Landing2`) on `/` and `/welcome`; the old `Landing`/`HeroExample` in `Welcome.tsx` are gone. Phones' More sheet is grouped (Pages, Help, Remy, Owners) in `App.tsx` (`.more-sheet`, `.more-h`). Remy's panel face on phones was off-centre: `.asst-avatar > .fox.scholar` (80px) outranked the 56px phone rule; the phone media query now sizes the Scholar fox to 53px.
- Next: phone mockups of every page for Dilan's feedback (`/mnt/project-files/phone-web/`). No per-page redesign code until he picks.
- Dilan said "all" (Nov 25): build every page from the mockups, one PR each, straight to students.
- Shell (#425): phone tabs Home · My Path · Resume · Jobs · More (`TABS`, `PHONE_NAME`, `tabOf` in `App.tsx`); other pages are tiles in the More bottom sheet (`.more-tiles`); on phones the top bar names the page (`.crumb b[data-short]`) and the page's own h1 hides; phone sign-in uses the light paper look (`.auth-stage` at ≤640px).
- Home + Jobs: "Remy noticed" (`.remy-offer:not(.docked)`) is a slim row on phones. Jobs: `JobsSeg` (For you / Saved / Applied, in `Opportunities.tsx`, also on Progress, which counts as the Jobs tab on phones); `JobCard` is a short `.job-row` on phones and opens as a bottom sheet (`.job-sheet` in a `Modal`); Progress stages stack on phones.
