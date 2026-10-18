# Frontend rules (for Muse or anyone editing the UI)

Paste this into Muse as its standing instructions for the Offer Ready repo (`DilanDimel/Remy`).

## Scope
- Edit only files under `client/`. Do not change `server/`, `shared/`, `script/`, `render.yaml` or `package.json`.
- Work on a branch named `muse/<short-feature-name>` and open a pull request into `main`. Never push to `main` directly.
- Keep each pull request to one feature or screen, so it can be checked and reverted on its own.

## Talking to the backend
- Call the backend only through the helpers in `client/src/lib/store.tsx`:
  - `api<T>("METHOD", "/api/...", body?)` for requests.
  - `download("/api/...", "file-name")` for file downloads.
  - `save("section", value)` to store workspace data. Allowed sections: `profile`, `settings`, `tasks`, `calendar`, `tracker`, `savedJobIds`, `hiddenJobIds`, `memory`, `outreach`, `onboarding`, `started`, `plan`, `contacts`.
- Write each URL as a string literal or template string (for example `` `/api/jobs/${id}/fit` ``), so the contract check can read it.
- Use the types in `shared/types.ts` (`Workspace`, `Application`, `Job` and so on) for every response. Don't redefine them in the client.
- Don't invent endpoints, fields or sections. If a screen needs something the backend doesn't have, say so in the pull request description under **Backend needed**, and the backend change is made separately.
- Don't keep app data only in `localStorage` or React state; anything the student should see after reloading goes through `save()` or an API call.

## Product rules that must survive redesigns
- Every AI change is shown as original vs. proposed wording, with the posting quote and evidence, and the student must accept, edit or reject it.
- Only approved versions can be exported, and `[PERSONALIZE]` markers must block approval.
- Nothing is sent on the student's behalf: outreach opens in their own mail app, and status updates from emails wait for the student to confirm.
- Keep honest source labels ("Student provided", "Sample", "Needs verification").
- Keep the visual identity: near-black `#161616` on warm off-white with fox orange `#E86A2A` as the accent (use the tokens in `client/src/index.css`, not raw colours), Plus Jakarta Sans + JetBrains Mono, and Remy the animated fox (`<Remy />` in `client/src/components/common.tsx`).
- Remy stays open by default with a Minimize button; don't remove either.
- Keep it working at 375px wide (bottom nav, assistant closed by default on small screens).
- Keep existing `data-testid` attributes, and add one to each new button or input.

## Checks every pull request must pass
Run from the repo root:

```bash
npm run check            # TypeScript: client and server agree on shared types
npm run check:contract   # every client API call and save() matches a server route
npm run check:persist    # builds, uses the features, restarts the server, confirms nothing is lost
```

Claude runs these on each pull request and comments with anything that fails.
