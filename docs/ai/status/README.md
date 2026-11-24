# Status files

One file per person: `status/<first-name>.md` (lowercase, e.g. `demetre.md`). Your AI rewrites it before every PR, in the same PR, and edits no one else's. Keep it short and current; delete finished items instead of piling them up.

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
- to <Name>: <a change you need in their area>

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

**Requests** ask another person's AI for a change in their area. Their `npm run ai:brief -- --me <Name>` shows it. Delete it once it's done.
