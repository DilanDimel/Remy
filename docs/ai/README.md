# Shared context for every AI working on Remy

Several people work on Remy with their own AI assistants (Claude, Codex, Cursor and others). This folder keeps them in step.

**The lead AI** is the Claude in the RemyAI team project, working for Dilan. It owns `CONTEXT.md`, reads everyone's status, and decides when two pieces of work collide. Every other AI is a teammate: it follows the rules here, says what it is doing, and asks the lead (through its person, or in its status file) before changing shared code.

| File | Who writes it | What it holds |
|---|---|---|
| [`CONTEXT.md`](CONTEXT.md) | The lead AI | Rules, current status, who owns which part of the code |
| [`status/<person>.md`](status/) | Each person's AI, only its own file | What it is doing now, files it touches, open PRs, questions |

## Every AI, every session

1. Read `CONTEXT.md`, then every file in `status/`, then the list of open PRs.
2. Before you change a file another status file or open PR touches, stop and coordinate (write the question in your status file and tell your person).
3. Before every PR, rewrite your own `status/<person>.md` from the [template](status/README.md) and include it in the PR.
4. Never edit another person's status file or `CONTEXT.md`. Put suggestions for `CONTEXT.md` under "Questions for the lead" in your status file.
