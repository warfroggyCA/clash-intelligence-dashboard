## Core Types

Source: `@/types` (`web-next/src/types/index.ts`). The app shares a rich set of types for members, rosters, insights, and API responses.

### Highlights
- `Member` — core player record used across UI and APIs
- `Roster` — clan roster snapshot
- `ActivityLevel`, `ActivityEvidence` — activity tracking
- `PlayerEvent`, `EventHistory` — event history
- `PlayerDNAInsights`, `ClanDNAInsights`, `SnapshotSummaryAnalysis`
- `ApiResponse<T>` — standard API response wrapper
- `SortKey`, `SortDirection`, `TabType` — UI concerns
- `HERO_MAX_LEVELS`, `HERO_MIN_TH` — gameplay constants

Example `ApiResponse` usage:
```ts
import type { ApiResponse } from '@/types';
function respond<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}
```

Refer to the source for full definitions and field-level descriptions.