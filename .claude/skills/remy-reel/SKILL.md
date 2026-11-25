---
name: remy-reel
description: Use when making any Remy marketing or launch video (Instagram/TikTok Reel, LinkedIn clip, YouTube cut, website hero). Remy's house rules for story, footage, motion, sound and review, plus the local recording rig.
---

# Remy reel

Remy's own rules for video, written after several launch reels were rejected (Nov 2026). The Remotion plugin teaches correct code; this skill holds the taste. Read it fully before planning a video, and add a one-line rule at the bottom every time Dilan or the team rejects something.

Related skills in this repo: `video` (approaches, AI video tools, edit anatomy, code-rendered product films), `social` (what to post, hooks, platforms), `ad-creative` (hooks, specs, safe zones), `copywriting`, `launch`, `product-marketing`. Remy's rules below win where they differ.

## The process (every step ends with something Dilan approves)

1. **Fact list.** Write every claim the video will make, each with its proof: the file or screen in the app that shows it. Only live, released features (check `shared/features.ts`; locked or owners-only features can only appear as "coming next"). No numbers, results or quotes we can't show. Dilan approves the list.
2. **Script and shot list.** One student, one goal, three proofs, one call to action. A timed table: beat, time, on-screen words, clip and crop, sound. Hook in the first second; 23–45 s total. Dilan approves the script before any footage.
3. **Record.** Real site, student view (owner toggle hidden), a fictional student with believable data, run locally (see Rig). Record each beat as its own short clip.
4. **Build.** Remotion. Every timing is a named constant derived from the beat list, so the whole cut can be re-timed to the music.
5. **Sound.** Music first, then mark its beats and cut on them. UI sounds only on real clicks. Voice: a real person is best; an AI voice only if it passes a human ear check (Dilan has ElevenLabs). Mix to −14 LUFS, −1 dBTP.
6. **Frame check.** Render stills at every beat into a contact sheet and look at each one: readable on a phone, inside the safe zone, nothing overlapping or cut off, nothing moving without a reason. Dilan reviews the sheet before the final render.
7. **Ship.** Run `/brand-review` and the claims check, render 9:16 (plus a voice-only cut so a trending song can be added in Instagram), and save as a draft only. Nothing is posted for Dilan.

## Story

- Open on the student's problem or the result in second one. No logo, no fade in, no "Introducing".
- Alternate a claim card (1–5 big words) with a proof shot (one real piece of UI). 2–4 s per beat.
- Pick one story and prove it three times. Don't tour every feature.
- Include one trust beat: the original-vs-proposed screen where the student accepts, edits or skips a rewrite ("Remy never makes anything up").
- One call to action at the end: "Free during beta" and remyai.org. Never "free" any other way.
- It must make sense on mute: every spoken point also appears as words on screen.
- No CREATE program mention before Dec 1 2026, 12 PM CT. Present RemyAI as a company, never a student project.

## Footage and framing

- Real UI only, from the real app. Never redraw, mock or invent screens. No AI-generated people.
- Never shrink a whole desktop page into 9:16; it's unreadable. Show one component at a time (a job card, the chat answer, the resume line), large, on Remy's paper/ink/orange tokens. Body text ≥ 40 px at 1080×1920.
- No camera punch-ins or zooms into the site (rejected twice). If something must get bigger, record it bigger (browser zoom) or crop the component.
- Hold each real-UI crop at least 2 s. About 0.3 s of screen time per word on cards, 1 s minimum.
- Safe zone for 1080×1920: keep text out of the top ~270 px, bottom ~670 px and ~65 px sides.
- Remy the fox: no walking, pushing, spinning or other character animation, and no "R in an orange circle" mark (rejected).

## Motion

- One deliberate move per moment; only animate the thing the words point at.
- Smooth ease-out, no bounce, no glitch, no lens flare, no neon glow, no purple gradients, no random drift.
- Hold the last frame 0.8–1.2 s.
- Same type (Plus Jakarta Sans), colours and easing in every shot.

## Rig (local recording)

- Run the app locally with a fictional owner account and a local database (see `docs/development.md`), e.g. `OWNER_EMAILS=<test email> OR_DB_PATH=/tmp/<dir>/pg npm run dev`.
- `scripts/fake-ai.cjs` is a stand-in OpenAI-compatible server for scripted chat replies (point `CUSTOM_CRED_OPENROUTER_AI_URL` at it with `OR_AI_CHAIN=openrouter:demo/remy`). It's for recordings only; its reply must say only what the app really does. Edit its paths before use.
- `scripts/record.cjs <scenes.js> <name> <width> <height>` records clips with a CDP screencast (`DESK=1` for desktop, `DPR=2`). It hides the owner toggle and the AI setup banner and draws a soft tap circle on clicks. Edit its paths before use.
- Render Remotion with the preinstalled Chromium (`--browser-executable=/opt/pw-browsers/...chrome-headless-shell`) and a local font file.

## Rejected before (don't repeat)

- v3: zoomed crops of the site look weird; voice must not sound AI.
- v4/v5: floating fox head, fox walking/pushing/spinning, chapter labels, the R-circle logo, phone UI instead of the website.
- v6: zoom punch-ins into the website.
- v7: whole desktop site shrunk into 9:16 with no words: "honestly trash".
