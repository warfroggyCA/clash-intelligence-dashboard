# Endpoints

## Roster

### GET /api/v2/roster
- Description: Fetch latest roster snapshot with member metrics
- Query: `{ clanTag?: string }`
- Responses:
  - 200: `{ success: true, data: { clan, snapshot, members, seasonId, seasonStart, seasonEnd } }`
  - 304: Empty body with ETag when unchanged
  - 400/404/500: `{ success: false, error }`
- Example:
```bash
curl -s "https://your-host/api/v2/roster?clanTag=%232PR8R8V8P"
```

### GET /api/roster (deprecated)
- Description: Redirects to `/api/v2/roster` (301)

## Player

### GET /api/player/[tag]
- Description: Fetch a single player from CoC API with normalized hero levels
- Path params: `{ tag: string }` like `#2PR8R8V8P`
- Rate limit: 60/min per IP
- Responses: 200/400/403/404/429/500
- Example:
```bash
curl -s "https://your-host/api/player/%232PR8R8V8P"
```

### GET /api/player/[tag]/history
- Query: `?days=1..90` (default 30)
- Response: `{ success, data: HistoricalDataPoint[] }`

### GET /api/player/[tag]/comparison
- Description: Compare a player against current roster metrics
- Response: `{ success, data: PlayerComparisonData }`

## Snapshots

### POST /api/snapshots/create
- Body: `{ clanTag: string }`
- Creates full snapshot, persists it, runs change detection and AI summary.

### GET /api/snapshots/list
- Query: `{ clanTag: string }`
- Returns available snapshot dates and counts.

### GET /api/snapshots/changes
- Query: `{ clanTag: string, date?: string }`
- Returns summaries or all summaries per clan.

### POST /api/snapshots/changes
- Body: `{ action: 'read'|'actioned' }` or `{ action:'save', changeSummary }`

### POST /api/upload-snapshots
- Body: `{ snapshots?: Record<string, any>, tenureLedger?: string }`

## War

### GET /api/war/opponent
- Query: `{ opponentTag?: string, ourClanTag?: string, autoDetect?: 'true'|'false', enrich?: number }`
- Consolidated opponent profile for war planning.

### GET /api/war/pin
- Query: `{ ourClanTag: string }`
- POST body: `{ ourClanTag: string, opponentTag: string }`

## Access & Admin (selected)

- GET/POST/PATCH/DELETE `/api/admin/roles` – manage admin roles
- POST `/api/admin/run-ingestion` – trigger ingestion
- POST `/api/admin/run-staged-ingestion` – run staged ingestion
- GET `/api/ingestion/jobs/[jobId]` – job status
- GET `/api/health` and `/api/health/pipeline` – health checks

## AI

- POST `/api/ai-summary/generate`
- POST `/api/ai-coaching/generate`
- GET `/api/ai/dna-cache`

## Applicants & Departures

- GET `/api/applicants/scan-clan`
- POST `/api/applicants/shortlist`
- GET `/api/applicants/evaluate`
- GET/POST `/api/departures`
- GET `/api/departures/notifications`

## Access

- POST/GET `/api/access/init`
- GET/POST `/api/access/list`

## Debug/Diag

- GET `/api/debug/flags`, `/api/diag/ip`, `/api/diag/env`
