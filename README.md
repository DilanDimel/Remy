# Offer Ready

A functional, private-preview student career demo for the Neeley AI Forward Offer Ready concept. The visual direction uses warm neutral surfaces, restrained purple, readable type and a clear student-centered hierarchy.

## Run

- `npm ci`
- `npm run dev` starts Express and Vite on port 5000.
- `npm run check` runs TypeScript checks.
- `npx tsx script/coverage.ts` rebuilds the 155-node coverage inventory.
- `npm run build` builds `dist/public` and the Node server.
- `NODE_ENV=production node dist/index.cjs` runs the production bundle.
- `npx tsx script/regression.ts` runs local API regression tests using isolated QA identities.

The private hosted preview requires the trusted visitor identity header supplied by its hosting proxy. Direct production API requests without that header are rejected. A production deployment elsewhere needs its own authenticated identity layer and durable database; never trust a visitor header from arbitrary clients.

Live AI uses the OpenAI SDK Responses API on the server. Credentials are injected into the running private preview and are not part of the source. Public republishing needs a separately configured, authorized AI provider; this source bundle does not include one. Requests are limited to 5 per minute and 30 per rolling day per visitor.

## Implemented experience

- Editable synthetic Finance and Marketing profiles, plain-text resume import, confirmed experience and personal preferences.
- Demo connection choices; optional live contextual onboarding questions; notification category opt-outs.
- Semester tasks, role exploration, learning examples, campus activities and optional experiments.
- Explained opportunity ranking, known conflicts versus unknown eligibility, saved roles, dated public snapshots and manual public URL/text import.
- Three initial application pairs, live tailoring, original-versus-proposed statements, requirement evidence, human flags, corrections, review, plain-text and DOCX export, status and version history.
- Tentative advising plans, sample class-conflict checks, Central-time ICS download, manual notes, live summaries and approved tasks.
- Contextual live AI guide, workspace data export, activity log and full scope documentation.

## Honest boundaries

No real TCU, Stellic, Outlook, LinkedIn, Handshake or GitHub account is connected. No job application, message, email, appointment or invitation is sent. All academic and campus examples are illustrative, not an official degree audit or verified activity directory. Public job snapshots were researched on October 17, 2026; the demo is not a live or exhaustive feed.

Application checks are conservative rules plus mandatory student review, not a guarantee of truth. A real test draft introduced an unsupported reporting detail; the UI allows it to be flagged, logged and corrected. Constructed tests are separately labeled and must not be presented as actual AI errors.

Workspace edits are stored in SQLite, partitioned by trusted visitor identity. This is not university SSO, a FERPA-reviewed service or production storage. Use synthetic information only. Demo data is excluded from source backups.

## Scope preservation

`docs/idea-inventory.json` retains all 155 original mind-map nodes. `docs/mindmap-coverage.csv` maps every node to a screen and an honest working, partial, simulated, context or parked status. `docs/product-brief.md` preserves the full specification; both the brief and coverage CSV can be downloaded from the app’s product-scope screen.

The application does not replace the competition pitch deck, final source re-verification, team validation or judging submission.

## Verification and production follow-up

See `docs/qa.md` and `docs/regression-results.json`. A dependency audit still reports issues in the inherited Tailwind/build-tool dependency tree with no non-breaking fix; do not represent this demo as production-hardened. Before production, resolve the tooling dependencies, establish institutional permissions, add authentication and monitoring, validate accessibility comprehensively and migrate to durable storage.
