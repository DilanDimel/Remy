# Working on Remy

Remy is an AI career coach for college students (remyai.org). Start with `README.md` for layout and commands, and `docs/architecture.md` for how the code fits together.

## Before you push

Run these; CI runs the first three and Render deploys whatever lands on `main`.

```bash
npm run check && npm run check:contract && npm test
```

Touched resume reading? Also `npm run check:resume`. Touched the database or sessions? Also `npm run check:persist`.

## Rules every change follows

- **Owner view first.** New and redesigned features are owners-only until the team releases them. Gate client code with `useOwnerView()` (`client/src/lib/store.tsx`); owner styling hangs off the `html.redesign-2` class. Server checks use `isOwner` (`server/admin.ts`). Never ship a change to students without the team's explicit go-ahead.
- **Test and screenshot in owner view**, signed in as an owner with the owner/student toggle on owner.
- **No invented claims.** Every AI rewrite is checked by `server/claims.ts` and shown as original vs. proposed for the student to accept, edit or reject. Only approved versions export.
- **Nothing is sent for the student.** Outreach opens in their own mail app; status changes from email wait for them to confirm.
- **Colours come from tokens** in `client/src/index.css` ("paper, ink, one orange"). `check:contract` fails on raw colours not in `script/color-allowlist.json`.
- **Phones:** every page works from 344 to 690 px wide.
- **Client calls the server only through** `api()`, `save()` and `download()` in `client/src/lib/store.tsx`, with literal `/api/...` URLs so the contract check can read them. Shared shapes live in `shared/types.ts`.
- **New `/api` route:** add it in `server/routes.ts` next to related routes, put the logic in a feature file, and add a `*.test.ts` beside it.
- **Database change:** add the next numbered file in `server/migrations/`. Never edit a migration that has shipped.
- **Secrets** go in the Render dashboard or a local `.env`, never in the repo.
- Keep existing `data-testid` attributes and add one to each new button or input.

## Pull requests

- One feature per branch and PR, rebased on `main` before opening.
- Several Claude threads work here at once. Before editing a file another open PR touches, check the open PRs and coordinate, so changes don't collide.
- Owners-only PRs may be merged once CI passes. Anything that reaches students waits for the team.

## Design skills

`.claude/skills/` has Impeccable, Vercel's React best practices and web design guidelines (see its README). Remy's own rules above win where they differ. `docs/FRONTEND-RULES.md` has the longer UI rules.
