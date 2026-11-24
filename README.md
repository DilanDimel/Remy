# Remy

**An AI career coach for college students.** Remy is a fox who helps students go from "I don't know what I want to do" to an offer: he figures out where they stand, shows them the road ahead in their field, finds real openings, and gets their resume, cover letters and interviews ready, without ever inventing a single thing about them.

Built by RemyAI LLC, starting with students at TCU. Live at [remyai.org](https://remyai.org).

## Why it exists

Career centers are stretched thin, and most job tools either spam students with listings or write fake-sounding resumes for them. Remy is built around two ideas:

- **Show up every day, a little at a time.** A short daily round, a streak that forgives a missed day, and a clear picture of what freshman through senior year should look like in your field.
- **Honest by design.** Every AI suggestion is checked against the student's own resume and words. Remy never makes up a skill, number or title, never asks for passwords, and never sends anything on a student's behalf.

## What Remy does

**Home.** A personal start page: what to do today, deadlines coming up, openings worth a look, and Remy's read on how things are going.

**My Path.** A road map of the student's field: the roles, skills, exams and certifications that matter, the 10-year job outlook (BLS and O\*NET data), internship season timing, and a four-year board by semester. A daily round of a few real cards keeps it moving, and the weekly career quest adds bigger missions, levels and a streak.

**Resume.** Reads a PDF or Word resume (or LinkedIn's Save-to-PDF) into a profile the student confirms. First-years with no resume can build one by tapping through a guided builder. An ATS check scores the resume the way hiring software reads it, and a review explains what to fix.

**Opportunities.** Live student roles pulled straight from about 180 employers' own career sites (Workday, Greenhouse, Lever and others), plus federal roles from USAJOBS and the Labor Department's job search. Each opening says whether the student qualifies and why, and they can import any posting by link.

**Tailoring and cover letters.** Remy suggests changes for a specific posting, shown as the original line next to the proposed one, with the posting quote that motivated it. The student accepts, edits or rejects each change. Downloads keep their Word file's fonts and layout.

**Interview.** Practice questions built from the actual posting, with the resume line to answer each one. Practice out loud, build a story deck from past experiences, and polish a short pitch.

**Remy, the coach.** Remy lives in a side panel on every page. Students can chat with him about anything career-related, and he can take actions like adding a to-do or saving an opening. The Activity tab shows what he has done and lets them undo it.

**Community, Calendar and Progress.** Contacts the student adds themselves (an alumni directory is planned, not live), Google Calendar deadlines and interviews, a LinkedIn coach, a weekly check-in that turns what they did into resume lines, and an application tracker.

**Emails and texts.** Reminders, a weekly digest and sign-in codes by email, and optional text reminders.

**Owners' dashboard.** For the team: sign-up funnel and outcomes, errors and feedback, the beta list, server health and deploys, storage use, and a small team of AI helpers that suggest work for the board.

## How it's built

```
 Browser / iPhone / Android app
            |
   React + Vite front end  (client/)
            |   /api
   Express server  (server/)  ----  AI providers (OpenRouter, Gemini)
            |                  ----  employer career sites, USAJOBS, BLS
   Postgres on Supabase        ----  Supabase Auth, Resend email, Google Calendar
```

- **One TypeScript codebase.** `client/` is the React app, `server/` is the Express API, and `shared/` holds the types and logic both sides use.
- **AI with guardrails.** Every model call goes through one place that tries providers in order and enforces daily budgets. Every rewrite then passes a rules-based claim checker before the student sees it.
- **Data.** Each student's workspace lives in Postgres on Supabase. Public job postings are cached in a shared table with no student data.
- **Mobile.** The iPhone and Android apps are thin Capacitor shells around the live site, so every web update ships to phones at once.
- **Hosting.** Render runs the server and deploys every merge to `main`. GitHub Actions runs the type checks and 400+ tests on every change.

More detail is in [`docs/architecture.md`](docs/architecture.md). Setup, tests and configuration are in [`docs/development.md`](docs/development.md).

## Copyright and license

Copyright © 2026 RemyAI LLC. All rights reserved.

This code is proprietary. It is public on GitHub so people can see it, not so they can use it. No permission is given to copy, use, run, modify or distribute any part of it without written permission from RemyAI LLC. See [`LICENSE`](LICENSE) for the full terms. Infringement will be pursued, including through DMCA takedowns and legal action. For licensing questions, write to hello@remyai.org.
