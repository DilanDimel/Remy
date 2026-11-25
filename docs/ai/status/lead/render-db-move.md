Move Remy's database from Supabase to Render Postgres, Nov 25 (lead). PREPARED ONLY: Dilan said hold until the team decides who pays (Render Basic 1 GB, $19/mo, Virginia). Nothing is created or billed. Supabase says the free-plan block starts Nov 28.

Ready in this PR:
- `sslFor` (server/platform/sql.ts) skips TLS for a host with no dot, like Render's internal `dpg-…-a`. That traffic stays inside Render's private network. Supabase hosts aren't affected (test in sql.test.ts).
- `script/copy-database.ts --from postgres://…` now copies every table in DB_SCHEMA, parents before children. It moves the id counters past the copied ids and checks row counts. It's safe to run twice (ON CONFLICT DO NOTHING). Rehearsed locally on Postgres 16 with 40 accounts: every table matched, workspace and file bytes were identical (md5), and the next error_reports id continued correctly.

Runbook, once Dilan says go:
1. Render: New Postgres, Basic 1 GB, region Virginia, Postgres 17, same workspace as remy-virginia.
2. Rehearsal: from a machine that can reach both databases (Dilan's laptop, or a throwaway Render job, NOT the live service's Shell), run `DB_SCHEMA=remy_live DATABASE_URL=<Render external URL> npx tsx script/copy-database.ts --from <Supabase session-pooler URL>`. All ✓ is required. Then drop the schema and repeat at switch time, or keep it: re-running adds only new rows, and changed rows need a fresh copy.
3. Switch at a quiet hour (about 3 AM CT): drop and re-create the Render schema, copy again, then set DATABASE_URL in env group remy-server-env to the Render INTERNAL URL and remove DB_SSL_CA_FILE. The deploy restarts the server on the new database. Check /api/config, sign-in, a workspace load, and Admin storage.
4. Keep Supabase untouched for 2 weeks as the fallback (switching back = the old DATABASE_URL). It still serves sign-in (OAuth and magic link) only. Add a daily keep-awake ping, since free projects pause after 7 idle days.
5. Backups: Render's own daily backups and recovery replace most of the nightly R2 copy. The R2 backup now goes over Render's public bandwidth (5 GB free, then $0.15/GB), so consider weekly full copies only.

Open: whether Supabase's Nov 28 restriction also blocks Auth (Dilan is asking on ticket SU-566464). If yes, sign-in needs Pro or another sign-in path before Nov 28, even after the move.
