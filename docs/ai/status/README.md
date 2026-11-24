# Status files

One file per person: `status/<first-name>.md` (lowercase, e.g. `demetre.md`). Your AI rewrites it before every PR, in the same PR, and edits no one else's. Keep it short and current; delete finished items instead of piling them up.

**Working on now, one file per item (like `shared/news/`).** Several threads of one AI work at once, and they kept colliding on the same lines of one status file. So each piece of work can be its own file in a folder named after the status file: `status/lead/<short-slug>.md` for `status/lead.md`, `status/demetre/<slug>.md` for `demetre.md`. The file holds the same one paragraph you'd put after the `- `. A thread writes and edits only its own entry file and deletes it when the work is done; `ai:brief`, `check:ai` and the owners' dashboard read the folder as part of `## Working on now`. Lead threads must use the folder and leave `## Working on now` in `lead.md` alone; for everyone else it's optional. Add a new Request or Answer as its own new line, never by rewriting someone else's line.

Copy this:

```markdown
# <Name>'s AI

Updated: YYYY-MM-DD HH:MM UTC
Area: <the part of the code this person owns, e.g. native/>

## Working on now
- <one line per piece of work>

## Claims
- `path/one.ts`, `path/two/` · branch <name>/<feature> · until YYYY-MM-DD

## Requests
- <yourname>-1 to <Name> (YYYY-MM-DD): <a change you need from them>

## Answers
- <theirname>-4 · done · #123 · <one line on what you did>

## Files and folders I touch
- <paths>. Flag anything outside your own area.

## Open PRs
- #<number> <title>: <state, what it waits on>

## Next
- <what comes after>

## Questions for the lead
- <anything that needs a decision, or a change to CONTEXT.md>
```

**Claims** say "I'm changing these files on this branch until this date". Claim before you start, keep it to files (or a small folder), at most 3 days, and delete it when the PR merges. Expired claims are ignored. `npm run check:ai` blocks anyone else's PR on those files unless it says `Coordinated with: <your name>`.

**Requests** ask another person's AI for something. Give each one an id (your first name and a number that only goes up: `dilan-7`) and the date. Their `npm run ai:brief -- --me <Name>` lists it first, before anything else.

**Answers** are the proof. The receiver answers in its own status file, under `## Answers`, with the request's id and a state: `seen`, `doing`, `done · #PR` or `declined · why`. Because only the receiver writes its own file (CI blocks anyone else), the answer is proof it was read; `done` must name the PR, and the sender's briefing shows whether that PR merged. A request with no answer after a day is overdue: the receiver's next PR fails `check:ai` until it answers. Delete a request once it's done and you've seen the proof; the receiver deletes the answer at the same time or a week later.
