# Design, React, marketing and video skills for Claude sessions on Remy

Copied so every Claude Code session on this repo (cloud or local) has them. They are reference material for reviews and UI work.

| Skill | Source | Pinned at | License |
|---|---|---|---|
| `impeccable` | github.com/pbakaus/impeccable (`.claude/skills/impeccable`) | b49177d | Apache 2.0 (LICENSE in folder) |
| `web-design-guidelines` | github.com/vercel-labs/agent-skills (`skills/web-design-guidelines`) | 5a37a63 | MIT (LICENSE in folder) |
| `react-best-practices` | github.com/vercel-labs/agent-skills (`skills/react-best-practices`) | 5a37a63 | MIT (LICENSE in folder) |
| `product-marketing` | github.com/coreyhaines31/marketingskills (`skills/product-marketing`, evals removed) | 8fd2fca | MIT (`MARKETINGSKILLS-LICENSE`) |
| `launch` | github.com/coreyhaines31/marketingskills (`skills/launch`, evals removed) | 8fd2fca | MIT (`MARKETINGSKILLS-LICENSE`) |
| `social` | github.com/coreyhaines31/marketingskills (`skills/social`, evals removed) | 8fd2fca | MIT (`MARKETINGSKILLS-LICENSE`) |
| `copywriting` | github.com/coreyhaines31/marketingskills (`skills/copywriting`, evals removed) | 8fd2fca | MIT (`MARKETINGSKILLS-LICENSE`) |
| `ad-creative` | github.com/coreyhaines31/marketingskills (`skills/ad-creative`, evals removed) | 8fd2fca | MIT (`MARKETINGSKILLS-LICENSE`) |
| `aso` | github.com/coreyhaines31/marketingskills (`skills/aso`, evals removed) | 8fd2fca | MIT (`MARKETINGSKILLS-LICENSE`) |
| `ai-seo` | github.com/coreyhaines31/marketingskills (`skills/ai-seo`, evals removed) | 8fd2fca | MIT (`MARKETINGSKILLS-LICENSE`) |
| `marketing-psychology` | github.com/coreyhaines31/marketingskills (`skills/marketing-psychology`, evals removed) | 8fd2fca | MIT (`MARKETINGSKILLS-LICENSE`) |
| `video` | github.com/coreyhaines31/marketingskills (`skills/video`, evals removed) | 8fd2fca | MIT (`MARKETINGSKILLS-LICENSE`) |
| `remy-reel` | Remy's own (Nov 2026): house rules for launch videos and the recording rig | - | - |

Notes
- Impeccable's design hook is NOT installed (manual copy). Its `scripts/impeccable` launcher downloads an engine binary the first time it runs; don't run it unattended or add it to CI without the team's OK.
- Remy's own rules still win: docs/FRONTEND-RULES.md, the colour contract (script/contract.ts), "paper, ink, one orange", every page fits 344-690px phones.
- Marketing skills: read-only markdown. `social/references/listening.md` has curl recipes for public Reddit/HN/Bluesky search. `social` may suggest scheduling tools; Remy's rule stays: drafts only, nothing posted without Dilan.
- Marketing skills are markdown only. `social/references/listening.md` has curl recipes for public Reddit, HN and Bluesky search. `social` may suggest scheduling tools; Remy's rule stays: drafts only, nothing posted without Dilan's OK.
- To update: re-copy the folders from upstream and change the pinned commits above.
