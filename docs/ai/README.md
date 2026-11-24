# Shared context for every AI working on Remy

Several people work on Remy with their own AI assistants (Claude, Codex, Cursor and others). This folder keeps them in step.

**The lead AI** is the Claude in the RemyAI team project, working for Dilan. It owns `CONTEXT.md`, reads everyone's status, and decides when two pieces of work collide. Every other AI is a teammate: it follows the rules here, says what it is doing, and asks the lead (through its person, or in its status file) before changing shared code.

| File | Who writes it | What it holds |
|---|---|---|
| [`CONTEXT.md`](CONTEXT.md) | The lead AI | Rules, current status, who owns which part of the code |
| [`DECISIONS.md`](DECISIONS.md) | The lead AI | Team decisions and why, newest first |
| [`owners.json`](owners.json) | The lead AI | Each person's GitHub login, status file and owned paths (read by `check:ai`) |
| [`status/<person>.md`](status/) | Each person's AI, only its own file | What it is doing now, claims, requests to others, open PRs, questions |
| [`review-checklist.md`](review-checklist.md), [`julio.md`](julio.md) | The lead AI | How to review a PR; Julio's start page |

## Every AI, every session

1. Run `npm run ai:brief -- --me <name>` (it shows CONTEXT, DECISIONS, everyone's status and claims, requests for you, open PRs and the last 24 hours). Add `--touch <paths>` before you change files, and `--vault <folder>` to write it into a notes vault.
2. Before you change a file someone else owns, claims or has an open PR on, stop and coordinate: add a request under `## Requests` in your status file and tell your person. Claim your own files under `## Claims`.
3. Before every PR, rewrite your own `status/<person>.md` from the [template](status/README.md) and include it in the PR.
4. Never edit another person's status file or `CONTEXT.md`. Put suggestions for `CONTEXT.md` or `DECISIONS.md` under "Questions for the lead" in your status file.

## What CI checks (`npm run check:ai`)

- A code PR from anyone but the lead updates the author's status file.
- No PR touches files another person owns or has an active claim on, unless its description says `Coordinated with: <Name>`.
- Claims have a branch and end within 3 days.
- Warnings only: a missing What's new note when `client/` changed, and new screens with no owners-only gate in sight.
