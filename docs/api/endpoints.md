## HTTP API Endpoints

All endpoints live under Next.js App Router in `src/app/api/.../route.ts`.

Each route exports HTTP method handlers like `export async function GET(req) { ... }`.

Below is the inventory with method(s), brief purpose, request/response shape, and example usage.

### Index

- /api/ip-test — GET
- /api/v2/roster — GET
- /api/player/[tag] — GET
- /api/player/[tag]/history — GET
- /api/player/[tag]/comparison — GET
- /api/roster — GET, POST
- /api/snapshots/list — GET
- /api/snapshots/changes — GET, POST
- /api/snapshots/create — POST
- /api/full-snapshots — GET
- /api/tenure/save — POST
- /api/tenure/update — POST
- /api/tenure/ledger — GET
- /api/tenure/seed — POST
- /api/departures — GET, POST
- /api/departures/notifications — GET
- /api/player-db/sync-departures — POST
- /api/applicants/scan-clan — GET
- /api/applicants/shortlist — POST
- /api/applicants/evaluate — GET
- /api/ai-summary/generate — POST
- /api/ai-coaching/generate — POST
- /api/ai/dna-cache — GET
- /api/insights — GET, POST
- /api/mcp — GET, POST
- /api/mcp-tools — GET
- /api/mcp-working — GET
- /api/upload-snapshots — POST
- /api/debug/data — GET
- /api/debug/player — GET
- /api/debug/flags — GET
- /api/diag/env — GET
- /api/diag/ip — GET
- /api/discord/publish — POST
- /api/health — GET, POST
- /api/health/pipeline — GET
- /api/ingestion/run — POST
- /api/ingestion/health — GET
- /api/ingestion/jobs/[jobId] — GET
- /api/cron/daily-snapshot — GET
- /api/cron/daily-ingestion — POST
- /api/admin/roles — GET, POST, PATCH, DELETE
- /api/admin/run-ingestion — POST
- /api/admin/trigger-ingestion — GET, POST
- /api/admin/run-staged-ingestion — GET, POST
- /api/admin/force-refresh — POST
- /api/war/opponent — GET
- /api/war/pin — GET, POST
- /api/access/init — POST, GET
- /api/access/list — GET, POST
- /api/player-resolver — GET
- /api/test-deploy — GET
- /api/test-env — GET

### Example

```bash
curl -s "${BASE_URL}/api/v2/roster?clanTag=%2329UQJJVJV" | jq
```

Response is wrapped as `ApiResponse` and typically includes `data` on success.

### Notes
- Many routes use `createApiContext(request, route)` for consistent logging and response helpers.
- Some routes require environment variables or auth; see `docs/operations/ingestion.md` and `docs/architecture/authentication.md`.
