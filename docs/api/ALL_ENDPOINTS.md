# All API Endpoints (Detailed Index)

This index enumerates every API route file under `web-next/src/app/api/**/route.ts`, the HTTP methods they expose, and quick usage examples. Refer to `docs/api/endpoints.md` for curated summaries.

Note: Some endpoints perform redirects or are internal/admin-only.

## Roster
- GET `/api/v2/roster`
  - Query: `clanTag?: string`
  - Example: `curl -s "https://your-host/api/v2/roster?clanTag=%232PR8R8V8P"`
- GET, POST `/api/roster` (deprecated → 301 to `/api/v2/roster`)
  - Example: `curl -i "https://your-host/api/roster"`

## Player
- GET `/api/player/[tag]`
  - Path: `tag` (e.g., `#2PR8R8V8P`)
  - Example: `curl -s "https://your-host/api/player/%232PR8R8V8P"`
- GET `/api/player/[tag]/history`
  - Query: `days=1..90` (default 30)
  - Example: `curl -s "https://your-host/api/player/%232PR8R8V8P/history?days=30"`
- GET `/api/player/[tag]/comparison`
  - Example: `curl -s "https://your-host/api/player/%232PR8R8V8P/comparison"`

## Snapshots
- POST `/api/snapshots/create`
  - Body: `{ "clanTag": "#2PR8R8V8P" }`
  - Example: `curl -s -X POST -H 'Content-Type: application/json' -d '{"clanTag":"#2PR8R8V8P"}' https://your-host/api/snapshots/create`
- GET `/api/snapshots/list`
  - Query: `clanTag: string`
  - Example: `curl -s "https://your-host/api/snapshots/list?clanTag=%232PR8R8V8P"`
- GET, POST `/api/snapshots/changes`
  - GET Query: `{ clanTag: string, date?: string }`
  - POST Bodies:
    - `{ action: "save", changeSummary: {...} }`
    - `{ action: "read" | "actioned", clanTag, date }`
  - Example (GET all): `curl -s "https://your-host/api/snapshots/changes?clanTag=%232PR8R8V8P"`

- POST `/api/upload-snapshots`
  - Body: `{ snapshots?: Record<string, any>, tenureLedger?: string }`
  - Example: `curl -s -X POST -H 'Content-Type: application/json' -d '{"snapshots":{}}' https://your-host/api/upload-snapshots`

## War
- GET `/api/war/opponent`
  - Query: `{ opponentTag?: string, ourClanTag?: string, autoDetect?: 'true'|'false', enrich?: number }`
  - Example: `curl -s "https://your-host/api/war/opponent?ourClanTag=%232PR8R8V8P&autoDetect=true&enrich=12"`
- GET, POST `/api/war/pin`
  - GET Query: `{ ourClanTag: string }`
  - POST Body: `{ ourClanTag: string, opponentTag: string }`

## Access and Tenure
- POST `/api/tenure/seed`
  - Body: `{ clanTag?: string }`
- POST `/api/tenure/update`
  - Body: see source schema; updates tenure rows
- POST `/api/tenure/save`
  - Body: `{ updates: Array<{ tag: string, tenure_days: number }> }`
- GET `/api/tenure/ledger`
  - Query: `{ clanTag?: string }` (safe parsed)
- GET `/api/tenure/map`

- POST, GET `/api/access/init`
  - POST Body: `{ clanTag: string, clanName: string, ownerName: string, ownerCocTag?: string }`
  - GET Query: `{ clanTag: string }`
- GET, POST `/api/access/list`
  - GET Query: `{ clanTag: string, accessPassword: string }`
  - POST Body: `{ action, ... }` see source

## Ingestion and Admin
- POST `/api/cron/daily-ingestion`
- GET `/api/cron/daily-snapshot`
- POST `/api/ingestion/run`
- GET `/api/ingestion/health`
- GET `/api/ingestion/jobs/[jobId]`
- POST, GET `/api/admin/trigger-ingestion`
- POST `/api/admin/run-ingestion`
- POST, GET `/api/admin/run-staged-ingestion`
- GET, POST, PATCH, DELETE `/api/admin/roles`
- POST `/api/admin/force-refresh`

## AI and Insights
- POST `/api/ai-summary/generate`
- POST `/api/ai-coaching/generate`
- GET `/api/ai/dna-cache`
- GET, POST `/api/insights`
- GET `/api/ai/batch-results`

## Applicants and Departures
- GET `/api/applicants/scan-clan`
- POST `/api/applicants/shortlist`
- GET `/api/applicants/evaluate`
- GET, POST `/api/departures`
- GET `/api/departures/notifications`
- POST `/api/migrate-departures`
- POST `/api/player-db/sync-departures`

## Diagnostics and Debug
- GET `/api/health`
- GET `/api/health/pipeline`
- GET `/api/diag/ip`
- GET `/api/diag/env`
- GET `/api/debug/flags`
- GET `/api/debug/data`
- GET `/api/debug/player`
- GET `/api/test-deploy`
- GET `/api/test-env`
- GET `/api/ip-test`

## Discord and MCP
- POST `/api/discord/publish`
- GET, POST `/api/mcp`
- GET `/api/mcp-tools`
- GET `/api/mcp-working`
- GET `/api/session`

## Full Snapshots
- GET `/api/full-snapshots`
