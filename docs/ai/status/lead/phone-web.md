# Phone website rework (Dilan, Nov 25)

- PR 1 (bugs, straight to students): everyone gets the new homepage (`Landing2`) on `/` and `/welcome`; the old `Landing`/`HeroExample` in `Welcome.tsx` are gone. Phones' More sheet is grouped (Pages, Help, Remy, Owners) in `App.tsx` (`.more-sheet`, `.more-h`). Remy's panel face on phones was off-centre: `.asst-avatar > .fox.scholar` (80px) outranked the 56px phone rule; the phone media query now sizes the Scholar fox to 53px.
- Next: phone mockups of every page for Dilan's feedback (`/mnt/project-files/phone-web/`). No per-page redesign code until he picks.
