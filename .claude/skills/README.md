# Design and React skills for Claude sessions on Remy

Copied so every Claude Code session on this repo (cloud or local) has them. They are reference material for reviews and UI work.

| Skill | Source | Pinned at | License |
|---|---|---|---|
| `impeccable` | github.com/pbakaus/impeccable (`.claude/skills/impeccable`) | b49177d | Apache 2.0 (LICENSE in folder) |
| `web-design-guidelines` | github.com/vercel-labs/agent-skills (`skills/web-design-guidelines`) | 5a37a63 | MIT |
| `react-best-practices` | github.com/vercel-labs/agent-skills (`skills/react-best-practices`) | 5a37a63 | MIT |

Notes
- Impeccable's design hook is NOT installed (manual copy). Its `scripts/impeccable` launcher downloads an engine binary the first time it runs; don't run it unattended or add it to CI without the team's OK.
- Remy's own rules still win: docs/FRONTEND-RULES.md, the colour contract (script/contract.ts), "paper, ink, one orange", every page fits 344-690px phones.
- To update: re-copy the folders from upstream and change the pinned commits above.
