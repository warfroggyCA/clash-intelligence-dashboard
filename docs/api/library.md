## Library Functions

Public library functions are exported under `@/lib/*`. Below are key modules and commonly used exports with example usage.

> Tip: Many modules return or accept types from `@/types`. See [Core Types](./types.md).

### API Helpers

- `createApiContext(req: Request, route: string)` from `@/lib/api/route-helpers`
  - Returns `{ logger, json }`. Use `json({ success, data }, { status })` to respond and automatically inject `requestId` and `x-request-id`.

Example:
```ts
import { createApiContext } from '@/lib/api/route-helpers';
export async function GET(req: Request) {
  const { json } = createApiContext(req, '/api/example');
  return json({ success: true, data: { ok: true } });
}
```

### Auth Guards

- `requireRole(req, allowedRoles)` from `@/lib/auth/guards`
  - Ensures the user is authenticated and has one of the roles; supports `x-api-key` bypass for automation.

### Snapshots

From `@/lib/snapshots`:
- `loadSnapshot(clanTag, date)`, `getLatestSnapshot(clanTag)`, `getSnapshotBeforeDate(clanTag, beforeDate)`
- `detectChanges(previous, current)`
- `saveChangeSummary(summary)`, `loadChangeSummary(clanTag, date)`, `getAllChangeSummaries(clanTag)`

### Full Snapshot Pipeline

From `@/lib/full-snapshot`:
- `fetchFullClanSnapshot(clanTag)`, `persistFullClanSnapshot(snapshot)`, `getLatestFullSnapshot(clanTag)`, `getAvailableSnapshotDates(clanTag)`

### Ingestion Jobs

From `@/lib/ingestion/*`:
- `runIngestionJob(options)`, `runStagedIngestionJob(options)`, `runDefaultClanIngestion(options)`
- `enqueueIngestionJob(clanTag)`, `processQueue()`
- `createJobRecord(jobId, clanTag)`, `appendJobLog(jobId, entry)`, `updateJobStatus(jobId, status, result?)`, `getJobRecord(jobId)`

### Insights Storage

From `@/lib/insights-storage`:
- `saveInsightsBundle(results)`, `getLatestInsightsBundle(clanTag)`, `getInsightsHistory(clanTag, limit)`
- `getLatestSmartInsightsPayload(clanTag)`, `getSmartInsightsPayloadByDate(clanTag, date)`, `saveSmartInsightsPayloadOnly(payload)`

### Player and Roster Utilities

- `fetchRosterFromDataSpine(clanTag)` and `transformResponse(body)` from `@/lib/data-spine-roster`
- `buildRosterSnapshotFirst(clanTag, date)` from `@/lib/roster`
- `fetchPlayerProfile(tag)` from `@/lib/player-profile`
- `resolveUnknownPlayers()` from `@/lib/player-resolver`
- `readDepartures(clanTag)`, `addDeparture(clanTag, departure)`, `getActiveDepartures(clanTag)` from `@/lib/departures`

### Analytics / Calculators

- `calculatePlayerDNA`, `classifyPlayerArchetype`, `calculateClanDNA` from `@/lib/player-dna`
- `calculateWarMetrics`, `generateWarAlerts` from `@/lib/war-metrics`
- `formatElderPromotionsForDiscord`, `toCSV`, `downloadCSV` from `@/lib/export-utils`

### Access Management

From `@/lib/server/access-service`:
- `createAccessConfig`, `listAccessMembers`, `getAccessConfigSummary`, `authenticateAccessMember`, `addAccessMember`, `updateAccessMember`, `deactivateAccessMember`

### Misc

- `normalizeTag`, `isValidTag`, `sanitizeInputTag` from `@/lib/tags`
- `ymdNowUTC`, `safeLocaleDateString`, `safeLocaleString`, `safeLocaleTimeString` from `@/lib/date`
- `rateLimitAllow`, `formatRateLimitHeaders` from `@/lib/inbound-rate-limit`
- UI helper `cn` from `@/lib/utils`
