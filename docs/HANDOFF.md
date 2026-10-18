# Offer Ready: Build Handoff (Oct 18, 2026)

## What changed
The old demo was a front-end prototype with preset data. This version has a real backend:
- Server-side accounts. Each user's workspace is private.
- A live AI model reads uploaded resumes and tailors them.
- A deterministic unsupported-claim checker.
- ATS checks.
- Real DOCX/PDF/TXT exports of approved versions only.

The visual identity is preserved: plum #4d2b6c, warm off-white, Satoshi + Cabinet Grotesk, and the Pip mascot.

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
| Mobile (375px) | Working | Bottom nav, Pip button, assistant closed by default on small screens |
| Hosting persistence | Limited | SQLite on the app's server. Fine for a demo; data may not survive a server rebuild. Ask users to download their documents |

## Remaining setup (team)
1. **AI credits.** Add about $5–10 at openrouter.ai/settings/credits; the site switches back to OpenRouter automatically. Without credits it runs on Gemini's free daily limits. Both keys pasted in chat should be revoked and replaced, then re-entered through the secure form.
2. **Google sign-in (optional but requested).** After the site is published to a `*.pplx.app` address:
   - In Google Cloud Console, open APIs & Services → Credentials → Create OAuth client ID → Web application.
   - Add the published URL under Authorized JavaScript origins.
   - On the OAuth consent screen, use scopes openid, email and profile, and set it to In production so judges can sign in.
   - Send the Client ID (not secret).
3. **Approval to publish**, plus a preferred subdomain (e.g. `offer-ready`).

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
1. **Welcome (15s).** "Offer Ready turns a student's real experience into a plan, the right openings and truthful applications." Click Explore demo.
2. **Onboarding (40s).** Use the sample resume (or upload one live). Show "Every bullet matches your original file word-for-word." Correct the class year, answer one AI question, and show the starting plan with real deadlines.
3. **Home (15s).** One next step, plus To-Dos, Events and Opportunities. Show that "View more" opens the right filter.
4. **Resume (75s).** Tailor for Evercore. Show the Strongest Match, a clean change with posting quote + evidence, and a flagged change ("adds detail that isn't in this entry"). Reject it. Show the [PERSONALIZE] gate blocking approval, fix it, approve, and download the PDF.
5. **Safeguard (20s).** In Checks, type "Managed a $250,000 portfolio using Python" and show the flags. Mention the real AI error log.
6. **Opportunities (15s).** Show verified vs. sample labels, the re-check link (Citi now flagged), and import a posting by URL.
7. **Follow-through (20s).** In Progress, load sample emails. A receipt is not an interview, and an ambiguous email stays "unclear". Confirm with evidence and export to calendar.
8. **Close (10s).** In Accounts, show AI memory being edited or deleted, and "Nothing is sent without you."
