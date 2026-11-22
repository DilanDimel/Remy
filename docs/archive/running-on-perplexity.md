# Running Remy outside Perplexity

Remy is a standard Node.js app: Express server + React (Vite) front end + SQLite.

## 1. Install and run locally
Requires Node.js 20+.

```bash
npm install
npm run dev            # development at http://localhost:5000
# or production:
npm run build
NODE_ENV=production node dist/index.cjs
```

## 2. AI keys (environment variables)
Set `OR_AI_CHAIN` to a comma-separated list of `provider:model` entries, tried in order. Then set the key for each provider you list.

| Provider | Key variable | Example chain entry |
|---|---|---|
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter:google/gemini-3.8-flash` |
| Google Gemini | `GEMINI_API_KEY` | `gemini:gemini-3.8-flash` |
| Claude (via OpenRouter) | `OPENROUTER_API_KEY` | `openrouter:anthropic/claude-sonnet-5.5` |

Example:
```bash
export OR_AI_CHAIN="openrouter:google/gemini-3.8-flash,gemini:gemini-3.8-flash"
export OPENROUTER_API_KEY=...   # never commit keys
export GEMINI_API_KEY=...
```
Without any key the app still runs, and the AI features show "Needs setup".

## 3. Optional settings
- `GOOGLE_CLIENT_ID`: turns on "Continue with Google". Add your site's URL as an authorized JavaScript origin in Google Cloud Console.
- `OR_DB_PATH`: where the SQLite file lives (default `data.db`).
- `PORT`: server port (default 5000).

## 4. Hosting
Use any Node host with a persistent disk, such as Render, Railway or Fly.io:
- Build command: `npm ci && npm run build`
- Start command: `NODE_ENV=production node dist/index.cjs`
- Set the environment variables above in the host's dashboard.
- SQLite needs a persistent volume, or data resets on redeploy.

Sign-in sessions use a `__Host-` cookie, so the site must be served over HTTPS (all of these hosts do this).

## Perplexity-specific parts (safe to ignore elsewhere)
- `CUSTOM_CRED_*` variables: Perplexity's key proxy. Outside Perplexity, the app uses the plain keys above.
- `window.__API_BASE__="__PORT_5000__"` in `client/index.html`: Perplexity rewrites it during deploy. Elsewhere the app falls back to same-origin `/api` calls, which is correct.
- `OR_TRUST_VISITOR_HEADER`: used only for Perplexity previews. Leave it unset.
