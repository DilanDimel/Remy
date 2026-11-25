# Catch-up for Julio's AI (written Nov 25, 2026, 11:15 UTC)

Your status file was last updated Nov 24, 06:00 UTC (`docs/ai/status/julio.md`). Since then Dilan and the lead AI (Dilan's project Claude) merged about 120 PRs (#345 to #465). Read this first, then run `npm run ai:brief -- --me Julio` as usual, and rewrite `docs/ai/status/julio.md` in your next PR.

Short version:
- **Your interview coach is still in, still locked for students** ("coming soon"). The lead touched two of your files for the microphone and Remy's new voice. Nothing else in your area changed. Details in section 1.
- **The AI setup changed.** Everyone (students and owners) now uses Claude Haiku 5.5 through OpenRouter, not Gemini for students. `docs/ai/julio.md` said otherwise before this PR; it's fixed.
- **The release rule changed.** Only brand-new features ship owners-only first. Fixes and improvements go straight to students.
- **New rule: works everywhere.** Every change has to work on the desktop site, the phone site and the phone app, each with its own design.
- **Lead threads now edit the phone app (`native/`)** too, because Demetre's AI ran out of credits.
- **Nothing is waiting on you.** One open PR (#464, the lead's, app sign-in in Expo Go), not in your area.

---

## 1. Your area: the interview coach and `docs/finance/`

The lead changed your files three times. Keep these changes when you edit them.

| PR | File | What changed |
|---|---|---|
| #416 | `client/src/components/MockInterview.tsx` | **Mic fix.** The server's `Permissions-Policy` header said `microphone=()`, so every browser silently refused the mic and "Answer out loud" never worked. Now `microphone=(self)` (`server/index.ts`). Mic errors show plain words (`micProblem` in `client/src/lib/voice.ts`) instead of `onerror = () => {}`, and `r.start()` is in a try. |
| #434 | `MockInterview.tsx` | **"Hear it" uses Remy's real voice.** It calls `say()` / `hush()` from `client/src/lib/voice.ts` instead of `speechSynthesis` directly. |
| #439, #440 | `MockInterview.tsx`, `voice.ts` | **No robot voice anymore.** The browser `speechSynthesis` fallback was removed everywhere Remy speaks. If the voice fails, the button says why ("Remy's voice couldn't play. Check your sound is on...") and it's logged as client error `voice`. Playback goes through Web Audio so iPhones accept it. |

How the voice works now:
- **Route:** `POST /api/voice` (`server/ai/voice.ts`). ElevenLabs, voice "Arthur", model `eleven_v4_turbo`. Returns MP3.
- **Cache:** each line is made once, kept in memory and sealed in R2.
- **Limits:** 60 reads an hour per user, 1,000 characters max.
- **Testing the mic:** the Claude app's built-in browser blocks the mic on its own, so test in real Chrome or Edge. Firefox has no speech recognition (the buttons hide or say "type instead").

Release state: Interview is still **locked** for students (`interview: "locked"` in Feature releases), and owners see it. Releasing it is the team's call.

`docs/finance/`: nobody touched it. For costs, two new things help:
- **#421:** Admin → System shows the real OpenRouter balance as "AI money left".
- **#448, #450 PostHog:** the server sends `$ai_generation` for every AI call (model, tokens, cost, latency, feature = route; never the prompt or answer text) via `server/platform/posthog.ts`. So AI cost per feature is now in PostHog, next to the per-call log on the owners' dashboard.

## 2. AI models (changed, affects anything you build)

- **#361:** every account uses Claude Haiku 5.5 through OpenRouter, with Gemini Flash and GPT-5 mini as fallbacks (`OR_AI_CHAIN`). Zero data retention is on (`OR_AI_PRIVACY=on`). Owners can still trial other models (`OR_AI_CHAIN_OWNERS`).
- **Still true:** every AI call goes through `server/ai/` (rate limits, usage logging, claim checker). Never call OpenAI or another provider directly.
- **#461:** `aiText` (`server/ai/ai.ts`) now accepts a content array as the user message (used to send a PDF file part).

## 3. What merged since your last update

### Resume accuracy (everyone)
A 1,000-resume test set plus a study of about 4,500 real resumes drove five PRs. Details: `docs/ai/status/lead/resume-accuracy.md`.
- **#453:** reads every common degree form (MS in, BSEd, BFA, BSN, Associate of Applied Science in, Double Major in), schools without "University" (Virginia Tech, institutes), campus names, "12/2026" dates. Profile facts fully right went from 71% to 98% on the set.
- **#454:** PDFs that draw bullets as shapes get real bullets; contact details printed in a sidebar are found.
- **#456:** job matching counts the openings each major really takes as in-field (`server/jobs/fit.ts`, `FIT_RULES_VERSION` 21). Own-field openings wrongly hidden went from 16.6% to 1.4%.
- **#458 Format check (brand-new, owners only):** `server/resume/format.ts` says when a resume's format hurts it (pages, photo, personal details, columns, tiny text, crowded edges) and offers three clean formats (classic, modern, compact). Routes `GET/POST /api/resume/format`, `GET /api/resume/format/preview`. Website `FormatCheck.tsx`, app `native/src/components/FormatCard.tsx`.
- **#461:** scanned or photo PDFs (under 200 letters of text) go to the AI as the PDF itself, which copies the words; the student still confirms "Does this look like your resume?".
- **Earlier (Nov 24):** resumes keep their own look after edits, export PDF and Word, and stay one page (#386, #392, #394, #404).

### Jobs (everyone)
- **#460 Employer catalog:** `server/jobs/catalog.ts` reads about 15,600 companies' public job boards (Greenhouse, Lever, Ashby, Workable, Recruitee, SmartRecruiters) a slice each hour, keeps US student-level postings and stores them sealed in R2, never Supabase. Details: `docs/ai/status/lead/employer-catalog.md`.
- **#462, #465 Occupation matcher:** `server/jobs/soc.ts` gives `matchTitle(title)`, `majorSocs(major)` and `jobZone(soc)`, offline with no AI (`server/data/onet-titles.json`). Not wired into ranking yet; the next PR does that.
- **#398, #419, #447 Saved openings** moved to their own table (`student_jobs`, Demetre's work) for everyone, with a cache in R2 so deploys don't re-download them.
- **#382 Competitions:** Remy finds competitions and challenges for the student's field (brand-new, owners first).
- **#396:** "What's the job?" is a clue game with today's round beside it.

### Owners' dashboard
- **#451:** Admin → Students lists every account (not only the Founding Cohort) with counts: new today, 7 and 30 days, active, set up, resume.
- **#352, #349, #356:** Beta became Students, with the release switches at the top.

### Remy himself
- **#370, #380:** Remy asks quick questions and keeps the account up to date himself.
- **#408, #409:** Remy guides students from his office on My Path (released to everyone).
- **#434–#440:** Remy speaks in a real voice (section 1).
- **#368, #369:** the smiling Scholar fox everywhere; a loading screen with Remy.

### Phone website (everyone)
- **#422–#441:** phones get their own layout, not a shrunk desktop page: Home · My Path · Resume · Jobs · More tabs, Jobs as short rows that open a sheet, office first on My Path, a Calendar week strip, a "Get started with Remy" first visit, no dead space under tabs. Details: `docs/ai/status/lead/phone-web.md`.

### Phone app (`native/`)
- **Lead threads now edit the app** (Dilan, Nov 25), keeping Demetre's design and structure. Every change is noted in `docs/ai/status/lead/app-fixup.md`.
- **Native screens added:** Today's round, resume line edits, plan step sheet, Jobs Saved/Applied, Account and Remy's memory, Email updates, Hours, a new first-run and sign-up, "Hear it" with Arthur's voice.
- **#455, #457, #459, #463 App sign-in:** Google and LinkedIn in the app through Supabase with PKCE. Supabase returns to `https://remyai.org/api/auth/app-return` (`appReturnPage` in `server/platform/auth.ts`), which opens the app. Details: `docs/ai/status/lead/app-sign-in.md`.
- Still opening the website in a sheet: Interview, Community, profile editing and a few others. **If Interview is released, the app needs its own native Interview screen** (see rule 2 below); that would be yours to plan with the lead.
- The app is still owners-only (the `app` switch).

### Under the hood
- **Hosting:** the server moved to Render Virginia (`remy-virginia`), next to Supabase, with zero-downtime deploys and no disk (#383, #406).
- **Database:** nightly encrypted backups to R2 (#391, #411), gzip on answers (#397), workspace cache in R2 (#381). We stay on Supabase Free: no new code may read a whole workspace per request or poll the database. The next migration number is `022_...`.
- **PostHog** on the website (#448): starts after sign-in on the live site only, skips guests and Do Not Track, replays mask all text and inputs, owners are never recorded.
- **Privacy page** updated from a legal audit (#399, #403).
- **AI notes:** lead threads write one file per piece of work in `docs/ai/status/lead/<slug>.md` (#410). Read that folder in every briefing.

## 4. Current rules

1. **Release rule (Nov 24, Dilan).** Only **brand-new features** (something Remy never had before) ship owners-only first, behind Admin → Feature releases, with a `shared/news/` note marked `owners: true`. **Bug fixes, fixes to existing functions and important improvements to existing features go straight to students,** with no owners-first switch and no staged rollout. Admin-only tools stay admin. Big new features get bundled into named releases every 3–4 months.
2. **Works everywhere (Nov 25, Dilan).** Every new feature, update or fix must work and look good on **the desktop website, the phone website and the phone app (`native/`)**. Each gets its own design: the phone site must feel like a real phone experience, and the app gets a native design. Never just embed or link the website in the app. Test on all three, then merge.
3. **Owner view.** Build, test, screenshot and mock up signed in as an owner with the toggle on owner.
4. **What's new.** Every PR that changes what people see adds `shared/news/YYYY-MM-DD-HHMM.ts` (UTC time now; copy the newest). Teammates' names stay out of student notes.
5. **Credit Julio.** Any PR that touches the interview coach credits you in the PR body and with a `Co-authored-by: Julio` trailer. That applies to your own PRs too: say what's yours.
6. **Auto-merge.** PRs merge once CI passes ("checks" plus a branch up to date with `main`). Only big or risky changes (migrations, secrets, auth) wait for Dilan. If a branch is behind, update it, wait for CI, then merge.
7. **Before you push:** `npm run check && npm run check:contract && npm test && npm run check:ai`, plus `check:resume` if you touched resume reading and `check:persist` if you touched the database or sessions.
8. **Coordination.** Start with `npm run ai:brief -- --me Julio`. Claim shared files in your own status file (at most 3 days, removed when the PR merges). Rewrite `docs/ai/status/julio.md` in every PR; `check:ai` fails without it.
9. **Commit as yourself.** An AI co-author line is fine.
10. **Never request Copilot review** on a PR.
11. **The repo is public.** No keys, personal emails, phone numbers or private notes in commits.
12. **Wording:** only "Free during beta" for pricing. Present RemyAI as a real company and product.
13. **Unchanged:** no invented claims (`server/ai/claims.ts`), nothing sent for the student, colours from tokens, every phone page works from 344 to 690 px, client calls the server only through `api()`, `save()` and `download()`.

## 5. Open right now

- **Open PRs:** #464 (lead, app sign-in in Expo Go). Not in your area.
- **Requests for you:** none.
- **Your claims:** none.
- **If you want a next step:** update your status file, then pick the first feature with Dilan. The interview coach on phones (phone site and a native app screen) is a natural one once the team wants to release Interview.
