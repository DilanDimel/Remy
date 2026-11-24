# Remy: shared context for every AI

Written and kept current by the lead AI (Dilan's project Claude). Last updated: 2026-11-24 06:00 UTC.
Don't edit this file unless you are the lead; ask under "Questions for the lead" in your status file instead.

Read the root [`CLAUDE.md`](../../CLAUDE.md) too: it has the build, test and code rules. This file adds who does what, what is true right now, and the product rules that aren't in the code.

## The company and team

RemyAI is a company building Remy, an AI career coach for college students, at remyai.org. Present it as a real company and product. Never describe it as a student, class or school project.

| Person | Owns |
|---|---|
| Dilan | Product lead and main builder: does most of the work, across every area. Works through the lead AI (the main AI). Has the final say on conflicts, merges and every release to students. |
| Demetre | The phone app in `native/` (Expo). Designed the website redesign. |
| Julio | New website features, reviewing new code for where it can fail, and costs (current and projected). Owns the interview coach (credit him in PRs and What's new notes that touch it). |
| Ashton, Lincoln | Co-founders and managers. |

## Who owns which code

Dilan and the lead AI can work in every area, including the ones below, and have the final say. The lead AI sees everyone's status and can override or reassign any claim (it says so in the person's request list and in `status/lead.md`). Everyone else works in their own area and claims anything outside it.


| Area | Owner | Rule for everyone else |
|---|---|---|
| The interview coach (`server/coach/interview*`, `shared/interview*`, `shared/jobInterview.ts`, `Interview.tsx`, `JobInterview.tsx`, `MockInterview.tsx`) and `docs/finance/` | Julio and his AIs | Others write a request in their status file or add "Coordinated with: Julio" to the PR after talking to him. |
| `native/` | Demetre and his AI | Others write a request in their status file. Lead threads may edit it after reading `status/demetre.md` and noting the change in `status/lead.md`. |
| Everything else (`client/`, `server/`, `shared/`, `docs/`, `.github/`) | Dilan and the lead AI | Other AIs read `status/lead.md` and the open PRs first, note the change in their own status file, and keep PRs small. |
| `shared/types.ts`, `/api` routes | Both | The phone app and the website share these. Changing a shape or route needs both sides to know: note it in your status file and in the PR body. |
| `docs/ai/CONTEXT.md` | The lead AI | Others suggest changes in their status file. |

## How we work together

The exact paths each person owns are in [`owners.json`](owners.json). `npm run check:ai` enforces the rules below on every PR.

1. **Start every session with `npm run ai:brief`** (add `-- --me <your name>`). It prints who's on what, active claims, requests for you, open PRs with their files, what merged in the last 24 hours, and these rules. `--touch <paths>` warns you before you start if someone else owns, claims or has an open PR on those paths. `--vault <folder>` writes it to `<folder>/remy/BRIEF.md` for AIs that read a notes vault. No terminal (ChatGPT in a browser)? Paste the output in.
2. **Claim before you start** a feature that touches shared files: add it under `## Claims` in your own status file (format in [`status/README.md`](status/README.md)). Small (files, not folders), at most 3 days, removed when the PR merges.
3. **Before every PR, rewrite your own `status/<person>.md`** in the same PR. CI fails without it. `check:ai` never blocks Dilan or the lead AI; their threads coordinate inside Dilan's project.
4. **Need a change in someone else's area?** Add `- to <Name>: <what you need>` under `## Requests` in your status file. Their briefing shows it. If you agreed to do it yourself, add `Coordinated with: <Name>` to the PR description, or CI blocks it.
5. **Fill in the PR template**, including `Hours:` (your own hands-on time; it feeds the owners' dashboard) and `AI cost:` if you know it.
6. One feature per branch and PR (`<name>/<feature>`, the lead's are `claude/...`). Rebase on `main` right before merging; `main` needs the green "checks" status and an up-to-date branch.
7. Commit as the person you work for (their name and GitHub noreply address). An AI co-author line is fine.
8. **Reviews:** Julio is asked to review every code PR, to spot where it can fail ([`review-checklist.md`](review-checklist.md)). His review doesn't block merging; findings become comments or follow-up PRs. The lead reviews other people's PRs for collisions and the owners-only rule before they merge.

## Product rules (all AIs)

The dated reasons behind these are in [`DECISIONS.md`](DECISIONS.md).


- **Owners only first.** Every new or redesigned feature is visible only to owners until Dilan releases it. Releases are switched on Admin → Beta → Feature releases (`shared/features.ts`), not by deploying. The phone app is owners-only too.
- **No invented claims.** Remy never makes up facts about a student. AI rewrites are checked (`server/ai/claims.ts`) and shown as original vs. proposed, for the student to accept, edit or skip.
- **Nothing is sent for the student.** Emails and outreach open in the student's own mail app. Status changes from email wait for the student to confirm.
- **Pricing wording:** say only "Free during beta". Never "free", "always free" or "100% free" on its own.
- **Honest marketing:** real app screens, the real Remy fox, real people. No invented results or testimonials.
- **Look:** "paper, ink, one orange". Colours come from tokens (`client/src/index.css` on the web, `native/src/lib/theme.ts` in the app). No dark bands with an orange glow, at most one peach card per page, no long scrolling.
- **Remy is not a plain chatbot.** He reaches out first, does things himself (every feature is wired to the AI), and shows up on the pages where the work happens.
- **Phones:** every web page works from 344 to 690 px wide.
- **What's new:** every PR that changes what people see adds a note in `shared/news/` (see `CLAUDE.md`).
- **Secrets** live in Render, Expo/EAS or a local `.env`. This repo is public: never commit keys, personal emails, phone numbers or private notes.

## Status right now (Nov 24, 2026)

- The website redesign ("The Big Upgrade") is finished for owners and about to be released to students in one switch, together with Rewards. Interview and Community stay locked ("coming soon") for students; Opportunities is open.
- Students use Gemini Flash; owners trial a Claude model (`OR_AI_CHAIN_OWNERS`).
- Background jobs run hourly from a Cloudflare cron that calls `/api/cron/tick`.
- The phone app (`native/`) is an owners-only Expo preview: native Today, Path, Remy and Jobs tabs; other pages open the website in a signed-in sheet. Demetre is taking it over now, from a handoff the lead wrote for him.
- Supabase (free plan) went over its 5 GB data-transfer quota. The cause, the server re-downloading each workspace on every request, is fixed in #310. Supabase support confirmed (Nov 24): if the cycle that starts Dec 18 stays under the free 5 GB, nothing gets restricted; going over again means a restriction with no new grace period. So: stay on Free, no Pro, Neon or Render Postgres move needed. Never load a whole workspace per request in new code, and bump `updated_at` in any raw SQL that edits `workspaces`. Details in `status/lead.md`.
- Email goes out from `remy@mail.remyai.org`; replies go to hello@remyai.org.

## Where things are

- `README.md`: the product. `docs/architecture.md`: code layout. `docs/development.md`: run, test, deploy.
- `docs/FRONTEND-RULES.md`: longer UI rules. `native/README.md`: the phone app.
