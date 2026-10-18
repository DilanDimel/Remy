
## Run 2 — 2026-10-18, Evercore cover letter (live AI, gpt_5_1)
- Generated letter said: "my work-study position supporting a fast-paced office". The resume never says the office is fast-paced. This is an unsupported description, not a fact.
- The deterministic checker did NOT flag it; found during manual review of the exported PDF.
- Same run: the checker flagged "10" in "the 10-week program". That was a false positive because the figure comes from the posting.
- Fix: (1) a new scope check for workload descriptors (fast-paced, high-volume, high-pressure, demanding, rigorous, deadline-driven) unless the resume says so; (2) cover letters may cite figures that appear verbatim in the posting. Resume bullets remain strict.
- Unit replay: "fast-paced office" → flagged; "10-week program" with the posting → clean; "Managed 10 people" → still flagged.
- Change review in the same run: 6 proposed bullet changes. Two (work-study bullets) were flagged for added outcomes and rejected by the student. Four were accepted. Approval stayed blocked until the [PERSONALIZE] placeholder was replaced.

## Run 3: 2026-10-18, Deutsche Bank and Insight Partners (live AI, gpt_5_1). Reuse proof.
- The same workflow, with no code changes between roles, produced 6 bullet changes and a cover letter for each posting.
- **AI error the checker missed (Insight):** 3 of 6 rewrites appended detail that isn't in that resume entry:
  "…program focused on collaboration with business and community partners", "…raised $5,000 … through outreach to campus and community supporters", "…travel coordination with student participants and partner organizations". The v2 checker compared new words against the whole resume, so words that appear elsewhere (community, campus, partner) hid the additions.
- During testing these were auto-accepted by the test script (not a human), so Insight v1 was approved with them. This is a process error on our side and is recorded here.
- **Fix:** an entry-level scope check. Added content words are compared only against the bullet, its sibling bullets, role and organization. Posting words don't count as evidence. A replay over all 18 rewrites flags those 3, the Deutsche Bank "focused on professional growth and business exposure" rewrite, and the 2 Evercore work-study rewrites. The faithful rewrites still pass.
- Insight was re-reviewed: the 3 flagged changes were rejected and re-approved as v2 (v1 is kept in history).
- **Letter miss (Deutsche Bank):** "comfortable working with financial information and presenting it to others". There's no evidence of presenting. No check flagged it; it was found by human review, edited, and re-approved as v2.
- **False positives fixed:** the "access" skill term matched "expanding access" (now only "Microsoft Access" or "MS Access"). The same change was made for "word".
- **Lesson for the deck:** the deterministic checker narrows risk but doesn't replace the student's line-by-line review. That's why the UI requires an explicit Accept on every change.
