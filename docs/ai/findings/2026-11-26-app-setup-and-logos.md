# Setup defaults and company logos, Nov 26 2026 (lead AI, for Demetre's AI)

Dilan (Nov 26): Demetre owns the app, so these are notes, not `native/` changes. The website changed in #520 and #524; the shared code is already on `main`, so each app change below is a few lines.

## 1. Setup fits each kind of student (website #524)
`shared/setupDefaults.ts`: `yearOptions(path)`, `guessYearFor(path, graduation)`, `defaultTypes(goal, path)`, `fieldFromMajor(major)`.
In `native/src/components/setup/Preferences.tsx`:
- Replace `YEAR_OPTS` with `const yearOpts = yearOptions(p.path)`. Community college gives First-year/Sophomore, high school 9th-12th grade, and trade/apprenticeship/working/military give none.
- Year start: `[p.classYear, guessYearFor(p.path || "", p.graduation)].filter((y) => yearOptions(p.path).includes(y)).slice(0, 1)`. A saved "Senior" for a two-year or high-school student is ignored.
- `missing`: require a year only when `yearOpts.length`. When it's empty, title the question "When did you finish school?" (optional), hide the chips, and label the input "Graduation".
- Types start: `defaultTypes(p.goal, p.path)` instead of `["Internships"]`.
- Fields start: `p.targetRoles ? splitFieldList(p.targetRoles) : fieldFromMajor(p.major)`.
In `native/src/components/setup/Review.tsx`: hide Minor(s) when it's empty and `p.path === "high-school"`.

## 2. Company logos (website #520, merged)
#520 also changed one app line before the app handoff was clear: `native/src/components/ui.tsx` `Logo` now uses `logoSrc(company, url || "", API_BASE)` from `shared/logos.ts`. Known employers load the favicon directly; others go to `GET /api/logo` on the server, which redirects to the employer's real icon or answers 404 (initials). Keep it or revert it, your call.
