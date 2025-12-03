# Riftfall News Daemon

TypeScript daemon that summarizes Riftfall war activity every 6 hours, writes news to GitHub, and performs a hardwipe when every continent falls.

## Features

- Pulls state from Supabase (continents, totals, per-role, last 10 defenses, top defenders).
- Generates AI-assisted summaries (Cloudflare Workers AI, with graceful fallback when unavailable).
- Appends news items to `data/news/news.json` in a GitHub repo.
- Detects full-world collapse, emits `cycle_end` + `cycle_reset` news, and resets DB health + defense logs.
- Stubbed Discord webhook helper for easy future alerts.

## Running locally

1) Copy `.env.example` to `.env` and fill in required values.  
2) Install dependencies: `npm install`.  
3) Run once: `npm run start`.

Environment variables of note:

- `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` – service role recommended.
- `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_AI_MODEL` – optional; summaries fall back to deterministic text if missing.
- `GITHUB_TOKEN` – PAT with `repo` scope to read/write the news file.
- `GITHUB_REPO` – `owner/repo`, e.g. `riftfall/riftfall-world`.
- `NEWS_FILE_PATH` – path to the JSON file in the repo (default `data/news/news.json`).
- `DISCORD_WEBHOOK_URL` – optional.
- `MAX_NEWS_ITEMS` – default 200.

## GitHub Actions cron

`.github/workflows/news-daemon.yml` runs on `0 */6 * * *` and `workflow_dispatch`. Provide the same env vars as encrypted secrets.

## JSON format

`news.json` structure:

```json
{
  "version": 1,
  "generated_at": "2024-01-01T00:00:00Z",
  "items": [
    {
      "id": "nanoid",
      "type": "summary | cycle_end | cycle_reset",
      "title": "Short headline",
      "body": "Multi-sentence news text.",
      "created_at": "ISO timestamp",
      "meta": {
        "continent_code": "asia | ... | null",
        "fallen_continents": ["asia"],
        "top_defenders": [
          { "username": "Player", "role": "defend", "continent_code": "asia", "total_score": 123 }
        ],
        "cycle_number": 1
      }
    }
  ]
}
```

The daemon preserves history (trims to `MAX_NEWS_ITEMS`), so Unity/website can fetch a single stable JSON.
