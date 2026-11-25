---
name: remy-voice
description: Use before writing or editing ANY public words for RemyAI (Instagram, TikTok, LinkedIn, X posts and captions, carousel slides, launch notes, newsletters, outreach drafts). Remy's real voice, the house limits, and a checker that must pass before a draft goes to Buffer or to Dilan.
---

# Remy voice

The posts that worked for founders in 2026 all had one thing in common: the AI was given real examples of the person's own best writing and a hard checker for AI tells. This skill is that for RemyAI. Use it together with `social`, `copywriting` and the `humanizer` skill; this file wins where they differ.

## Steps, every time

1. Read `voice.md` in this folder in full: the voice, the limits and the real examples. If the "Real examples" section is still empty, say so to Dilan and ask for 10 to 15 posts or messages he wrote himself that he likes.
2. Write from facts only: features that are live for students (`shared/features.ts`), numbers we can show, quotes people actually said. No invented outcomes, users, stats or testimonials.
3. Write the draft so it sounds like the examples, not like marketing.
4. Save the draft to a text file and run the checker:
   `node .claude/skills/remy-voice/check-post.mjs draft.txt` (or pipe text on stdin). Fix every ERROR. Fix WARNINGs or say in one line why each one stays.
5. Show Dilan the draft as plain text he can copy. Nothing is posted or sent for him; Buffer gets drafts only.
6. When Dilan rejects or rewrites a line, add a one-line rule under "Learned" in `voice.md` (and a pattern in `check-post.mjs` if it can be caught by a regex).

`node .claude/skills/remy-voice/check-post.mjs --self-test` checks the checker.
