# Offer Ready: Build Handoff (Oct 18, 2026)

## What changed
The old demo was a front-end prototype with preset data. This version has a real backend:
- Server-side accounts. Each user's workspace is private.
- A live AI model reads uploaded resumes and tailors them.
- A deterministic unsupported-claim checker.
- ATS checks.
- Real DOCX/PDF/TXT exports of approved versions only.

The visual identity now integrates the Remy mockup: near-black `#161616` on warm off-white, fox orange `#E86A2A` as the accent, Plus Jakarta Sans + JetBrains Mono, and Remy the animated fox as the AI coach (replacing Pip).

## Remy integration (Oct 18)
- **Landing page:** Remy's "Don't Hunt for a Job Alone" card with five sign-in buttons. Google is the only real sign-in; LinkedIn, Apple, Microsoft and Work/School Email open a private guest workspace and say so.
- **Connect Your Accounts:** Remy's connector list (Resume, TCU, Stellic, Handshake, LinkedIn, email) with the spinner and status badges. Each "Connect" runs a real upload or paste import, so a row only turns green ("Imported") when data actually arrived. Nothing logs in to those sites.
- **Remy, the coach:** the fox from the mockup, animated (bob, blink, ear twitch, wave hello, head-tilt while thinking, hop on a new reply). Open on every page by default with a Minimize button; minimized, he docks as a fox button. On phones he starts minimized so he doesn't cover the page.
- **Workspace:** same structure and features; only the styling changed. The mockup's intake questions were not ported, since onboarding already has its own questions step.

## Status checklist

| Feature | Status | Notes |
|---|---|---|
| Explore demo / guest workspace | Working | Private per browser; a server-side workspace keyed to a secure cookie (or the preview visitor ID) |
| Continue with Google | Needs setup (Client ID) | Code is complete (Google Identity Services + server-side ID-token verification). It needs a Google OAuth Client ID for the published domain |
| Resume upload (PDF/DOCX/TXT/paste) | Working | Text extraction runs on the server. AI structures it, and every bullet is verified word-for-word against the file. There's a rules-based fallback |
| AI (all features) | Working (live) | Published at https://remy.pplx.app. AI tries OpenRouter first (Gemini 3.8 Flash, then GPT-5 mini) and falls back to the team's Google Gemini key (free tier, about 20 requests per model per day across 6 models). The OpenRouter account is currently out of credits |
| Tailored resume + cover letter | Working | Strongest Match, original vs. proposed wording, posting quote, evidence, flags, accept/edit/reject/confirm-true, personalize list, ATS checks, approval gate, versioned exports |
| Unsupported-claim safeguard | Working, not perfect | Catches invented numbers, skills, titles, class year, added outcomes and entry-level added detail. It missed 3 cases before fixes (see the AI error log). Human review is still required |
| Opportunities | Working | 5 openings verified Oct 17. Live link re-check. Import any public posting by URL or pasted text. Fit/eligibility/gaps. Citi is flagged Needs verification (its posting page returned 404 on Oct 18) |
| LinkedIn / Handshake / Stellic | Student provided (by design) | No direct connection: these sites require login and don't permit automated reading. Students upload a LinkedIn "Save to PDF" or paste text, and extracted facts wait for approval |
| Community outreach | Working (handoff only) | Drafts with exact recipient + full message review. Opens in the student's Gmail/mail app. Offer Ready never sends. Contacts are sample or student-added |
| Progress / email updates | Working (paste-in) | Rules + AI classify receipt vs. interview vs. offer, with the evidence sentence highlighted. Student confirms. Duplicate prevention and manual correction included. Inbox connection: Needs setup |
| Calendar | Working (export) | Month view, .ics export, per-item "Add to Google Calendar". No automatic sync |
| Accounts | Working | Profile edits mark approved documents for review (never rewrite them). Sources with honest labels. Editable/deletable AI memory. Theme. Data export/delete |
| Mobile (375px) | Working | Bottom nav, docked Remy fox button, Remy minimized by default on small screens |
| Hosting persistence | Limited | SQLite on the app's server. Fine for a demo; data may not survive a server rebuild. Ask users to download their documents |

## Oct 18 update: feedback round
- **Name:** the product is now **Remy** everywhere (Render service URL unchanged).
- **Blank screens:** every page and the Remy panel are wrapped in an error boundary, so one broken screen shows a "Remy hit a snag" card instead of blanking the app. Browser errors are sent to the server log (`client error …` lines in Render logs) so the cause shows up next time. The tailoring 500 from the free model's broken JSON is fixed by tolerant parsing.
- **Connect Your Accounts:** Resume and email are real. TCU, Stellic and Handshake are demo connections (connecting animation, labeled "demo connection"). LinkedIn is demo too until its Supabase provider is on, then it's a real LinkedIn consent (name, email, photo only; LinkedIn doesn't share work history).
- **Sign-in:** the landing buttons use Supabase Auth when a provider is switched on (see setup below); otherwise they open a guest workspace and say so.
- **Remy's questions:** a new onboarding step asks class year, graduation, regions, opportunity types and fields. Saved to the profile, editable in Accounts.
- **Opportunities:** ranked by eligibility, fit, region and type. Openings that definitely rule the student out (class-year or graduation rules) are hidden, with "Show anyway". "Only where I want to work" filter. 3-5 keywords on every card. "Why it fits you" is written to the student. Re-check moved into Details. **Find more openings** pulls live early-career postings from employers' public Greenhouse, Lever and Ashby job boards.
- **Resume:** class year and skills are extracted on upload. The original uploaded file is kept: PDF preview and download in Base resume, plus Export PDF/Word of the edited resume (Remy's clean one-column format; the original keeps its own layout).
- **Tailoring:** openings are listed automatically across the top (best fit first). Remy asks questions in his side panel before tailoring (why this company, what you want to learn) and after (each [PERSONALIZE] spot), then writes the answers into the letter. **Override letter check** approves anyway, removes unfilled spots and logs the override.
- **Calendar** is full width with taller days; Remy's chat box grows and takes Shift+Enter for new lines.

### Oct 18, second round
- **Sign-in fix:** Google and LinkedIn sign-ins succeeded at Supabase but the browser logged out of Supabase before our server checked the token, so Supabase answered "Session not found". The browser now logs out only after the server has verified it.
- **Tailoring is a conversation:** "Tailor with AI" opens Remy's chat; he asks three questions one at a time (type "skip" to skip), tailors, asks about anything still only you know, and writes it into the letter. Approving never blocks on personalization: leftover spots are removed. Unsupported claims still need an edit or an override.
- **ATS score:** a 0-100 score on Base resume (against your top openings) and on each application's Checks tab (base vs tailored), with a category breakdown and the fixes worth the most points.
- **To-dos** strike through and fade out a few seconds after you check them.
- **Account** moved out of the sidebar into the menu under your name (Profile, Settings, AI memory, Connected sources, Account & data, Sign out). The logo reads "Remy."

### Supabase setup (needed for real sign-in)
In the Supabase dashboard for "DilanDimel's Project":
1. **Authentication → URL Configuration:** set Site URL to `https://offer-ready.onrender.com` and add `https://offer-ready.onrender.com/` to Redirect URLs (add `http://localhost:5000/` for local testing).
2. **Authentication → Sign In / Providers:** Email is on by default (magic links; Supabase's built-in mailer allows only a few emails per hour, so add SMTP for real use). Turn on Google, LinkedIn (OIDC), Apple and Azure (Microsoft) as needed; each needs a client ID and secret from that provider's developer console, with the callback URL Supabase shows.
3. Render already gets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the public publishable key) from `render.yaml`. A button starts working as soon as its provider is on; no redeploy needed.

## Remaining setup (team)
1. **AI credits.** Add about $5–10 at openrouter.ai/settings/credits; the site switches back to OpenRouter automatically. Without credits it runs on Gemini's free daily limits. Both keys pasted in chat should be revoked and replaced, then re-entered through the secure form.
2. **Google sign-in (optional but requested).** For the published site at https://remy.pplx.app:
   - In Google Cloud Console, open APIs & Services → Credentials → Create OAuth client ID → Web application.
   - Add `https://remy.pplx.app` under Authorized JavaScript origins.
   - On the OAuth consent screen, use scopes openid, email and profile, and set it to In production so judges can sign in.
   - Send the Client ID (not secret).

## Competition evidence (in `docs/evidence/`)
- `ai-error-log.md`: real AI errors from live runs, what caught or missed them, the fixes and the replay results.
- `ai-run-2026-10-18-evercore-raw.json`: raw model output from the first live tailoring run.
- `pairs/`: 3 approved resume + cover-letter pairs (Evercore, Deutsche Bank, Insight Partners) in DOCX/PDF/TXT, plus `change-logs.json` with every proposed change, posting quote, decision, flags and ATS results.
- Reuse proof: the same workflow ran for three different postings with no code changes. Any public posting can also be imported by URL or text.

## Still needed from humans
- Consent from Dilan to show his real resume to judges. The phone and email are already removed.
- Real outreach contacts, if you want to show non-sample people (with their permission).
- The deck, the team narrative, and screenshots or a screen recording of the demo.
- Re-check every opening the day before the pitch. The Citi link is already broken.

## 3-minute demo script
1. **Welcome (15s).** On the "Don't Hunt for a Job Alone" landing page, Remy the fox waves. "Offer Ready turns a student's real experience into a plan, the right openings and truthful applications." Click "Or explore the demo without signing in".
2. **Onboarding (40s).** On Connect Your Accounts, connect the resume with the sample student and show the row go from Connecting… to Imported. Show "Every bullet matches your original file word-for-word." Correct the class year, answer one AI question, and show the starting plan with real deadlines.
3. **Home (15s).** One next step, plus To-Dos, Events and Opportunities. Show that "View more" opens the right filter.
4. **Resume (75s).** Tailor for Evercore. Show the Strongest Match, a clean change with posting quote + evidence, and a flagged change ("adds detail that isn't in this entry"). Reject it. Show the [PERSONALIZE] gate blocking approval, fix it, approve, and download the PDF.
5. **Safeguard (20s).** In Checks, type "Managed a $250,000 portfolio using Python" and show the flags. Mention the real AI error log.
6. **Opportunities (15s).** Show verified vs. sample labels, the re-check link (Citi now flagged), and import a posting by URL.
7. **Follow-through (20s).** In Progress, load sample emails. A receipt is not an interview, and an ambiguous email stays "unclear". Confirm with evidence and export to calendar.
8. **Close (10s).** In Accounts, show AI memory being edited or deleted, and "Nothing is sent without you."
