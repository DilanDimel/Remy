# Start here, Julio

Welcome to the main repo. This page is for you and whichever AI you're using (Codex, Claude, Gemini, Muse, Emergent or anything else).

## How the team works

Dilan does most of the work and his project Claude is the main AI (the lead). They can work anywhere, have the final say on conflicts and merges, and can reassign a claim if priorities change. Demetre owns the phone app. You own the areas below and claim anything else before you change it.

## Your area

- **New website features.** Claim the files first, build owners-only, open a PR. The lead AI reviews it for collisions and the owners-only rule, then it merges once checks pass.
- **Reviewing new code.** GitHub asks you to review every code PR. Look for where it can fail: [`review-checklist.md`](review-checklist.md). Your review doesn't block merging; leave comments or open a follow-up PR.
- **Costs.** Current and projected costs live in [`docs/finance/`](../finance/). AI spend per call is already logged and shown on the owners' dashboard (`server/platform/admin.ts`, System tab).
- **The interview coach** you designed: `server/coach/interview*`, `shared/interview*`, `shared/jobInterview.ts`, `client/src/pages/Interview.tsx`, `client/src/components/JobInterview.tsx`, `MockInterview.tsx`. Your scoring guide is already in (#246). The plan for porting the rest of your old copy is below.

## Set up once

1. Clone `DilanDimel/Remy`, `npm ci`, then ask Dilan which local variables you need in a `.env` (`docs/development.md` lists them). **Your own keys stay in `.env`, which is never committed; the repo is public.**
2. `npm run dev`, sign in with an owner email, and keep the owner/student toggle on owner.
3. Turn on push protection for yourself: never paste a key into code, a test or a doc.

## Every session

1. `git pull`, then `npm run ai:brief -- --me Julio` (add `--vault <your vault folder>` to refresh `remy/BRIEF.md` in your vault).
2. Starting a feature: `git checkout -b julio/<feature>`, then `npm run ai:brief -- --me Julio --touch <files you'll change>`. If there are warnings, talk to that person first.
3. Add a claim for those files in [`status/julio.md`](status/julio.md).
4. Build it owners-only (`useOwnerView()` on the client, `isOwner` on the server), add a `shared/news/` note with `owners: true`.
5. `npm run check && npm run check:contract && npm test && npm run check:ai`, then open the PR and fill in the template (including `Hours:`).
6. After it merges, remove the claim and update "Working on now".

## Bringing work over from your old copy

Your old copy used SQLite and called OpenAI directly. In this repo:

- **AI calls** go through `server/ai/` (students get Gemini, owners get Claude, with usage logging and the claim checker). Don't call OpenAI directly. If you want OpenAI for local testing, ask the lead to add it as an optional provider there.
- **Data** goes in Postgres through a new numbered file in `server/migrations/`. Never edit a migration that has shipped.
- **Routes** go in `server/routes.ts` next to related ones, logic in the matching `server/<area>/` file, with a `*.test.ts` beside it.
- **Every AI line about a student** is checked by `server/ai/claims.ts`, so Remy never invents facts.
- Order we suggested: engine and catalog with tests, then the planner through `server/ai/` with limits, then the new screens, then read-aloud and transcript review, then "Mock interview" on openings.

## Opening prompt for any AI

Paste this at the start of a chat (for ChatGPT, paste the `npm run ai:brief` output under it):

> You're working on Remy (remyai.org), in the repo DilanDimel/Remy, for Julio. Before anything else read AGENTS.md, CLAUDE.md, docs/ai/CONTEXT.md, docs/ai/DECISIONS.md and docs/ai/julio.md, or the briefing below. Follow them exactly: owners-only first, no invented claims, colours from tokens, phones from 344 to 690 px, a What's new note, and update docs/ai/status/julio.md (including claims) in every PR. Work on a julio/<feature> branch. Never commit keys. If a file is owned or claimed by someone else, stop and tell me.
