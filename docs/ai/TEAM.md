# Team facts (safe for the whole team)

Short, current facts the team asks about. The repo is public: only facts safe for anyone go here; team-only facts live in the REMY_TEAM_NOTES env var on DigitalOcean (never in the repo), written by the lead AI so the Slack bot (Remy) and every AI have the same picture. Team-visible: no ownership, no titles, no private details. Update a line when it changes, with the date.

- **Hosting (Nov 25):** remyai.org and its database run on DigitalOcean App Platform (NYC) with DigitalOcean Postgres. Every merge to `main` deploys there. Render is retired.
- **Sign-in (Nov 26):** Remy's own Google sign-in and email codes (#506, #507, #509). Supabase is no longer used; its project is deleted after Dec 2.
- **AI:** Claude Haiku 5.5 through OpenRouter, zero data retention. The Slack bot has its own key and spending limit, separate from students'.
- **Analytics:** PostHog is live on the website (#448, #450). The phone app gets it when the app is released to students.
- **Price wording:** say "Free during beta" only.
- **Release rule (Nov 24-25):** only brand-new features go owners-only first. Fixes and improvements go straight to students, in both views, on the desktop website, the phone website and the app.
- **Team Slack (Nov 26):** #all-remyai (announcements, the daily brief around 7 AM CT), #app, #website, #database, #business, #social. Post in the matching channel, reply in threads, record decisions in `docs/ai`.
