# Database plan: from demo storage to a real database

Status: proposal for the team (Oct 2026). Nothing here is built yet.

## Today
- One SQLite file on one Render server (`/data/data.db`, 1 GB disk).
- Each student's whole account (profile, resume, applications, tracker, chat…) is one JSON blob in the `workspaces` table. Every request reads the whole blob and writes it back.
- Since Section B of the fix list, saves merge per top-level section, so a slow request no longer erases other edits; two requests editing the *same* section still last-write-wins.
- Rate limits (guest creation, AI per network, link fetching) live in server memory and reset on restart.

This is fine for a demo and a small pilot. It breaks down when:
- more than one server runs (in-memory limits and the single file don't share),
- accounts get large (the whole blob is rewritten on every click),
- we need backups, point-in-time recovery, or to answer "who can see this student's data" for TCU.

## Built: checked openings (Nov 2026, Demetre)
`checked_openings` (migration 012, `server/openings.ts`) keeps one shared row per public posting Remy has found or re-checked, with no student data.
- **Tags:** company (normalized like `sameOrg`), industry (the setup field chips, from the title, else the employer's directory field) and career path (the My Path road key, empty when no road really fits).
- **Filled by:** every openings search (`recordFound`) and every page check, manual or background (`recordCheck`: reachable, closed wording or unreachable, with the HTTP status).
- **Discarded:** the 6-hour sweep deletes rows not seen or checked for `OPENINGS_KEEP_DAYS` days (default 30).
- **Read:** `GET /api/admin/openings?industry=&path=&company=&status=open|closed|unchecked` (owners only) returns counts by industry and path plus the matching openings.

## Proposal
Move to **Supabase Postgres**, the same Supabase project already used for sign-in.

1. **Tables per thing, not one blob:** `profiles`, `resumes` (+ uploaded file in Supabase Storage), `applications`, `application_versions`, `changes`, `tracker_items`, `tasks`, `calendar_items`, `contacts`, `outreach_drafts`, `memory_facts`, `chat_messages`, `ai_usage`. Each row has `user_id`.
2. **Row-level security:** students can only read and write rows with their own `user_id`; the server uses the service key only where it must (alumni matching, AI usage totals).
3. **Alumni list in its own table**, readable only by the server, never by the browser, and only after the career office agrees to the use.
4. **Rate limits in the database** (or Redis) so they hold across restarts and multiple servers.
5. **Backups:** Supabase daily backups; test a restore once before launch.

## Migration path
1. Add a data-access layer in the server (`loadWorkspace` / `saveWorkspace` become per-table reads and writes) while still writing SQLite, so the client doesn't change.
2. Copy existing accounts with a one-off script (blob → rows), verify counts.
3. Switch reads to Postgres behind a setting, run both for a few days, then retire SQLite.

## Needed from people, not code
- Career office: written OK for how the alumni list may be used.
- TCU (via professors / IT): whether a student-run app may store student data, and what FERPA review is needed before any TCU or Stellic records are connected.
- Budget: Supabase free tier is enough for a pilot; check limits before a campus-wide launch.
