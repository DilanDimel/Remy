# AGENTS.md

Instructions for any AI coding assistant working in this repo (Codex, Cursor, Copilot, Gemini, Claude and others).

1. **Run `npm run ai:brief -- --me <your person's first name>` first** (no terminal? ask your person to paste its output). It covers [`docs/ai/CONTEXT.md`](docs/ai/CONTEXT.md), [`docs/ai/DECISIONS.md`](docs/ai/DECISIONS.md), every file in [`docs/ai/status/`](docs/ai/status/), claims, requests and the open PRs. Before you change files, add `--touch <paths>` to see if anyone else is on them. The lead AI keeps CONTEXT.md current; it tells you who owns which code and what is true right now.
2. **Follow [`CLAUDE.md`](CLAUDE.md)** for how to build, test and push. Its rules apply to every assistant, not only Claude.
3. **Before every PR, update your own status file**, `docs/ai/status/<your person's first name>.md` (template in [`docs/ai/status/README.md`](docs/ai/status/README.md)), in the same PR, with a claim for the files you're changing. Don't edit anyone else's. `npm run check:ai` (in CI) checks this.
4. **Stay in your area.** If you need to change code another person owns or another open PR touches, write it under "Questions for the lead" in your status file and tell your person before you change it.
