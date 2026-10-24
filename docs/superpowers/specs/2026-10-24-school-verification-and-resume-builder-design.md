# School email verification + Resume builder — design

**Date:** 2026-10-24 · **Branch:** feat/resume-system · **Status:** waiting for Dilan's approval

## Why

Remy is for **college students looking for jobs and internships**. The students who need the most help are
**freshmen**: most have never written a resume, so a "Upload your resume" first step stops them cold. The
same help should work for sophomores and juniors who have done things but never written them down. Seniors
aren't the focus.

Separately, TCU alumni are Remy's most valuable feature for TCU students, but today they unlock only when the
student signs in with an @tcu.edu address. Most students will tap "Continue with Google" with a personal
Gmail, so Remy never learns they're at TCU.

## Goals

1. Setup step 1 offers three ways in: upload a resume, upload a LinkedIn PDF, or **build a resume with Remy**.
   The sample student goes away.
2. A student can **prove they're a TCU student** by verifying their @tcu.edu email with a 6-digit code, from
   any sign-in method. Verified students see alumni; everyone else gets everything else.
3. A student with no resume and no LinkedIn finishes with **one honest, good-looking, one-page base resume** in
   about 10 minutes, without being asked dozens of questions. Every line comes from something they said.

## Non-goals (not now)

- Voice input (typing only for now).
- Reading LinkedIn profiles directly (the Save-to-PDF upload stays).
- Several different resumes per student. It's one base resume; tailoring per posting already exists.
- Cover letters (Section 4) and job-specific tailoring changes.
- Seniors-specific features.
- The "brain dump" (one big text box) input. Dilan isn't sold on it.
- Real TCU sign-in (Microsoft / TCU IT approval), Stellic and Handshake. The "Coming soon" line stays.

## Anti-goals (it fails even if it "works" when…)

- **Any made-up fact**: a number, title, award, employer or skill the student didn't give.
- **Generic resumes**: two students with different lives get near-identical text (the NACE "ghostwritten
  candidate" problem). The student must be able to defend every line in an interview.
- **An interrogation**: more than about 15 minutes or more than about 10 follow-up questions for a typical
  freshman.
- Students who already have a resume are pushed through the builder.
- Remy can be used to spam @tcu.edu inboxes, or alumni data reaches someone who isn't a verified TCU student.

---

## Part A — Setup step 1 cleanup (small)

- Remove **"Use the sample student (Dilan, shared with consent)"** from setup step 1. *(My call: also remove it
  from the other student-facing pages that show it; keep `/api/resume/sample` for local tests and scripts.)*
- Add a third way in, next to "Paste text instead": **"No resume yet? Build one with Remy (about 10 minutes)"**,
  which opens the builder (Part C). When the builder finishes, setup continues to step 2 (Review) exactly as if
  a resume had been uploaded.
- The LinkedIn box and the "Coming soon: TCU student account, Stellic degree audit and Handshake" line stay.

## Part B — Verify your school email

**What the student sees**

- Any sign-in method works (Google, email link).
- In setup step 2 (Review), the school is confirmed. If the school is TCU (the resume or the builder says
  "Texas Christian University" or "TCU", or the student picks it) and the account isn't already an @tcu.edu
  account, a card appears: **"Verify your TCU email to see TCU alumni"** → enter `name@tcu.edu` → **Send code**
  → enter the 6-digit code → **"Verified TCU student ✓"**.
- **Optional, not a wall.** "Skip for now" continues setup. The same card is on the Accounts page and in the
  Community alumni empty state, which today says "sign in with your @tcu.edu email".
- Accounts already signed in with an @tcu.edu address count as verified automatically (today's rule).
- Students at other schools never see the card.
- Accounts page shows "Verified TCU student · name@tcu.edu · Remove".

**Rules**

- Only addresses on the alumni domain list (`OR_ALUMNI_EMAIL_DOMAINS`, default `tcu.edu`) can be verified.
- The code expires after **10 minutes**, works once, and allows **5 tries**. Remy stores a hash of it, never the code itself.
- Limits: **3 codes per account per hour**, and **3 codes per @tcu.edu address per day** (so nobody can flood
  someone else's inbox).
- *(My call)* One @tcu.edu address can verify **one Remy account**. A second account gets "This TCU email is
  already linked to another Remy account. Sign in with that one." This stops one TCU student sharing alumni
  access with friends.
- Verification is tied to the **email domain**, not the school field. Changing the school field doesn't remove it.
- The verified address is deleted with the account, like everything else.
- Alumni access = signed in **and** (account email on the domain list **or** a verified school email).

**Server sketch** (builder decides the details)

- `POST /api/school-email/start {email}` → validate domain, check limits, create code, send email.
- `POST /api/school-email/verify {code}` → check, mark verified.
- `DELETE /api/school-email` → remove.
- New migration: verified school email + verified-at on `users`, plus a small table for pending codes.
- `alumniOk` in `server/routes.ts` also accepts a verified school email.

**Sending the email** needs a real sender (same need as the Supabase email item on Dilan's to-do list).
*(My default)* Send through the team's shared Remy Gmail with a Google "app password". It's free, sends
about 500 a day, and needs no domain. Switch to a service like Resend once Remy has its own domain. Until a
sender is set, the card says verification is coming soon instead of failing.

**Before real students see alumni:** the career office still has to approve using the alumni list (open item on
Dilan's to-do list). Verification can ship first. Alumni stay limited to verified students either way.

## Part C — Build my resume with Remy

**Who it's for:** freshmen first; it also works for sophomores and juniors. **Output:** one honest one-page
base resume that becomes the student's base resume, so ATS scoring, openings and tailoring all work on it.

### The flow

**0. What Remy already knows (never asked twice).** Name and email come from sign-in. Phone and city are
optional. School, major, expected graduation and class year are asked here once and saved to the profile, so
setup doesn't ask them again. GPA is optional. *(My call)* A short hint says career centers suggest listing it
when it's 3.0 or higher. Freshmen and sophomores also get high school name and graduation year.

**1. "What have you done?": tap, don't type.** One screen of buttons, several can be picked, each marked "in
high school" or "in college":

- *Work:* a job · an internship · babysitting / tutoring / pet sitting · family business · your own side hustle
- *School:* a big class project · research · awards / honors / dean's list
- *Activities:* a club or organization · a sports team · church or youth group · volunteering ·
  music / theater / art · Greek life
- *Skills:* a language other than English · a certificate (CPR, Excel, Bloomberg…)

This jogs their memory: most freshmen don't realize these count. **Remy only asks about what they tap.**

**2. One short card per thing they tapped.** Place or organization · their role (suggests "Member" when there's
no title) · when (start–end or "now") · city. Then: **"What did you do there? A sentence or two is fine."**
"Add another" handles two jobs or two clubs.

**3. At most 2 follow-ups per card, only for what's missing.** Remy reads the card and asks only where a resume
line needs something specific:

- *scope:* "Roughly how many kids did you coach?"
- *result:* "What changed because of you, or what are you proud of?"
- *tools:* "What did you use: Excel, Canva, a register system?"

Every follow-up has "Not sure / skip". *(My call)* About 10 follow-ups total per build, spent first on the
entries that matter most for the student's field.

**4. Skills.** Remy suggests skills **only from what they mentioned**, plus a short tick list (Excel,
PowerPoint, Google Sheets, languages). A skill goes on the resume only if the student ticks it.

**5. The draft.** Remy writes the resume using **only the student's answers**:

- Bullets start with an action verb. Nothing is invented: no numbers, titles, organizations, awards or skills
  the student didn't give.
- Where a number would make a bullet stronger but the student didn't give one, the bullet shows a visible blank
  like **`[how many customers a shift?]`** for them to fill in or delete. Blanks are highlighted and must be
  filled or removed before the resume is saved.
- **Every bullet shows where it came from.** Tap it to see "from your answer: *'I trained the new hires'*".
- Each bullet goes through the existing honesty check (`claimCheck` in `server/claims.ts`), with the student's
  answers as the evidence. Anything flagged is rewritten or dropped.

**6. Wording choices.** For each bullet, 2–3 phrasings to tap between, plus free editing. These are different
wordings of the same facts, not different facts.

**7. Section order fits their year** (education always first, per career-center guidance):

- *Freshman / sophomore:* Education (college, then high school) → Experience → Activities & Leadership →
  Projects → Skills. High school entries allowed.
- *Junior and up:* high school entries are left out by default (a switch keeps them) → Experience → Activities &
  Leadership → Projects → Skills.
- Empty sections are left out. The whole resume fits on one page.

**8. Save.** It becomes the base resume (`BaseResume` with a new `parsedBy: "builder"`, `fileName: "Built with
Remy"`, `rawText` = the compiled text). The student's answers and each bullet's source are kept in the workspace
so they can come back and add things later. Download as PDF / Word uses the existing export.

**Progress saves as they go.** Leaving mid-way and coming back uses the existing welcome-back screen.

### AI use

A handful of calls per build, through the existing AI helper and model: follow-ups per card, one draft call, and
wording options. *(My call)* If the AI is down, Remy still builds a plain draft from the answers by rule, so the
student isn't stuck.

## Testing

- Verification: code expiry, 5-try limit, single use, per-account and per-address limits, the one-address-one-account
  rule, alumni access with a verified school email vs. without.
- Builder: built bullets contain no number, title or organization missing from the answers (`claimCheck`);
  blanks block saving; section order by class year; high school dropped for juniors; the result loads as a base
  resume and gets an ATS score.
- Live run on the preview with a freshman-style test account and modest AI use.

## Build order

A (small) → B → C, one section at a time: test, report, then wait for Dilan's go-ahead before the next.
This slots in ahead of the planned Section 2 (ATS). The builder's bullet wording and honesty machinery will
be reused in Section 3 (base resume improvement).

## Needs from Dilan

1. **An email sender** for verification codes: the shared Remy Gmail's app password, or another choice.
2. **Career-office permission** for the alumni list before real students use alumni (already on the to-do list).

## Left to the builder

Exact screens and copy, table and column names, prompt wording, how follow-up questions are chosen within the
~10 budget, and the rules-only fallback draft.
