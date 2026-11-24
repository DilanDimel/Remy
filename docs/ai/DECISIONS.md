# Team decisions

Every AI reads this with `CONTEXT.md`. Newest first. Only the lead AI edits it; suggest additions under "Questions for the lead" in your status file. This repo is public, so decisions that can't be public yet stay out of it.

| Date | Decision | Why |
|---|---|---|
| 2026-11-24 | The phone app gets its own switch in Feature releases (`app`, Owners only by default). Until it's released, students who sign in to the app see "The new app is almost here". | Dilan releases the app like any other feature, separately from the website redesign. |
| 2026-11-24 | Dilan does most of the work and the lead AI (Dilan's project Claude) is the main AI: both can work in every area and have the final say on conflicts, merges and releases. Demetre owns the phone app. Julio builds new website features, reviews new code, and owns costs. | Three people now build at once; clear areas plus claims stop collisions. |
| 2026-11-24 | Claims, status files and `npm run check:ai` apply to everyone except Dilan and the lead AI, which CI never blocks. The lead can override or reassign any claim. | Rules that a CI check enforces work for every AI tool, not just the ones that read the docs. |
| 2026-11-24 | Stay on Supabase Free. No new code may read a whole workspace per request or poll the database. | Support confirmed no restriction if the next cycle stays under 5 GB. |
| 2026-11-24 | One switch (Admin, Beta, Feature releases) releases the whole redesign to students. Interview and Community stay locked ("coming soon"). | Students should see one consistent new Remy. |
| 2026-11-23 | Pricing wording is only "Free during beta". | It may not stay free after the beta. |
| 2026-11-23 | Present RemyAI as a real company and product, never as a student or class project. | Credibility with students and partners. |
| 2026-11-23 | Marketing shows real app screens, the real fox and real people. No invented outcomes. | Honesty; it's also what the product promises students. |
| 2026-11-23 | Remy rewrites resume lines himself from facts already on the resume (Accept, Edit or Skip) and asks only for missing facts. | No invented claims, less work for the student. |
| 2026-11-23 | Every shipped change adds a What's new note (`owners: true` while owners-only). | People see what changed. |
| 2026-11-23 | Commits are authored by the person the AI works for. An AI co-author line is fine. | Credit and history stay with people. |
| 2026-11-23 | No horizontal-band "dark strip with orange glow" designs, at most one peach card per page, zero scrolling at 1440x800 where possible. | Design direction from the team review. |
| 2026-11-22 | Nothing reaches students without Dilan's go-ahead; everything new ships owners-only first. | Owners test before students see it. |
| 2026-11-22 | Nothing is ever sent for the student. Outreach opens in their own mail app. | Students stay in control. |
