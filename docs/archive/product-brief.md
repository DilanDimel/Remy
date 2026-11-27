# Remy: Replit MVP Build Brief

This is the product and design contract for a working competition MVP, not a request to build an entire university ecosystem at production scale. The full 155-item inventory appended to the final brief preserves the source ideas, explanations, and status labels without deletion.

## Why the prompting package is structured this way

Replit recommends outlining features and user flows before building, being precise about outputs and edge cases, supplying relevant files/examples, and building incrementally with checkpoints. ([Replit effective prompting](https://docs.replit.com/learn/effective-prompting.md)) Its Agent guidance also emphasizes reviewing plans, testing the result yourself, and providing focused feedback rather than treating a generated first draft as finished. ([Replit Build with Agent](https://docs.replit.com/learn/build-with-agent.md)) Plan mode provides planning without modifying code/data until approval. ([Replit Plan mode](https://docs.replit.com/features/agent/plan-mode))

Accordingly, read this brief as persistent context, propose a plan, and implement approved slices. Do not dump all 155 ideas onto the homepage or attempt every external integration before the core journey works.

## Product problem and purpose

- **Problem:** Students lack a connected, personalized view of how academic choices, campus experiences, eligibility, and career opportunities fit together, leaving them unsure what to pursue or what to do next.
- **Mission:** Help TCU students turn their background, academic journey, and interests into informed career decisions and practical next steps through connected information, authentic AI guidance, and human support.
- **Goal:** Build a student-controlled career companion that connects authorized context, asks relevant questions, and helps students explore, prepare for, and pursue suitable opportunities.
- **Vision:** Students understand their options, make purposeful use of TCU, and adapt as interests and opportunities change.
- **Student promise:** Know your options. Understand your next step. Build a path that is yours.
- **Values:** Authenticity, student agency, curiosity, connected clarity, privacy, and human support.

These statements are working drafts. Do not present the app as officially endorsed by TCU or use protected university marks without permission.

## Scope contract: preserve all ideas without faking an ecosystem

Every inventory ID must appear in `docs/mindmap-coverage.csv` with original title, original status, assigned disposition, route/component or documentation location, dependency, test, and implementation state.

Use five dispositions:

- **Functional MVP:** App-owned workflows genuinely work and persist.
- **Demo adapter:** A useful simulation with clear labels, seeded data, and the same interface a future authorized provider would implement.
- **Future scope:** Retained in architecture and a private product-roadmap document, not falsely advertised as complete.
- **Product context:** Audience, problem, mission, values, and team process reflected in design/docs rather than incorrectly implemented as a feature.
- **Open decision:** Explicit assumption and owner; a proposed default is not a new team decision.

This mapping is a proposed implementation interpretation. Retain the original statuses such as team direction, consultant recommendation, and parked discussion. The team can override priorities after reviewing the plan.

### Working MVP priorities

- **P0 functional:** Profile editing, contextual intake, student preferences and notification setup, actionable career/semester roadmap on limited labeled data, opportunity filters/explanations, Application Studio, three application pairs, claim/change review, task/status tracking, approvals, exports, feedback, persistent storage, responsive UI.
- **P1 bounded functional:** Role/task exploration, campus directory/recommendations, advisor-summary-to-task workflow, calendar conflict suggestions on permitted/synthetic records, notification previews, personal progress history. Complete these before expanding optional features; integrate them through the same core journey rather than separate mini-apps.
- **Demo adapters initially:** TCU/SIS, Stellic/degree audit sync, institutional advising records/booking, private Handshake and LinkedIn profile data, Outlook availability/sending, and GitHub account connection unless supported authorization is actually available.
- **Future/conditional:** Institutional-scale scheduling, exhaustive degree audits across programs/catalogs, production proactive email/push, wider industry coverage, richer community matching, interview coaching, robust long-range forecasting, and real provider integrations.
- **Parked:** Employer marketplace and aggregated-data sales. Preserve them as unapproved historical ideas in private product notes. Do not implement data sales, tracking for resale, employer accounts, or imply team approval.

Do not use demo adapters to bypass the competition requirements: the final competition evidence still needs real verified public openings, the required application sets, a reusable AI build, and the team's actual process/error documentation.

## Primary user stories and end-to-end example

- **A freshman finance student:** Wants to understand potential careers, what classes teach, which campus experiences could help, and what to do next without being assigned a predetermined life path.
- **A student preparing applications:** Wants broader public-source discovery, suitable roles, a Strongest Match, and truthful tailored materials without repeated manual rewriting.
- **A student with eligibility constraints:** Wants relevant year/location/authorization constraints respected, with unclear requirements shown as unknown rather than guessed.
- **A student returning from advising:** Wants permitted meeting notes translated into editable tasks and followed up without losing the advisor's nuance.

Seed two synthetic profiles: a freshman finance student exploring careers and a more experienced student targeting a marketing or analytics internship. Include relevant constraints in the data but do not infer nationality, citizenship, or authorization from names or schools.

Example journey:

1. The student opens a clearly labeled demo or signs into a properly secured account.
2. They choose data sources, review the proposed information access, and authorize an available provider or load an explicit demo import.
3. Imported major/year/course/project context appears with source and sync status. They can edit it.
4. The assistant asks 3–5 context-specific clarification questions, not a generic wall of inputs.
5. The student chooses interests and practical constraints, then sees all proposed notification categories/defaults and can disable them.
6. Today presents a few useful next steps, a roadmap milestone, and a suitable opportunity with reasons.
7. The student explores a path, adds an optional campus activity, and prepares a tailored application.
8. Application Studio explains changes and evidence; the student resolves flagged claims and approves output.
9. An advisor meeting can be suggested; a permitted summary later proposes tasks for review.
10. Feedback changes that student's preferences or guidance with a visible explanation.

## Professional UI and design direction

Build a premium student-planning workspace, not a generic recruitment dashboard or chat-only product. It should feel calm, trustworthy, editorial, and carefully finished.

### Visual system

- **Palette:** Deep plum `#4D2B6C`, warm ivory `#F7F6F3`, white surfaces, charcoal `#272131`, muted lavender `#EEE8F3`, and restrained sage for positive states. These are chosen design colors, not a claim of official brand compliance.
- **Typography:** Satoshi or General Sans for interface/body; Cabinet Grotesk or the same family with strong weight contrast for headings. Load only necessary fonts and provide fallbacks. Avoid oversized dashboard headlines.
- **Composition:** Desktop sidebar around 232px, compact context header, generous 24–32px section spacing, 8px-based spacing system, readable 14–16px body text, one clear primary action per view.
- **Surfaces:** Thin neutral borders, subtle elevation, varied but restrained corner radii, clear selected states. Keep the interface predominantly light. Avoid gradients, neon, generic stock-photo heroes, floating blobs, emoji icons, fake testimonials, and repeated decorative metric cards.
- **Icons and motion:** Consistent Lucide-style icons with text labels/tooltips; restrained transitions around 120–180ms and reduced-motion support.
- **Content:** Specific student-centered copy. “Why this fits,” “What to confirm,” and “Your next step” are better than unexplained scores and vague AI language.
- **Accessibility:** WCAG AA contrast, visible focus, keyboard operation, semantic controls, labeled form fields, useful error messages, 44px touch targets, and status information that does not rely on color alone.
- **Responsive:** Test 1440px desktop, 768px tablet, and 375px phone. Collapse navigation sensibly; stack comparison panels on mobile without losing source/evidence links. No accidental horizontal page overflow.

### Today screen composition

Use an asymmetric workspace: a broad next-action/roadmap area and a narrower upcoming-events/advisor area. Show a small selection of ranked opportunities below, not dozens of cards or eight decorative KPIs.

Lead with something actionable, for example: “Explore two finance paths” or “Review the evidence for this application.” Avoid claiming a student has never used advising merely because the connected data is incomplete.

Build the Today screen and one mobile view to establish the design before replicating it.

## Screen map and functional requirements

### Onboarding, profile, and connections

- Start with a short introduction and a transparent demo option. Reuse a supported authentication mechanism or implement secure sessions; do not invent TCU SSO.
- Connection cards: TCU academic profile, Stellic/planning, advising records, Outlook/calendar, LinkedIn, Handshake, GitHub/portfolio, and resume upload/manual entry.
- Each card distinguishes: not connected, demo data loaded, authorized live connection, sync failed, incomplete coverage, and disconnected.
- Show purpose, requested fields, permissions, last sync, provenance, and revoke/disconnect controls. Never request university passwords or browser cookies.
- Resume upload supports reasonable size/type limits and parsing errors, with paste-text/manual fallback. Let students confirm imported facts.
- Store an editable experience bank: project/job/activity, dates, actual contribution, tools, outcomes only if known, and source/evidence reference.
- Ask questions grounded in available context. Do not invent GPA, accomplishments, or intent.
- Collect year, major, goals, time/location/pay preferences, target fields, and relevant optional eligibility information.
- At account creation, ask notification preferences and clearly show the complete proposed default set “unless you turn it off.” Allow immediate opt-outs and later editing. Do not silently add categories later.

### Today and contextual assistant

- Summarize relevant goals and a short set of next actions with “why this matters” and source/uncertainty labels.
- Persist task add/edit/complete/defer/delete actions.
- Use an embedded assistant panel that understands the current screen and student-approved context. Offer targeted actions, not an unbounded generic chat replacement for the UI.
- The assistant may propose profile edits, tasks, drafts, or bookings; actions requiring external effects go through a preview/approval step.
- Keep generated proposals separate from completed actions. Never mark a draft as sent, applied, booked, or officially approved.

### My Path: career and semester roadmap

- Offer semester/career views backed by the same goals/tasks, not duplicate disconnected state.
- Explain career titles, typical tasks, skills, related coursework, campus experiences, projects, and certifications.
- Allow exploratory paths, optional experiments, and comparison of alternatives. The student can change direction.
- Display what a class teaches and how it relates to skills; attach source/catalog context when claiming a real TCU requirement.
- For the MVP, use a limited documented course set or explicitly illustrative academic data. Never invent official course numbers, prerequisites, meeting times, or graduation guarantees.
- Check known dependencies/conflicts within the supported data. Mark future offerings as confirmed, historical, assumed, or unknown.
- Route official substitutions, exceptions, graduation clearance, and uncertain requirements to advisors.
- Interpret the board's undefined “dynamic focus” as a proposed next-actions view until the team confirms a more specific meaning.
- JobsGPT-inspired role/task and AI-impact exploration is optional and clearly speculative. Include human skills, curiosity, and tool experimentation; do not present AI exposure as certainty that a job will disappear. The mentor-supplied reference is [JobsGPT](https://smarterx.ai/jobsgpt); it is inspiration, not a confirmed integration.

### Opportunities: discovery, filters, and reasons

- Support a target role/field, public employer-career pages, and permitted public postings. Specialized interests such as quant roles and employer-direct discovery must remain represented.
- Use a bounded retrieval/search adapter. When a live provider is available, perform real server-side retrieval; otherwise provide a verified-curated set plus user-imported public posting text/URLs with clear limits. Do not represent a saved fixture as a live internet search.
- Store URL, provider/source, retrieved/last-checked time, posting status, title, company, location, pay if stated, deadlines if stated, and 3–5 emphasized qualifications/keywords.
- If no current source is available, display “sample/needs verification,” not “currently open.” Do not invent jobs or source links.
- Filter on role, industry, year/graduation window, location/remote, job type, compensation when known, and relevant student-confirmed eligibility.
- Separate hard constraints from preferences. Let students weight preferences and show why ranking changes.
- Distinguish work authorization, future sponsorship, and citizenship/security requirements. Do not use nationality as a proxy. Unknown posting terms remain unknown.
- Show Strongest Match, supporting student evidence, material gaps, requirements vs preferences, and actions to clarify.
- Support jobs, internships, campus work, and a work-study category. Eligibility for work-study itself must not be assumed.
- The Textron and quant examples explain the team's motivation; they are not proof that a competitor has no relevant listings.

### Application Studio and tracking

- For one sample profile, support at least three openings and three separate tailored resume/cover-letter pairs.
- Use the same structured workflow for another student and target field; avoid hardcoding output for one persona.
- Show original text → proposed text → exact relevant posting excerpt → student evidence/source → rationale → approval state.
- Reword and reorder real experience; do not invent credentials, dates, skills, numbers, results, leadership, or employer relationships.
- Unsupported claims become flags. Student-confirmed new information can update the experience bank before regeneration; a posting is not evidence the student has a skill.
- Allow accept/edit/reject, voice adjustments, document versioning, and manual corrections.
- Flag cover-letter details the student should personalize, such as a specific personal story or verified addressee.
- Keep resumes ATS-readable with clear headings and plain structure. No guaranteed ATS pass, hiring probability, or fabricated recruiter score.
- Provide real, tested plain-text and editable DOCX exports if feasible; a plain printable PDF can be additional. Required outputs must not be screenshots or empty download buttons.
- Track saved/preparing/ready/applied/interview/closed statuses. Generating or exporting an application does not mark it applied.
- “Bots sorting out TCU applications” is unresolved language. For this MVP, propose a controlled organization/preparation assistant; no autonomous mass applying.
- Optional extension: one evidence-based interview question tied to the Strongest Match.

### Campus, advising, and calendar

- Campus view recommends relevant clubs, events, fairs, projects, certifications, and optional exploration tasks, with next steps and source dates.
- Clearly label synthetic campus examples; do not invent official events, meetings, or certifications.
- Preserve community connections initially as a resource/directory concept, not an unsupported new social network.
- Advising view shows relevant recorded past/upcoming sessions only within the connected system's known coverage.
- Suggest meetings based on context. If data is incomplete, ask whether a meeting happened rather than state it did not.
- Check student class/calendar conflicts and advisor availability separately. Free student time alone is not a confirmed advisor slot.
- Without live authorized booking, provide a proposed appointment request and a genuine downloadable ICS event labeled tentative/demo as appropriate. Do not say an advisor was booked.
- Preview attendee, time zone, time, purpose, and message before an approved external action.
- Accept permitted notes/student summaries. Generate an editable meeting summary and suggested tasks; ask for confirmation before altering commitments.
- No automatic recording or private-note access without appropriate permission.

### Notifications and feedback

- Proposed notification types: recommended opportunities, application deadlines/follow-ups, advisor appointments, roadmap tasks, campus events, and weekly progress. Treat this as a proposed list, not a previously approved team default.
- Present defaults transparently during onboarding and let the student disable categories. Persist changes and apply them to previews and actual scheduling logic.
- Allow frequency/channel settings as a useful extension. A digest should contain relevant actions, not just a personalized greeting.
- Include advance event reminders where the student selects them. Avoid fabricating deadlines for events that have none.
- With no configured sending provider, show in-app/preview notifications and clearly identify unsent drafts.
- Persist explicit reasons for rejecting opportunities or edits and use those reasons in subsequent ranking/guidance.
- Keep caching of public research separate from student-specific learning; revalidate time-sensitive content and never cross-contaminate private profiles.

## Data, AI, and engineering expectations

Agent may choose an appropriate Replit-supported stack. Prefer a coherent typed full-stack application, reusable components, server-side validation, and a persistent relational database over excessive services.

- **Suggested entities:** User/session; StudentProfile; Consent; ConnectedSource/SyncStatus; ImportedFact; ExperienceItem; CareerInterest; Course/Requirement/Source; Goal/Task; CampusOpportunity; JobPosting/Requirement; MatchExplanation; ApplicationVersion/Claim/Evidence/Review; AdvisorMeeting/Summary; CalendarItem; NotificationPreference/NotificationDraft; Feedback; AIExecutionLog.
- **Provenance:** Store source type, source reference/URL, recorded or checked time, coverage, confirmed/demo state, and confidence where meaningful.
- **State:** Persist app-owned edits and statuses across reloads; enforce user ownership on all reads/writes. A resettable demo environment must use synthetic data and prevent leaking another user's changes.
- **Provider boundaries:** Use interfaces/adapters for school records, public discovery, calendars, messaging, and AI. Provider availability should not dictate whether the whole app starts.
- **AI configuration:** Prefer an available secure server-side integration. Read provider credentials only from secrets/environment. Validate structured output and handle failure/timeouts gracefully.
- **AI-disabled mode:** If no provider is configured, label deterministic example responses explicitly as demo, not live AI. Explain that this alone does not satisfy the reusable AI competition requirement.
- **Action safety:** An AI response may suggest a state change but cannot silently execute bookings, emails, applications, or official record changes. Use confirmation and an audit event for approved actions.
- **Data security:** Minimize sensitive fields, avoid sensitive content in logs, enforce authorization, validate uploads/URLs, protect public URL retrieval from private-network access, and never ask for pasted passwords/tokens in chat.
- **Interpretation:** Source-traceability is not independent verification of self-reported experience. Human review remains part of the workflow.
- **No hidden monetization:** No selling student data or training on private records. Retain the historical idea only in private roadmap documentation pending explicit approval and review.

## Sample data and demo honesty

Use plausible synthetic profiles, projects, classes, and meetings with clear “illustrative” labels. Do not attach invented achievements to real students or invented requirements/events to TCU.

For final case evidence, obtain at least three real current public openings for the target field and verify their pages. Keep fixtures separate from that verified set. Report source and check time, and mark closed/unreachable roles honestly.

Use relative demo dates so an event does not accidentally appear current when stale. Display the student's chosen time zone, defaulting to America/Chicago for this scenario; store consistent timestamps and test daylight-saving transitions.

## Build sequence and approval gates

### Plan

Before coding: return scope/dispositions, routes, data model, stack choices, dependency boundaries, stage sequence, and test plan. Ask only blocking questions. Wait for approval.

### Foundation and one designed screen

Implement sessions/demo mode, schema, synthetic data, design system, navigation, and functional Today screen. Review desktop/mobile screenshots, state changes, error handling, and persistence before expanding.

### Context and roadmap

Implement onboarding, demo imports/fallbacks, questions, notification settings, profile/evidence editing, career exploration, and roadmap. Check context-driven behavior and source labeling.

### Opportunities and applications

Implement retrieval/curation/import path, filters, unknown handling, Strongest Match, all three application pairs, review/versioning, and exports.

### Advisor and follow-through

Implement campus, advisor/meeting-summary, calendar/request-preview, feedback, and notification previews. Test approval boundaries.

### Validation and handoff

Run the test suite and visual QA, inspect exports, complete coverage mapping, checkpoint, and report actual status. Preserve previously accepted design when adding features.

## Acceptance tests

Every test must have a real result, not a claimed pass without running it.

1. **Contextual intake:** Given a finance profile with sample coursework, onboarding asks relevant clarification questions and lets the student correct imported facts.
2. **Persistent changes:** Given a saved goal/preference/task, reload retains the change for that user.
3. **Transparent import:** Loading a sample school profile displays “Demo data,” not a successful university login.
4. **Incomplete records:** A failed advising sync produces an uncertainty/clarification state, not “you never met an advisor.”
5. **Eligibility:** Given an explicit year restriction incompatible with the profile, explain/exclude appropriately; missing sponsorship text remains unknown.
6. **Preference weights:** Changing a preference changes eligible rankings with visible reasons; hard constraints are not overridden by a high soft score.
7. **Public sources:** An opening includes a real source and check status; fixtures and stale/unreachable links are not labeled current.
8. **Three application pairs:** Three selected jobs generate separate resumes and cover letters using one confirmed base profile.
9. **Change trail:** Every material revised claim links to the relevant posting requirement and student source.
10. **Unsupported claim:** An injected unsupported skill or changed date is flagged; export remains blocked until addressed or removed. Test limitations honestly rather than claim universal detection.
11. **Student voice:** Editing or rejecting wording updates the approved version without changing underlying facts.
12. **Downloads:** Exported resume/letter files open, contain the correct selected version, and use simple readable structure.
13. **Reuse:** A second profile and target role yield relevant outputs through the same workflow, not first-profile-specific text.
14. **Roadmap:** A confirmed task/career interest updates relevant planning views without inventing official academic requirements.
15. **Advisor follow-through:** An approved meeting summary creates editable proposed tasks; unapproved text does not become a binding commitment.
16. **Scheduling:** A conflicting time is flagged; absence of advisor availability prevents a confirmed-booking claim.
17. **Outbound control:** Requests/invites/messages remain previews until authorized. ICS downloads do not imply someone received an invitation.
18. **Notifications:** Turning off a category persists and prevents its scheduled preview/send; the onboarding summary matches actual preferences.
19. **Feedback:** An explicit location/interest correction changes future recommendations, with a visible record.
20. **Privacy:** Two users cannot retrieve each other's profiles, resumes, notes, drafts, or logs.
21. **AI failure:** Timeout or missing credentials shows useful recovery and demo labeling, not invented completion.
22. **Prompt injection:** Job postings and uploaded content are untrusted data; text inside them cannot override system rules, reveal secrets, or send messages.
23. **Responsive/accessibility:** Main screens function by keyboard and at 1440/768/375 widths, with readable contrast, usable touch targets, and no accidental overflow.
24. **Coverage:** Every one of the 155 inventory IDs has a documented disposition and location; none silently disappears.

Also test empty states, no matches, duplicate imports, invalid/oversized files, missing pay/deadlines, disconnected providers, long names/descriptions, and time-zone display. Fix console/server errors and broken navigation.

## Competition evidence and delivery

- Export or document the student profile, verified job shortlist, Strongest Matches, three resume/letter pairs, before/after comparisons, and source/evidence references.
- Include reusable prompts/workflows, actual tools/configuration, and the team's AI log. Document a real observed AI mistake and correction; a constructed adversarial test is useful but not a substitute.
- Provide a deck outline/appendix packet and an honest 2–3-minute suggested demo sequence; presentation/video limits still require organizer confirmation.
- The supplied judging rubric has seven equally weighted categories scored 1–4, totaling 28; some case documents refer to 100. Do not invent a reconciled scoring method.
- Report goals as measured demo outcomes, not claims of more offers or better hiring rates. Suggested goals: complete a meaningful next action, prepare all three application sets, explain every material change, preserve preferences, and have zero unresolved unsupported claims in approved exports.
- Finish with setup/run instructions, secure provider configuration guidance, tests actually run, coverage CSV, known limitations, live/demo/future table, and next steps. Do not publish the site or send real messages without user authorization.

## Full source inventory follows

The annex retains exact titles, notes, source statuses, hierarchy, and IDs for all 155 non-root nodes. Use the inventory for traceability; do not convert all nodes into separate screens or treat every contextual statement as a feature.


## Lossless mind-map inventory: all 155 items

**Original center node:** Remy. A connected, proactive TCU student-to-career companion. Product concept, not an implemented integration.

### n1: Understand the student

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student
- **Full original note:** Connect context, ask better questions, and keep the student in control.

### n2: People & pain points

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / People & pain points
- **Full original note:** Who the concept serves and the problems the team described.

### n3: Current TCU students

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / People & pain points / Current TCU students
- **Full original note:** Students across years and majors; a freshman finance major is the recurring example. The initial pilot audience is still open.

### n4: Unclear career direction

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / People & pain points / Unclear career direction
- **Full original note:** Students may not know what jobs involve, what interests them, or how their current activities relate to future roles.

### n5: Fragmented information

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / People & pain points / Fragmented information
- **Full original note:** Academic plans, career advice, job listings, campus opportunities, calendars, and application materials live in different places.

### n6: Missing or unsuitable openings

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / People & pain points / Missing or unsuitable openings
- **Full original note:** The user reports seeing about three Textron internships on Handshake but more on the employer website, and difficulty finding quant roles. These are student observations, not a verified market-wide comparison.

### n7: Eligibility mismatches

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / People & pain points / Eligibility mismatches
- **Full original note:** Students want to avoid spending time on roles they cannot take because of stated requirements, year, location, or authorization.

### n8: Generic communication

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / People & pain points / Generic communication
- **Full original note:** The team finds many existing recommendation emails irrelevant and wants a more useful, individualized experience.

### n9: Application strain

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / People & pain points / Application strain
- **Full original note:** Repeated research and tailoring take time; the discussion links this burden to application burnout.

### n10: Authenticity gap

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / People & pain points / Authenticity gap
- **Full original note:** Students may write what they think employers want instead of communicating their actual experience honestly.

### n11: Connected accounts

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Connected accounts
- **Full original note:** Proposed authorized connections. No live API access or institutional agreement has been verified.

### n12: TCU school profile

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Connected accounts / TCU school profile
- **Full original note:** Prefill major, year, academic context, and other approved student information rather than asking students to re-enter everything.

### n13: Stellic & academic planning

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Connected accounts / Stellic & academic planning
- **Full original note:** Use permitted degree progress, completed/planned courses, and relevant advising information where the connected system actually provides it. Do not assume Stellic owns all appointment records.

### n14: Advising appointment records

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Connected accounts / Advising appointment records
- **Full original note:** Connect the appropriate authorized school appointment system so the assistant can identify recorded past or upcoming meetings.

### n15: Outlook calendar

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Connected accounts / Outlook calendar
- **Full original note:** Use authorized class/calendar information to suggest suitable times and coordinate approved appointments and invites.

### n16: LinkedIn & Handshake

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Connected accounts / LinkedIn & Handshake
- **Full original note:** Proposed profile connections for career context. Public-job discovery and private-account access are separate; availability and permissions remain unverified.

### n17: GitHub & other profiles

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Connected accounts / GitHub & other profiles
- **Full original note:** Use student-approved projects and portfolio information where relevant to the goal.

### n18: Connection health & fallback

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Understand the student / Connected accounts / Connection health & fallback
- **Full original note:** Show what is connected, when it was synced, and what could not be read. Offer uploads or manual correction if a connection is unavailable.

### n19: Access is not completeness

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Understand the student / Connected accounts / Access is not completeness
- **Full original note:** Connections reduce uncertainty, but a failed sync or unrecorded meeting is not proof an event never happened. Ask when coverage is incomplete.

### n20: Contextual onboarding

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Contextual onboarding
- **Full original note:** Start from available information, then ask questions that genuinely clarify the student.

### n21: Import before interviewing

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Contextual onboarding / Import before interviewing
- **Full original note:** Connect approved apps, extract available information, then ask personalized follow-up questions.

### n22: Clarify the person

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Contextual onboarding / Clarify the person
- **Full original note:** Explore interests, aspirations, concerns, preferred work, and what the student enjoyed or disliked about past experiences.

### n23: Confirm personal contribution

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Understand the student / Contextual onboarding / Confirm personal contribution
- **Full original note:** Clarify what the student actually did in projects, clubs, volunteering, and work before turning it into application claims.

### n24: Editable profile & goals

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Contextual onboarding / Editable profile & goals
- **Full original note:** Keep current goals, constraints, and confirmed experience on the profile; let the student correct them.

### n25: No assumed answers

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Understand the student / Contextual onboarding / No assumed answers
- **Full original note:** Distinguish imported records, student-confirmed facts, AI interpretations, and missing information.

### n26: Preferences & boundaries

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Preferences & boundaries
- **Full original note:** Make personalization explicit instead of opaque.

### n27: Year, major & experience

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Preferences & boundaries / Year, major & experience
- **Full original note:** Adapt guidance for freshmen, sophomores, juniors, seniors, majors, and experience level.

### n28: Hard constraints vs preferences

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Understand the student / Preferences & boundaries / Hard constraints vs preferences
- **Full original note:** Separate cannot-relocate or explicit role requirements from preferences such as remote work, industry, or commute.

### n29: Weighting & customization

- **Original status:** Team direction
- **Hierarchy:** Remy / Understand the student / Preferences & boundaries / Weighting & customization
- **Full original note:** Let students influence ranking and see why recommendations change; the board calls for strong filtering and weighting.

### n30: Nationality wording

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Understand the student / Preferences & boundaries / Nationality wording
- **Full original note:** The board mentions nationality. Recommended refinement: ask relevant optional work-authorization or sponsorship questions, not nationality-based judgments.

### n31: Unknown eligibility

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Understand the student / Preferences & boundaries / Unknown eligibility
- **Full original note:** Do not mark unclear requirements as confirmed eligibility or ineligibility; present the uncertainty and an official clarification route.

### n32: Plan a personal path

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path
- **Full original note:** Connect academic choices, campus activity, skill-building, and career exploration.

### n33: Career exploration

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Career exploration
- **Full original note:** Help students investigate possibilities without declaring a fixed life path.

### n34: Questions before conclusions

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Career exploration / Questions before conclusions
- **Full original note:** Use a series of questions to explore the student’s interests and possible directions.

### n35: Explain roles plainly

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Career exploration / Explain roles plainly
- **Full original note:** Show future job titles, what people do day to day, relevant industries, positions, possible paths, and source-supported pay information where available.

### n36: Optional exploration tasks

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Career exploration / Optional exploration tasks
- **Full original note:** Suggest activities or small experiments students can try before committing to a direction.

### n37: Forecasting & uncertainty

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Career exploration / Forecasting & uncertainty
- **Full original note:** Some forecasting was proposed. Label scenarios as exploratory rather than guarantees about future jobs, pay, or the student’s life.

### n38: Human skills & curiosity

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Career exploration / Human skills & curiosity
- **Full original note:** Emphasize authentic experience, human judgment, curiosity, and willingness to test tools.

### n39: JobsGPT inspiration

- **Original status:** Team idea
- **Hierarchy:** Remy / Plan a personal path / Career exploration / JobsGPT inspiration
- **Full original note:** Mentor reference: break careers into tasks and explore how AI may affect work; use this to discuss skills and future possibilities, not to guarantee outcomes.

### n40: Academic roadmap

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Academic roadmap
- **Full original note:** The team’s broader vision includes semester-level academic planning.

### n41: Semester-by-semester classes

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Academic roadmap / Semester-by-semester classes
- **Full original note:** For example, show a finance major which courses fit each semester, using appropriate requirements and available information.

### n42: What each class teaches

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Academic roadmap / What each class teaches
- **Full original note:** Explain course learning and how it could relate to skills, projects, and careers.

### n43: Progress & dependencies

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Plan a personal path / Academic roadmap / Progress & dependencies
- **Full original note:** Use completed/planned courses and check prerequisites, sequencing, requirements, and known offering information.

### n44: Requirements vs suggestions

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Plan a personal path / Academic roadmap / Requirements vs suggestions
- **Full original note:** Separate official graduation rules from elective or career recommendations; use current authoritative sources and catalog context.

### n45: Academic advisor review

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Plan a personal path / Academic roadmap / Academic advisor review
- **Full original note:** Refer exceptions, substitutions, uncertain requirements, and official decisions to the appropriate advisor. Do not claim graduation clearance.

### n46: Prototype vs full vision

- **Original status:** Open decision
- **Hierarchy:** Remy / Plan a personal path / Academic roadmap / Prototype vs full vision
- **Full original note:** Decide how much academic planning belongs in the Remy demonstration versus a later phase; it overlaps the separate advising case.

### n47: Campus & skill opportunities

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Campus & skill opportunities
- **Full original note:** Make better use of the student’s time at TCU.

### n48: Relevant clubs

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Campus & skill opportunities / Relevant clubs
- **Full original note:** Recommend campus organizations related to interests and career goals, including meaningful activities to try as a freshman.

### n49: Certifications

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Campus & skill opportunities / Certifications
- **Full original note:** Suggest relevant certifications with a reason, effort/cost where known, and no assumption that every credential is worthwhile.

### n50: Projects & portfolio

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Plan a personal path / Campus & skill opportunities / Projects & portfolio
- **Full original note:** Recommend practical experiences that build genuine evidence for a skill gap; never label an unfinished project as completed experience.

### n51: Career fairs & networking

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Campus & skill opportunities / Career fairs & networking
- **Full original note:** The discussion proposes a dedicated calendar for fairs and networking events, with preparation time.

### n52: Actionable details

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Plan a personal path / Campus & skill opportunities / Actionable details
- **Full original note:** Explain what the opportunity offers, the next step, and whether information is current.

### n53: Community connections

- **Original status:** Team idea
- **Hierarchy:** Remy / Plan a personal path / Campus & skill opportunities / Community connections
- **Full original note:** The board proposes community finding/connections. Exact function and whether this is a directory, peer support, or networking remain open.

### n54: Goals & adaptive milestones

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Goals & adaptive milestones
- **Full original note:** Translate possibilities into actions the student can understand.

### n55: Profile-based goals

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Goals & adaptive milestones / Profile-based goals
- **Full original note:** Show personal goals and next steps such as a career-advising conversation.

### n56: Near and long-term steps

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Goals & adaptive milestones / Near and long-term steps
- **Full original note:** The discussion proposes month-by-month or year-by-year milestones connected to a larger roadmap.

### n57: Dynamic focus system

- **Original status:** Open decision
- **Hierarchy:** Remy / Plan a personal path / Goals & adaptive milestones / Dynamic focus system
- **Full original note:** A dynamic focus system is written on the board; exact behavior still needs definition.

### n58: Revisit the path

- **Original status:** Team direction
- **Hierarchy:** Remy / Plan a personal path / Goals & adaptive milestones / Revisit the path
- **Full original note:** Adjust as classes, interests, constraints, advisor input, and experiences change.

### n59: Student ownership

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Plan a personal path / Goals & adaptive milestones / Student ownership
- **Full original note:** Recommended: distinguish optional suggestions from student-approved commitments; allow changes without framing exploration as failure.

### n60: Find & pursue opportunities

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities
- **Full original note:** Connect real openings to suitable students and complete the required application workflow.

### n61: Discovery beyond one board

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities / Discovery beyond one board
- **Full original note:** Search suitable public sources rather than promise complete coverage.

### n62: Employer career pages

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities / Discovery beyond one board / Employer career pages
- **Full original note:** Find opportunities directly from companies, addressing the team’s Textron example.

### n63: Specialized opportunities

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities / Discovery beyond one board / Specialized opportunities
- **Full original note:** Support interests such as quantitative finance that the team feels are poorly served by its current search.

### n64: Jobs, internships & campus work

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities / Discovery beyond one board / Jobs, internships & campus work
- **Full original note:** Cover roles, internships, and an identifiable TCU work-study category.

### n65: Freshness & provenance

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Find & pursue opportunities / Discovery beyond one board / Freshness & provenance
- **Full original note:** Store source URLs and check times, deduplicate, and verify availability before calling a role current.

### n66: Public access boundaries

- **Original status:** Case requirement
- **Hierarchy:** Remy / Find & pursue opportunities / Discovery beyond one board / Public access boundaries
- **Full original note:** The case uses public postings; no unauthorized private Handshake, LinkedIn, or university scraping.

### n67: Coverage honesty

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Find & pursue opportunities / Discovery beyond one board / Coverage honesty
- **Full original note:** Say which sources and fields are supported; do not promise every job on the internet.

### n68: Explainable matching

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities / Explainable matching
- **Full original note:** Show what fits, what does not, and what still needs checking.

### n69: Role & personal priorities

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities / Explainable matching / Role & personal priorities
- **Full original note:** Match interests, background, location, timing, compensation preferences, and other student-selected factors.

### n70: Year & graduation requirements

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities / Explainable matching / Year & graduation requirements
- **Full original note:** Respect clearly stated freshman/sophomore/junior/senior or graduation-window requirements.

### n71: Authorization & sponsorship

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities / Explainable matching / Authorization & sponsorship
- **Full original note:** Use the actual posting and student-provided relevant information; distinguish work authorization, sponsorship, and citizenship requirements.

### n72: Strongest Match

- **Original status:** Case requirement
- **Hierarchy:** Remy / Find & pursue opportunities / Explainable matching / Strongest Match
- **Full original note:** For each shortlisted opening, identify the clearest fit between the student’s actual background and the posting.

### n73: Fit reasons & gaps

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Find & pursue opportunities / Explainable matching / Fit reasons & gaps
- **Full original note:** Separate required from preferred qualifications and explain important gaps instead of hiding them in a percentage.

### n74: No hiring guarantees

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Find & pursue opportunities / Explainable matching / No hiring guarantees
- **Full original note:** Internal fit scores are not employer ratings or probabilities of interviews/offers.

### n75: Authentic applications

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities / Authentic applications
- **Full original note:** Keep application preparation central to the selected case.

### n76: Resume/CV personalization

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities / Authentic applications / Resume/CV personalization
- **Full original note:** Tailor real experience to a role; the board includes ATS considerations.

### n77: Three resume versions

- **Original status:** Case requirement
- **Hierarchy:** Remy / Find & pursue opportunities / Authentic applications / Three resume versions
- **Full original note:** Use one sample student and base resume to produce at least three tailored resumes for three real openings.

### n78: Three cover letters

- **Original status:** Case requirement
- **Hierarchy:** Remy / Find & pursue opportunities / Authentic applications / Three cover letters
- **Full original note:** Create a genuinely tailored letter for each of the same three openings and flag student-specific details still needed.

### n79: Visible change comparison

- **Original status:** Case requirement
- **Hierarchy:** Remy / Find & pursue opportunities / Authentic applications / Visible change comparison
- **Full original note:** Show original and revised wording, linked to the relevant line in each job posting.

### n80: Unsupported-claim check

- **Original status:** Case requirement
- **Hierarchy:** Remy / Find & pursue opportunities / Authentic applications / Unsupported-claim check
- **Full original note:** Flag experience, tools, dates, accomplishments, or qualifications not supported by the resume or student input.

### n81: Evidence & student voice

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Find & pursue opportunities / Authentic applications / Evidence & student voice
- **Full original note:** Recommended: connect important wording to confirmed experience, preserve voice, and let the student approve/reject changes.

### n82: ATS-readable output

- **Original status:** Case requirement
- **Hierarchy:** Remy / Find & pursue opportunities / Authentic applications / ATS-readable output
- **Full original note:** Use clear headings and standard formatting without problematic tables/graphics; no promise of an ATS pass.

### n83: Interview defensibility

- **Original status:** Team idea
- **Hierarchy:** Remy / Find & pursue opportunities / Authentic applications / Interview defensibility
- **Full original note:** Optional extension: help the student explain the experiences behind the strongest application claims.

### n84: Application bots & tracking

- **Original status:** Team direction
- **Hierarchy:** Remy / Find & pursue opportunities / Application bots & tracking
- **Full original note:** Clarify what the automation actually does.

### n85: “Bots sorting out TCU applications”

- **Original status:** Open decision
- **Hierarchy:** Remy / Find & pursue opportunities / Application bots & tracking / “Bots sorting out TCU applications”
- **Full original note:** User’s phrase retained. Define whether it means research, organization, tailoring, tracking, or something else.

### n86: Organized status & follow-up

- **Original status:** Team idea
- **Hierarchy:** Remy / Find & pursue opportunities / Application bots & tracking / Organized status & follow-up
- **Full original note:** A lightweight record of roles, document versions, deadlines, and next actions was discussed as useful.

### n87: Student approval boundary

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Find & pursue opportunities / Application bots & tracking / Student approval boundary
- **Full original note:** Recommended: preview and approve outbound messages, bookings, calendar invitations, and application submissions.

### n88: No false submitted status

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Find & pursue opportunities / Application bots & tracking / No false submitted status
- **Full original note:** Generating documents does not mean an application has been sent.

### n89: Support, act & learn

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn
- **Full original note:** Proactive human support, connected records, and communication the student controls.

### n90: Advisors & follow-through

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Advisors & follow-through
- **Full original note:** Support rather than replace career and academic professionals.

### n91: Contextual advisor referral

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Advisors & follow-through / Contextual advisor referral
- **Full original note:** Suggest a career-advisor meeting when relevant to the student’s goals or uncertainty.

### n92: Read recorded meetings

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Advisors & follow-through / Read recorded meetings
- **Full original note:** Use authorized school appointment records and calendars to reduce repeated questions about past/upcoming meetings.

### n93: Schedule-aware offer

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Advisors & follow-through / Schedule-aware offer
- **Full original note:** “Would you like me to help book a meeting around your class schedule?”

### n94: Booking & calendar invite

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Advisors & follow-through / Booking & calendar invite
- **Full original note:** Proposed assistance with appointment selection and calendar invitations; access, availability, and approval remain implementation dependencies.

### n95: Meeting log into action

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Advisors & follow-through / Meeting log into action
- **Full original note:** Use a permitted meeting log or student-approved summary to update goals and support decisions and optional tasks.

### n96: Summary verification

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Support, act & learn / Advisors & follow-through / Summary verification
- **Full original note:** Recommended: confirm the summary with the student before treating interpreted advice as a commitment. Do not assume permission to record.

### n97: Notification choices

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Notification choices
- **Full original note:** Latest user clarification: ask at account creation and explain the full proposed set.

### n98: Choose at onboarding

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Notification choices / Choose at onboarding
- **Full original note:** AI asks what notifications the student wants when the account is created.

### n99: Transparent defaults

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Notification choices / Transparent defaults
- **Full original note:** Show all notification types the assistant proposes to send unless disabled; do not conceal categories behind vague personalization.

### n100: Turn off or adjust

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Notification choices / Turn off or adjust
- **Full original note:** Student can disable unwanted categories at setup or later.

### n101: Tailored emails

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Notification choices / Tailored emails
- **Full original note:** Messages should reflect that student’s relevant goals and situation, not generic or irrelevant job-email volume.

### n102: Calendar & deadline reminders

- **Original status:** Open decision
- **Hierarchy:** Remy / Support, act & learn / Notification choices / Calendar & deadline reminders
- **Full original note:** Potential categories include advisor meetings, roadmap tasks, applications, and campus events; the exact default list is not yet agreed.

### n103: Advance event notice

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Notification choices / Advance event notice
- **Full original note:** The audio proposes weeks of notice for fairs/networking rather than last-minute discovery.

### n104: Frequency & channel settings

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Support, act & learn / Notification choices / Frequency & channel settings
- **Full original note:** Recommended extension: let students choose digest frequency, email/push/calendar channels, and quiet periods.

### n105: Personal feedback loop

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Personal feedback loop
- **Full original note:** Use corrections and progress to improve this student’s guidance.

### n106: Store preferences & corrections

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Personal feedback loop / Store preferences & corrections
- **Full original note:** Remember why the student rejected a job, changed a goal, or corrected an application claim.

### n107: Learn from activity carefully

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Support, act & learn / Personal feedback loop / Learn from activity carefully
- **Full original note:** Use completed tasks and confirmed advisor input to adjust next steps; do not assume clicks reveal a settled career goal.

### n108: Qualitative feedback

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Personal feedback loop / Qualitative feedback
- **Full original note:** The board calls for qualitative feedback and continued testing with students.

### n109: Not deterministic life advice

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Support, act & learn / Personal feedback loop / Not deterministic life advice
- **Full original note:** Present options, trade-offs, and uncertainty while keeping student and advisor judgment involved.

### n110: Efficient research reuse

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Efficient research reuse
- **Full original note:** Preserve the board’s “inner feedback loop” idea without mixing private identities.

### n111: Store past public pulls

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Efficient research reuse / Store past public pulls
- **Full original note:** Save reusable public research and extractions so similar searches use less repeated work/tokens.

### n112: Personalized finishing step

- **Original status:** Team direction
- **Hierarchy:** Remy / Support, act & learn / Efficient research reuse / Personalized finishing step
- **Full original note:** Adapt current research to the individual student instead of blindly replaying a prior output.

### n113: Cache vs learning

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Support, act & learn / Efficient research reuse / Cache vs learning
- **Full original note:** Public caching saves effort; changing guidance from student feedback is a separate mechanism.

### n114: Protect private information

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Support, act & learn / Efficient research reuse / Protect private information
- **Full original note:** Keep resumes, personal constraints, advisor notes, and personalized drafts isolated with appropriate permissions.

### n115: Refresh stale material

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Support, act & learn / Efficient research reuse / Refresh stale material
- **Full original note:** Recheck job availability and time-sensitive campus information before recommending it.

### n116: Purpose, proof & delivery

- **Original status:** Team direction
- **Hierarchy:** Remy / Purpose, proof & delivery
- **Full original note:** Keep the full vision, the competition minimum, and unconfirmed ideas distinct.

### n117: Draft purpose statements

- **Original status:** Draft statement
- **Hierarchy:** Remy / Purpose, proof & delivery / Draft purpose statements
- **Full original note:** Consultant-written statements synthesized from the team’s direction; editable, not assumed approved.

### n118: Problem statement

- **Original status:** Draft statement
- **Hierarchy:** Remy / Purpose, proof & delivery / Draft purpose statements / Problem statement
- **Full original note:** Students lack a connected, personalized view of how their academic choices, campus experiences, eligibility, and career opportunities fit together, leaving them unsure what to pursue and what to do next.

### n119: Mission statement

- **Original status:** Draft statement
- **Hierarchy:** Remy / Purpose, proof & delivery / Draft purpose statements / Mission statement
- **Full original note:** Help TCU students turn their individual background, academic journey, and interests into informed career decisions and practical next steps through connected information, authentic AI guidance, and human support.

### n120: Vision statement

- **Original status:** Draft statement
- **Hierarchy:** Remy / Purpose, proof & delivery / Draft purpose statements / Vision statement
- **Full original note:** Every student can understand their options, make purposeful use of their time at TCU, and adapt their path as their interests and opportunities change.

### n121: Product goal

- **Original status:** Draft statement
- **Hierarchy:** Remy / Purpose, proof & delivery / Draft purpose statements / Product goal
- **Full original note:** Create a student-controlled career companion that connects authorized academic and career information, asks relevant questions, and helps students explore, prepare for, and pursue suitable opportunities.

### n122: Student promise

- **Original status:** Draft statement
- **Hierarchy:** Remy / Purpose, proof & delivery / Draft purpose statements / Student promise
- **Full original note:** Know your options. Understand your next step. Build a path that is yours.

### n123: Positioning

- **Original status:** Draft statement
- **Hierarchy:** Remy / Purpose, proof & delivery / Draft purpose statements / Positioning
- **Full original note:** A connected student-to-career guide, not just another job feed: understand the student, connect preparation to opportunities, and support action and follow-through.

### n124: Values & intended outcomes

- **Original status:** Team direction
- **Hierarchy:** Remy / Purpose, proof & delivery / Values & intended outcomes
- **Full original note:** What the experience should stand for.

### n125: Authenticity

- **Original status:** Team direction
- **Hierarchy:** Remy / Purpose, proof & delivery / Values & intended outcomes / Authenticity
- **Full original note:** Honest, specific representation of the student’s own experience.

### n126: Human agency

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Purpose, proof & delivery / Values & intended outcomes / Human agency
- **Full original note:** Help students decide, question, explore, and act; do not prescribe their life.

### n127: Curiosity & experimentation

- **Original status:** Team direction
- **Hierarchy:** Remy / Purpose, proof & delivery / Values & intended outcomes / Curiosity & experimentation
- **Full original note:** Encourage learning by trying tools, tasks, and opportunities.

### n128: Connected clarity

- **Original status:** Draft statement
- **Hierarchy:** Remy / Purpose, proof & delivery / Values & intended outcomes / Connected clarity
- **Full original note:** Explain why a course, activity, advisor meeting, or role matters to the student.

### n129: Privacy & transparency

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Purpose, proof & delivery / Values & intended outcomes / Privacy & transparency
- **Full original note:** Explain sources, permissions, uncertainties, and notification behavior.

### n130: Useful progress

- **Original status:** Draft statement
- **Hierarchy:** Remy / Purpose, proof & delivery / Values & intended outcomes / Useful progress
- **Full original note:** Proposed north-star measure: students completing a self-approved, relevant career action with enough understanding to explain why it helps. Test application preparation time, unsupported claims, recommendation relevance, and student clarity; do not claim hiring gains without follow-up.

### n131: Competition deliverables

- **Original status:** Case requirement
- **Hierarchy:** Remy / Purpose, proof & delivery / Competition deliverables
- **Full original note:** The wider vision does not replace the Remy minimum.

### n132: One sample student

- **Original status:** Case requirement
- **Hierarchy:** Remy / Purpose, proof & delivery / Competition deliverables / One sample student
- **Full original note:** Use a real permitted resume or realistic stand-in profile with a target role/field.

### n133: Public current shortlist

- **Original status:** Case requirement
- **Hierarchy:** Remy / Purpose, proof & delivery / Competition deliverables / Public current shortlist
- **Full original note:** Capture title, company, location, 3–5 key qualifications/keywords, and Strongest Match.

### n134: Three application pairs

- **Original status:** Case requirement
- **Hierarchy:** Remy / Purpose, proof & delivery / Competition deliverables / Three application pairs
- **Full original note:** Three tailored resumes plus three matching cover letters, with posting-linked before/after comparisons.

### n135: Honesty & ATS checks

- **Original status:** Case requirement
- **Hierarchy:** Remy / Purpose, proof & delivery / Competition deliverables / Honesty & ATS checks
- **Full original note:** Flag unsupported claims, preserve truthful qualifications, and provide standard ATS-readable formats.

### n136: Reusable AI build

- **Original status:** Case requirement
- **Hierarchy:** Remy / Purpose, proof & delivery / Competition deliverables / Reusable AI build
- **Full original note:** Prompt template, skill, custom assistant, no-code workflow, or another reusable build. A one-off conversation does not count.

### n137: AI log & observed error

- **Original status:** Case requirement
- **Hierarchy:** Remy / Purpose, proof & delivery / Competition deliverables / AI log & observed error
- **Full original note:** Document tools, workflow, and an actual confidently wrong AI output caught and corrected by the team.

### n138: Pitch deck & appendix

- **Original status:** Case requirement
- **Hierarchy:** Remy / Purpose, proof & delivery / Competition deliverables / Pitch deck & appendix
- **Full original note:** Include shortlist, three pairs, comparisons, and AI log; confirm current demo-video and upload logistics with organizers.

### n139: Judging rubric

- **Original status:** Case requirement
- **Hierarchy:** Remy / Purpose, proof & delivery / Competition deliverables / Judging rubric
- **Full original note:** Seven equal categories: innovation, technical execution, responsible AI, completeness, usability, impact, presentation. Attached rubric totals 28; some cases inconsistently mention 100.

### n140: Build, test & differentiate

- **Original status:** Team direction
- **Hierarchy:** Remy / Purpose, proof & delivery / Build, test & differentiate
- **Full original note:** Keep hypotheses separate from demonstrated results.

### n141: Working tool choice

- **Original status:** Team idea
- **Hierarchy:** Remy / Purpose, proof & delivery / Build, test & differentiate / Working tool choice
- **Full original note:** “Replit?” appears on the board as a possible build environment, not a confirmed choice.

### n142: Desktop & phone usability

- **Original status:** Team direction
- **Hierarchy:** Remy / Purpose, proof & delivery / Build, test & differentiate / Desktop & phone usability
- **Full original note:** Good interface on computer and phone, with readable generated documents.

### n143: Team roles & roadmap

- **Original status:** Team direction
- **Hierarchy:** Remy / Purpose, proof & delivery / Build, test & differentiate / Team roles & roadmap
- **Full original note:** Board tasks include naming the product, assigning roles, defining the problem/audience, implementation roadmap, and feedback collection.

### n144: Test one complete journey

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Purpose, proof & delivery / Build, test & differentiate / Test one complete journey
- **Full original note:** Recommended: demonstrate a student’s context → relevant next action → application → follow-through, rather than disconnected feature demos.

### n145: Measure a useful improvement

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Purpose, proof & delivery / Build, test & differentiate / Measure a useful improvement
- **Full original note:** Proposed tests: relevance, student clarity, time including corrections, claim accuracy, and ability to explain application wording.

### n146: No unsupported superiority claim

- **Original status:** Consultant recommendation
- **Hierarchy:** Remy / Purpose, proof & delivery / Build, test & differentiate / No unsupported superiority claim
- **Full original note:** Feature overlap with Handshake/LinkedIn does not prove equivalent experience. Claim better results only for the actual workflow and baseline tested.

### n147: Prioritization still open

- **Original status:** Open decision
- **Hierarchy:** Remy / Purpose, proof & delivery / Build, test & differentiate / Prioritization still open
- **Full original note:** Select what is live, clearly simulated, or future vision. Preserve all ideas without pretending the entire ecosystem can be built in one sprint.

### n148: Unresolved & parked ideas

- **Original status:** Open decision
- **Hierarchy:** Remy / Purpose, proof & delivery / Unresolved & parked ideas
- **Full original note:** Retained for completeness, not silently converted into product commitments.

### n149: Integration feasibility

- **Original status:** Open decision
- **Hierarchy:** Remy / Purpose, proof & delivery / Unresolved & parked ideas / Integration feasibility
- **Full original note:** Confirm authorized data sources, APIs, institutional permission, sync completeness, and advisor availability.

### n150: Forecasting evidence

- **Original status:** Open decision
- **Hierarchy:** Remy / Purpose, proof & delivery / Unresolved & parked ideas / Forecasting evidence
- **Full original note:** Decide what forecasts mean, what sources support them, and how uncertainty is explained.

### n151: Task urgency & autonomy

- **Original status:** Open decision
- **Hierarchy:** Remy / Purpose, proof & delivery / Unresolved & parked ideas / Task urgency & autonomy
- **Full original note:** Define optional tasks, deadlines, approval requirements, and how strongly the assistant nudges.

### n152: Community & dynamic focus

- **Original status:** Open decision
- **Hierarchy:** Remy / Purpose, proof & delivery / Unresolved & parked ideas / Community & dynamic focus
- **Full original note:** Specify these board terms before treating them as build requirements.

### n153: Employer-side marketplace

- **Original status:** Parked discussion
- **Hierarchy:** Remy / Purpose, proof & delivery / Unresolved & parked ideas / Employer-side marketplace
- **Full original note:** Audio discussion considered employer recruitment features and pushed toward student-facing focus. Retained as a parked discussion, not a confirmed build requirement.

### n154: Aggregated-data monetization

- **Original status:** Parked discussion
- **Hierarchy:** Remy / Purpose, proof & delivery / Unresolved & parked ideas / Aggregated-data monetization
- **Full original note:** Audio discussion mentioned selling aggregated/anonymized demand/skill data. No approved business model, permissions, or privacy assessment was established. Do not implement from this note.

### n155: Naming & business model

- **Original status:** Open decision
- **Hierarchy:** Remy / Purpose, proof & delivery / Unresolved & parked ideas / Naming & business model
- **Full original note:** Remy is the current case/working label. Final name and sustainable business model remain open.

