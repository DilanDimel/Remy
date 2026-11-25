# Catch-up for Demetre's AI (written Nov 25, 2026, 09:20 UTC)

Your last status update was Nov 25, 00:40 UTC (main at `dee4a4c`, #413). Since then Dilan and the lead AI (Dilan's project Claude) merged about 35 PRs, many of them in your areas. Read this first, then run `npm run ai:brief -- --me Demetre` as usual, then rewrite `docs/ai/status/demetre.md` before your next PR.

Short version:
- **Your database work all shipped.** Backups (#391, #411), gzip (#397) and saved openings step 1 and 2 (#398, #419) are on `main`. `student_jobs` is set to **everyone** for every account.
- **The lead edited `server/platform/studentJobs.ts`** (your claim) to fix a big Supabase egress leak (#447). Keep that fix when you change the file.
- **Lead threads now edit `native/` too**, because your AI was out of credits. Eleven app PRs merged. Read the "Phone app" section before you touch `native/`.
- **There are no open PRs right now.** Nothing is waiting on you except cleaning up your status file and claims.

---

## 1. Database, storage and Supabase egress (your area)

### Saved openings (`student_jobs`)
- **Step 2 merged** as #419 (your branch `claude/project-thread-87dr74-jobs-everyone`).
- **Rollout went faster than your plan.** Dilan changed the release rule on Nov 24 (see section 4). Moving openings to their own table counts as an improvement to an existing feature, so it goes straight to everyone. On Nov 24 around 6:55 PM CT the lead copied all 26 accounts with SQL (1,397 openings, 0 differences) and set `site_settings.student_jobs = everyone` directly. There was no day of Owners-only reading.
- `workspaces.data.jobs` is **still kept** as the safety net. Removing it is still a later PR, after a few days with no problems. That PR is yours if you want it.
- **To roll back,** set the switch to `off`.

### The egress leak, fixed in #447 (in your claimed file)
- **What the lead found:** the Supabase counter showed **821 MB for Nov 24 CT**. The free plan needs under **about 160 MB a day** to stay under 5 GB for the cycle that starts Dec 18.
- **Cause:** with the switch on `everyone`, the openings read cache in `studentJobs.ts` lived only in memory. Each deploy (about 40 on Nov 24), plus the sweep that runs at startup, downloaded every student's openings again (`SELECT data FROM student_jobs`). That was 685 calls and about 10 MB a pass.
- **Fix (small and additive):** the openings copy is also kept, sealed, in the R2 bucket as `jobs/<sha256>`. The key is `copied_at|jobs_v`, because `jobs_v` restarts at 1 when an account is copied again but `copied_at` never repeats. `copyAll` and `syncJobs` also return `copied_at`, and `deleteCopy` removes the R2 file. Nothing is read from R2 unless the key matches the database row.
- **Rule from now on:** any new full read of openings or workspaces needs a cache that survives deploys. The workspace cache already lives in R2; the openings cache does now too.
- **Next lever (not started):** trim saved `postingText` in openings. Talk to the lead before you start it.

### Other database facts that changed or got confirmed
- **The server moved to Render Virginia** (next to Supabase), with zero-downtime deploys. The live service is `remy-virginia`; the old Oregon service is gone. Don't edit `render.yaml` until the old "Remy" blueprint is deleted.
- **No new migrations** since `021_deleted_accounts.sql`. The next one is `022_...`. Never edit a migration that has shipped.
- **We stay on Supabase Free.** No new code may read a whole workspace per request or poll the database. Raw SQL that edits `workspaces` must bump `updated_at`, or the cache serves a stale copy.
- **Your claims:** `studentJobs.ts`/`020`/`studentJobs.test.ts` (until Nov 28), `compress.ts` (until Nov 27) and `backup.ts`/`restore-backup.ts` (until Nov 28). The PRs behind them all merged, so **please remove those claims** in your next status update. Re-claim only what you are actively changing.
- **`storage.ts`** (the DB traffic report and `pruneLogs`) was not changed by anyone since your work.

## 2. Phone app (`native/`, your area)

Dilan approved a "fix-up" plan on Nov 25 and said there's no split while your AI is out of credits. Lead threads now edit `native/`. They keep **your design and structure**: they fix bugs, match the website and add missing features, one small PR each. They read your status file first and note every change in `docs/ai/status/lead/app-fixup.md`. Read that file for the details.

Merged (all straight to `main`):

| PR | What changed in the app |
|---|---|
| #423 | Jobs gets an Events filter (`upcomingEvents` in `native/src/lib/next.ts`), Show more (40 at a time; it was capped at 40), a sideways pill row, the Undo toast level with the fox (`aboveTabs` in `theme.tsx`), the Home streak row wraps under 390 pt, and spinners instead of blank screens. |
| #424 | Resume line edit (`EditLine`) and "Fix contact and dates" (`ContactDates`) as native sheets in `native/src/components/ResumeEdit.tsx`, saving via `PUT /api/resume/doc` with `base`. |
| #426 | Today's round is native: `native/src/app/round.tsx`, ported from the website's `DailyPath.tsx`. `go()` sends `/path?play=1` there. |
| #428 | Plan step sheet on My Path (`PlanStepSheet.tsx`). Jobs gets For you / Saved / Applied: Kept *shows* as Saved, but the internal key and test ids stay `kept`. Applied shows the Progress board (`Tracker`, now exported from `progress.tsx`). |
| #430 | "Did you apply?" nudge on Home (`ApplyNudge.tsx`). |
| #431 | Account and Remy's memory are native (`native/src/app/account.tsx`). |
| #432 | Email updates (`email.tsx`) and Hours (`hours.tsx`) are native. `go()` routes `/progress?tab=email|hours` there. |
| #435 | First open and sign-up: a welcome step, one email screen ("Get started with Remy"), a 6-box code that submits at 6 digits, terms as expandable rows, setup step names that match the website, and Review as tap-to-edit rows. |
| #442 | Android feedback: `Screen` bottom padding is now iOS inset+126 / Android 76, tab titles sit higher, Resume shows its top part with "Show the whole resume", the floating fox is the smiling `SCHOLAR_ICON`. |
| #443, #446 | Jobs swipe on Android. **Root cause:** in ReanimatedSwipeable, `dragOffsetFromRight` must be **negative** (`activeOffsetX: [right, left]`); `+30` grabbed every vertical drag. Now it's `dragOffsetFromLeft={24} dragOffsetFromRight={-24}`, swipe works on both phones, and `Screen` uses gesture-handler's `ScrollView`. Keep and Pass buttons are on every card. Dilan confirmed it works on his Android phone. |
| #445 | "Hear it" plays Remy's real voice (Arthur) under chat replies and the office guide line: `native/src/components/HearIt.tsx` → `POST /api/voice` → cached file → `expo-audio`. |

Still opening the website in a sheet: Build my path, profile editing, other sources, Delete everything, the Owners' dashboard, Interview and Community. The room colours in `tokens.ts` still differ from `client/src/index.css`; that needs a visual check before anyone changes them.

**Builds and updates:**
- **New native modules since your last build:** `expo-audio` (#445), plus `expo-document-picker` and `expo-image-picker` from your #414. Builds without them hide those buttons (`canSpeak()`, `canPickFiles()`, `canPickImages()`).
- **Lead threads now publish too.** JS-only changes go out over the air with `cd native && npx eas-cli@latest update --branch preview --environment preview --message "..." --non-interactive`. Leave out `--environment` and it fails. Android users reopen the app twice to get an update.
- **Latest Android preview APK:** Nov 25, 05:20 UTC, with `expo-audio`. There is no iPhone build yet; iPhone builds wait for an Apple Developer account.
- **The app is still owners-only** (the `app` switch in Feature releases).
- **PostHog isn't in the app yet.** `posthog-react-native` needs expo-device, expo-application and expo-localization, which means a new store build. It's planned for when the app is released to students.

## 3. Other things that merged (website and server)

- **#448, #450 PostHog on the website.**
  - **What it does:** `client/src/lib/analytics.ts` starts after sign-in on the published site only. It skips guests and Do Not Track / GPC. Replays mask all text and inputs and block images, and owners are never recorded. The server sends `$ai_generation` per AI call (model, tokens, cost, latency, feature; never the prompt or answer text) via `server/platform/posthog.ts`. "Did Remy help?" shows after a resume download.
  - **`shared/types.ts` changed** (2 lines, config for the PostHog key).
- **#434, #437, #439, #440 Remy's real voice.**
  - **New route:** `POST /api/voice` (`server/ai/voice.ts`, ElevenLabs, voice "Arthur", model `eleven_v4_turbo`). It returns MP3, caches each line in memory and sealed in R2, and allows 60 reads/hour per user, 1,000 characters max.
  - **No robot voice anymore:** the browser's `speechSynthesis` fallback was **removed** everywhere. If the voice fails, Remy stays quiet and the page says why.
  - **On the website,** playback goes through Web Audio so iPhones accept it.
- **#451 All student profiles for owners.** Admin → Students now lists every Google/email account, not only Founding Cohort, with counts (new today, 7 and 30 days, active, set up, resume). `students()` in `server/platform/beta.ts`; test `server/platform/beta-students.test.ts`. The app's Owners' dashboard opens this same page. (This was the "I can only see cohort people" problem.)
- **#422–#441 Phone website rework.**
  - **Layout:** phones get Home · My Path · Resume · Jobs · More tabs, with More as a tile sheet. Jobs is short rows that open as a sheet. My Path shows the office first. Calendar gets a week strip.
  - **First visit:** the "Get started with Remy" sign-in.
  - **Dead space:** removed under every tab.
  - **Details:** `docs/ai/status/lead/phone-web.md`.
- **#421:** Admin → System shows the real OpenRouter balance as "AI money left".
- **#416:** the microphone works on the site again (Permissions-Policy).
- **#444:** Privacy & terms layout tidy.
- **#418, #449:** marketing, voice and Instagram/LinkedIn skills for Claude sessions (`.claude/skills/`). Nothing changed in the app code.

## 4. Current rules (what changed for you)

1. **Release rule v2 (Nov 24, 6:44 PM CT, Dilan).**
   - **Owners-only first:** only **brand-new features** (something Remy never had before) ship owners-only, behind Admin → Feature releases.
   - **Straight to students:** bug fixes, fixes to existing functions and important improvements to existing features, with **no owners-first switch and no staged rollout**.
   - Admin-only tools stay admin. Big new features are bundled into named releases every 3–4 months.
2. **Works everywhere (Nov 25, Dilan).** Every update, feature or fix must work across **desktop and phone, the website and the phone app**. Test it on all of them and make sure nothing else breaks before merging. Dilan's own phone is Android; Demetre's is an iPhone.
3. **Auto-merge.** PRs merge as soon as CI passes ("checks" plus an up-to-date branch with `main`). Only big or risky changes wait for Dilan. If a branch is behind, update it, wait for CI, then merge.
4. **Commit author.** Commit as the person you work for. Lead threads commit as Dilan (`DilanDimel`, noreply address), and your commits stay as you. An AI co-author line is fine.
5. **Coordination (docs/ai).**
   - **Start every session with** `npm run ai:brief -- --me Demetre`.
   - **Claim** shared files outside `native/` in your own status file (at most 3 days, removed when the PR merges).
   - **Rewrite** `docs/ai/status/demetre.md` in every PR; `check:ai` fails without it.
   - **Lead threads** write one file per piece of work in `docs/ai/status/lead/<slug>.md` (not `lead.md`), so read that folder too.
6. **Test in owner view** (signed in as an owner, toggle on owner). Screenshots and mockups are in owner view too.
7. **Before you push:** `npm run check && npm run check:contract && npm test`, plus `check:persist` if you touched the database or sessions.
8. **What's new:** every PR that changes what people see adds `shared/news/YYYY-MM-DD-HHMM.ts` (UTC time; copy the newest). Teammates' names stay out of student notes.
9. **Never request Copilot review** on a PR.
10. **The repo is public.** No keys, personal emails, phone numbers or private notes in commits.
11. **Unchanged:** no invented claims, nothing sent for the student, colours from tokens, "Free during beta" wording only, every phone page works from 344 to 690 px.

## 5. What's open or claimed right now

- **Open PRs:** none (checked Nov 25, 09:15 UTC).
- **Requests for you:** none open. Your answers dilan-1 to dilan-5 are all done.
- **Your stale claims:** see section 1. Please remove them.
- **Ideas for your next work, if you want them:**
  - **Remove `workspaces.data.jobs`** once the `student_jobs` move has run a few days with no problems. That's its own PR; check egress before and after.
  - **Egress:** trim saved `postingText`.
  - **An iPhone build** once there's an Apple Developer account, and a store build that adds the PostHog dependencies.
  - **Tell the lead** (under "Questions for the lead") before you change any app screen the fix-up PRs touched. Lead threads are still working in `native/` and will read your status file before every change.
