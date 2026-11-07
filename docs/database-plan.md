# Database plan: from demo storage to a real database

Status: proposal for the team (Oct 2026). Nothing here is built yet.

## Today
- Postgres: Supabase in production (`DATABASE_URL`, tables in their own `remy` schema), PGlite (Postgres inside Node) locally and in tests. Migrations in `server/migrations/` run once each at startup.
- Each student's whole account (profile, resume, openings, applications, tracker, chat…) is still one JSON document in the `workspaces` table, capped at 4 MB.
- Saves merge per top-level section, so a slow request no longer erases other edits; two requests editing the *same* section still last-write-wins.
- Rate limits (guest creation, AI per network, link fetching) live in server memory and reset on restart.

This is fine for a demo and a small pilot. It breaks down when:
- more than one server runs (in-memory limits and the single file don't share),
- accounts get large (the whole blob is rewritten on every click),
- we need backups, point-in-time recovery, or to answer "who can see this student's data" for TCU.

## Built: checked openings (Nov 2026, Demetre)
`checked_openings` (migration 014, `server/openings.ts`) keeps one shared row per public posting Remy has found or re-checked, with no student data.
- **Tags:** company (normalized like `sameOrg`), industry (the setup field chips, from the title, else the employer's directory field) and career path (the My Path road key, empty when no road really fits).
- **Filled by:** every openings search (`recordFound`) and every page check, manual or background (`recordCheck`: reachable, closed wording or unreachable, with the HTTP status).
- **Discarded:** the 6-hour sweep deletes rows not seen or checked for `OPENINGS_KEEP_DAYS` days (default 30).
- **Writes:** one statement per search, not one per opening.
- **Read:** `GET /api/admin/openings?industry=&path=&company=&status=open|closed|unchecked` (owners only) returns counts by industry and path plus the matching openings.

## Built: keeping the data small (Nov 2026, Demetre)
- **Openings lists are trimmed** (`server/trim.ts`) whenever a search adds openings: imported openings nothing else refers to (not saved, applied to, rated, hidden, linked from a to-do or the calendar) are dropped after 30 days, and at most the newest 150 are kept. Their links go in `droppedJobUrls` so a search doesn't add them back as new. Before this, every search added up to 25 openings with up to 12 KB of text each and nothing was ever removed, so active accounts would hit the 4 MB limit.
- **Background jobs filter in SQL** (`recentStudents`): the background openings search and the saved-openings re-check load only students who visited in the last 21 days (and, for the search, finished setup), longest-waiting first, instead of every signed-in account.
- **Employer cache is slimmer:** `board_cache` keeps every posting's title, place and link, but description text only for student-level postings (capped at 20,000 characters). Search results are identical (tested on Julio's 48 labeled postings); senior roles' full text was the bulk of the cache.
- **Space watch** (`server/storage.ts`): `GET /api/admin/storage` (owners) shows the database size against `DB_SIZE_LIMIT_MB` (default 500, the Supabase free plan) and each table's size. Past 80%, the sweep posts one warning a day on the owners' Errors page. Free-plan note: daily backups aren't included; check before launch.
- **Expired codes are cleaned up:** the sweep deletes sign-in and school-email codes nobody came back for.

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
