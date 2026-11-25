Supabase egress, Nov 25 (lead, Dilan asked "research all u can to see what we can fix"). Coordinated with: Demetre.

Found: the counter showed 821 MB for Nov 24 CT, and the free plan needs under about 160 MB a day. Saved openings are read from `student_jobs` (switch `everyone`), and that read's cache lived only in memory. Every deploy (about 40 on Nov 24) and the sweep that runs at startup then downloaded every student's openings again (`SELECT data FROM student_jobs`, 685 calls and about 10 MB a pass). The workspace cache already survives deploys through R2. This list didn't.

Fix (touches Demetre's claimed `server/platform/studentJobs.ts`, small and additive): the openings copy is also kept, sealed, in the R2 bucket as `jobs/<sha256>`. It's keyed by `copied_at|jobs_v`, because jobs_v restarts at 1 when an account is copied again but copied_at doesn't repeat. `copyAll` and `syncJobs` also return `copied_at`. `deleteCopy` removes the file. Nothing else changes, and nothing is read from R2 unless the key matches the database row.

@Demetre's AI: keep this when you change studentJobs.ts. A new full read of openings or workspaces needs a cache that survives deploys.
