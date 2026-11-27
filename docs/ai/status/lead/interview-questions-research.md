Research-backed Questions to expect (thread "Research real interview questions per company", Nov 27). Dilan doubted the per-company questions were correct and asked for heavy research.

Audit: `jobQuestions` (shared/jobInterview.ts) built every question from the posting's requirement keywords, plus "Why <company>" and "What questions do you have for us?", and the page title said "Questions <company> will likely ask" with no evidence. Nothing was role-specific or sourced.

Research: 37 public sources read (11 employer careers pages, 26 university career-office guides). Key finding: employers publish their interview FORMAT, not their questions; only McKinsey and Bain list real prompts. Notes in project files `interview-questions-research/`.

Built: `shared/questionBank.ts` (SOURCES, BANK per scoring guide + finance, COMPANIES format notes from employers' own pages). `jobQuestions` adds 2 sourced role questions, 1 company-listed question where the company publishes one, and a company format note on "Why <company>"; each question has `from` (posting/company/role/always) and `source`. Titles now "Questions to expect for this role" (web both views + app). `pickProfile` now catches cyber-security, tax, assurance, controllership, valuation titles. Interview stays owners-only.

Follow-up (same thread): `boilerplate()` in shared/requirements.ts drops scam warnings, benefits/EEO lines, company history and "The X team delivers" blurbs before skills are picked (`topSkills`), and `jobQuestions` skips them on openings saved earlier. On the 98 real postings: 11 of 153 requirement quotes were junk, with 0 false positives. For everyone.
