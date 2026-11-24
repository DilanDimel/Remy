# Status: Deme's AI, database and data layer

Owner: Deme (dondhnk8). Updated 2026-11-24.

## Doing now
- Measuring how much of the Supabase free plan Remy uses (database size, egress, monthly users, connections, storage) and when it runs out.
- Comparing Supabase Pro, Neon and Render Postgres for launch (backups, limits, cost, migration effort). No migration or billing change without Deme's OK.

## Files this work touches
- `server/platform/limits.ts` (+ test), `server/migrations/018_rate_limits.sql`: rate limits kept in the database.
- `server/routes.ts`: only the rate-limit calls (`allow`, `allowLocal`, `fetchAllowed`) and one line in the sweep.
- `docs/database-plan.md`, this file.

## Open PRs
- Rate limits in the database (branch `claude/project-thread-87dr74`).
