# AI money card shows the real OpenRouter balance

- Admin → System "AI money left" now reads OpenRouter's account balance (GET /api/v1/credits: bought minus spent across all keys), with the live key's usage and cap as detail. Shows the lower of the two.
- OpenRouter may return /credits only to management keys. Optional `OPENROUTER_MANAGEMENT_KEY` is tried first, then the normal key; without either working, the card says it's only the key's cap.
- The card also shows which key the live server uses (name, or last 3 characters of a masked label).
- Files: server/platform/services.ts, client/src/pages/Admin.tsx, docs/development.md.
