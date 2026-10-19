> Superseded: this file describes QA of the original prototype. Current QA and status are in docs/HANDOFF.md (Oct 18, 2026).

# Remy demo QA

## Test contract

The demo must let a student follow a coherent profile, roadmap, opportunity and application journey. A private workspace stores edits on the running demo server; all school connections, academic plans, campus inventory and booking affordances remain clearly labeled examples.

## Functional inventory

- Navigation: all ten screens, desktop sidebar, mobile drawer, unknown route fallback and keyboard dialog dismissal.
- Setup: sample connection choices, contextual target question, visible notification defaults and completion.
- Profile: edits, preferences, resume text import, experience creation and second synthetic persona.
- Roadmap: create, complete, undo and remove a task; add a career experiment and campus activity.
- Opportunities: search, empty state, field filter, saved toggle, hard-constraint filter, detail explanations, source links, feedback and manual URL/text import.
- Applications: switch among three pairs; live generation; source comparison; edit, approve and remove claims; constructed unsupported-claim block; letter approval; downloadable text and DOCX; manual tracking and version log.
- Advising: reject sample class conflicts, store a tentative meeting, download ICS, add notes, generate live summary and approve tasks.
- Preferences: toggle notifications, digest choice, notification preview, data export and confirmed demo reset.
- AI: contextual chat, application generation, notes summary, loading state, visible failure state and usage limits.
- Scope: original brief and 155-node coverage download, actual activity log and disclosure of unimplemented integrations.
- Privacy: independent visitor workspaces; no browser storage, secrets in client bundles, fabricated connections or external outbound actions.

## Visual inventory

Review every screen at desktop 1440 × 1000 and phone 375 × 812. Inspect loading, empty, form, modal, selected, error and populated AI states; check overflow, contrast, readable secondary text, focus and mobile navigation.

## Exploratory checks

Test an unsupported claim, malformed or duplicate job URL, conflicting meeting time, unknown sponsorship and missing experience. Test desktop to mobile to desktop resizing with the same page and persistence after reload.

## Observed results

Verified October 17, 2026 on the running demo using synthetic QA visitors.

- TypeScript checking and production build succeeded.
- All ten screens were rendered at 1440 × 1000 and 375 × 812. Initial viewport width checks found no horizontal overflow. A route-scroll issue and mobile-drawer transition artifact were corrected; subsequent captures showed the intended page starts.
- Core browser flows passed: setup, live personalized questions, profile edits, resume text upload, experience creation, task create/complete/reopen/remove, career experiment, opportunity search/empty/filter/save/detail/source-link/import, application generation and review, exports, campus task, advising, notification preferences, persona reset and data/scope downloads.
- Live AI generated application drafts, contextual guide questions, onboarding questions and a meeting summary. Generated material remained unapproved until student review.
- Invalid sponsorship/credit matches were hidden when requested. Missing eligibility remained an unknown, not a positive eligibility claim.
- Text and DOCX applications downloaded and their content was extracted. The calendar file used the correct Central-time offset and contained no attendee invitation.
- Constructed unsupported claims blocked export. A separately observed AI overstatement was manually flagged and corrected through the UI.
- Class-conflicting meeting times were rejected. A valid tentative plan downloaded as an ICS; approved summary tasks appeared in the roadmap.
- Opted-out campus notifications stayed off after reload and did not appear in the unsent preview. No email or push was actually sent.
- Desktop to mobile to desktop navigation was exercised. The mobile drawer serialized true/false expansion states and supported creating/removing a task.
- A short desktop window exposed lower sidebar controls beyond the viewport. The sidebar now scrolls independently, so the guide and scope controls remain reachable without squeezing navigation.
- API regression tests passed for visitor isolation, blocked unapproved export, unsupported-claim rejection, approval invalidation after profile change, cross-visitor lookup rejection, time conflicts, non-HTTPS/duplicate imports, invalid input and complete scope/data export.
- No page-level JavaScript errors were observed during the tested flow. Small text contrast checks identified a navigation count below 4.5:1; its foreground was darkened.

## Actual observed AI issue

The original synthetic experience said: “Compared company financial statements in Excel, calculated ratios, and presented findings with a student team.”

A live application draft said: “Analyzed company financial statements in Excel to produce comparative ratio reports and presented findings to a student team.” Reports were not explicitly established; presenting with the team had also become presenting to the team.

The reviewer used Flag issue, observed that approval was blocked, then edited the statement to: “Calculated ratios in Excel, compared company financial statements, and presented findings with a student team.” The activity log retained the observation and correction. A later identical repeated QA flag is a testing repetition, not a second model error.

This is a real live-AI result on synthetic inputs, not the deliberate Salesforce/42% constructed guardrail test. It demonstrates the limits of keyword checks and the need for human review.

## Limits of verification

Tests do not establish comprehensive accessibility certification, degree-plan accuracy, every possible AI response, complete eligibility, production security or external integration permissions. Real school access, external notifications, advisor availability, application submission, exhaustive job aggregation and a production identity system remain out of scope. The inherited build-tool dependency audit still needs production remediation.
