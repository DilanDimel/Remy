# Remy: shared context for every AI

Written and kept current by the lead AI (Dilan's project Claude). Last updated: 2026-11-24 03:15 UTC.
Don't edit this file unless you are the lead; ask under "Questions for the lead" in your status file instead.

Read the root [`CLAUDE.md`](../../CLAUDE.md) too: it has the build, test and code rules. This file adds who does what, what is true right now, and the product rules that aren't in the code.

## The company and team

RemyAI is a company building Remy, an AI career coach for college students, at remyai.org. Present it as a real company and product. Never describe it as a student, class or school project.

| Person | Owns |
|---|---|
| Dilan | Product lead. Decides every release to students. Works through the lead AI. |
| Demetre | The phone app in `native/` (Expo). Designed the website redesign. |
| Julio | The interview coach (credit him in PRs and What's new notes that touch it). |
| Ashton, Lincoln | Co-founders and managers. |

## Who owns which code

| Area | Owner | Rule for everyone else |
|---|---|---|
| `native/` | Demetre and his AI | Lead threads don't edit it. If a change is needed, read `status/demetre.md`, write the request there or in `status/lead.md`, and tell Dilan. |
| `client/`, `server/`, `shared/`, `docs/`, `.github/` | The lead AI | Other AIs read `status/lead.md` and the open PRs first, note the change in their own status file, and keep PRs small. |
| `shared/types.ts`, `/api` routes | Both | The phone app and the website share these. Changing a shape or route needs both sides to know: note it in your status file and in the PR body. |
| `docs/ai/CONTEXT.md` | The lead AI | Others suggest changes in their status file. |

## How we work together

1. Read this file, every `status/*.md`, and the open PRs before you start.
2. Before every PR, rewrite your own `status/<person>.md` (template in [`status/README.md`](status/README.md)) in the same PR.
3. One feature per branch and PR. Rebase on `main` right before merging; `main` needs the green "checks" status and an up-to-date branch.
4. Commit as the person you work for (their name and GitHub noreply address). An AI co-author line is fine.
5. If your work collides with someone else's file or PR, stop and say so in your status file and to your person. The lead decides the order.

## Product rules (all AIs)

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
- Email goes out from `remy@mail.remyai.org`; replies go to hello@remyai.org.

## Where things are

- `README.md`: the product. `docs/architecture.md`: code layout. `docs/development.md`: run, test, deploy.
- `docs/FRONTEND-RULES.md`: longer UI rules. `native/README.md`: the phone app.
