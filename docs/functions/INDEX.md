# Functions Index

Exported functions and services from `web-next/src/lib`.

## Core utilities
- tags: `normalizeTag`, `isValidTag`, `safeTagForFilename`, `sanitizeInputTag`
- utils: `cn`
- date: `ymdNowUTC`, `daysSince`, `daysSinceToDate`, `safeLocaleDateString`, `safeLocaleString`, `safeLocaleTimeString`
- logger: `createRequestLogger`
- api/route-helpers: `createApiContext`

## Data and snapshots
- snapshots: `convertFullSnapshotToDailySnapshot`, `detectChanges`, `loadSnapshot`, `getLatestSnapshot`, `getSnapshotBeforeDate`, `saveChangeSummary`, `loadChangeSummary`, `getAllChangeSummaries`, `calculateRealTimeActivity`, `calculateLastActive`
- full-snapshot: `fetchFullClanSnapshot`, `persistFullClanSnapshot`, `loadFullSnapshot`, `getLatestFullSnapshot`, `getAvailableSnapshotDates`
- insights-storage: `saveInsightsBundle`, `getLatestInsightsBundle`, `getLatestSmartInsightsPayload`, `getSmartInsightsPayloadByDate`, `saveSmartInsightsPayloadOnly`, `getInsightsBundleByDate`, `savePlayerDNACache`, `getPlayerDNACache`, `getPlayerDNACacheByPlayer`, `cachePlayerDNAForClan`, `getInsightsHistory`, `deleteOldInsightsBundles`, `getInsightsBundleStats`, `generateSnapshotSummary`
- data-spine-roster: `transformResponse`, `fetchRosterFromDataSpine`
- roster: `buildRosterSnapshotFirst`
- data: `readLedgerEffective`, `loadRoster`

## Access and security
- inbound-rate-limit: `rateLimitAllow`, `formatRateLimitHeaders`
- server/access-password: `generateAccessPassword`, `hashAccessPassword`, `passwordsMatch`
- server/access-service: `createAccessConfig`, `listAccessMembers`, `getAccessConfigSummary`, `authenticateAccessMember`, `addAccessMember`, `updateAccessMember`, `deactivateAccessMember`, `__resetMemoryAccessStore`

## Supabase
- supabase-server: `getSupabaseServerClient`
- supabase-admin: `getSupabaseAdminClient`
- supabase: `saveAISummary`, `getAISummaries`, `markAISummaryAsRead`, `markAISummaryAsActioned`

## Gameplay analytics
- war-metrics: `calculateTimeRemaining`, `calculateWarPerformance`, `analyzeMemberWarPerformance`, `calculateWarMetrics`, `generateWarAlerts`, `getTopWarPerformers`, `getMembersNeedingCoaching`
- player-dna: `calculatePlayerDNA`, `classifyPlayerArchetype`, `getArchetypeInfo`, `calculateClanDNA`
- insights-utils: `groupMemberChanges`, `formatAggregatedChange`
- member-league: `resolveMemberLeague`

## Leadership and tenure
- leadership: `clanRoleFromName`, `parseRole`, `checkLeadershipAccess`, `getRoleDisplayName`, `getRoleBadgeVariant`, `getRolePermissions`, `createLeadershipGuard`
- tenure: `parseTenureLedger`, `readLedgerEffective`, `readTenureLedger`, `parseTenureDetails`, `readTenureDetails`, `appendTenureLedgerEntry`

## Player history and cache
- player-history: `detectReturningPlayer`, `findPlayerByAlias`, `addAlias`, `processPlayerReturn`, `processPlayerDeparture`, `getReturningPlayerStats`, `formatMovementHistory`, `detectReturns`, `daysBetween`, `getTenureSummary`
- player-history-storage: `loadHistory`, `saveHistory`, `recordDeparture`, `recordReturn`, `findByAlias`, `getAllHistory`
- player-cache: `loadPlayerDetailFromCache`, `savePlayerDetailToCache`, `setPlayerCacheTTL`, `getPlayerCacheTTL`
- player-profile: `normalizePlayerTag`, `fetchPlayerProfile`
- player-resolver: `resolveUnknownPlayers`, `applyPlayerNameResolutions`

## Exporting
- export-utils: `formatElderPromotionsForDiscord`, `formatWatchlistForDiscord`, `formatAlertsForDiscord`, `formatWeeklySummaryForDiscord`, `copyToClipboard`, `toCSV`, `exportElderCandidatesToCSV`, `exportWatchlistToCSV`, `downloadCSV`

## Ingestion pipeline
- ingestion/queue: `enqueueIngestionJob`, `processQueue`
- ingestion/job-store: `createJobRecord`, `appendJobLog`, `upsertJobStep`, `updateJobStatus`, `getJobRecord`
- ingestion/run-ingestion: `runIngestionJob`
- ingestion/staged-pipeline: `runStagedIngestion`
- ingestion/run-staged-ingestion: `runStagedIngestionJob`, `runIngestionForClan`, `runDefaultClanIngestion`
- ingestion/persist-roster: `persistRosterSnapshotToDataSpine`
- ingestion/alerting: `sendIngestionAlert`, `sendIngestionFailure`, `sendIngestionWarning`
- ingestion/schedule: `ensureIngestionSchedule`

## Misc
- tab-config: `getVisibleTabs`, `tabIsVisible`
- toast: `showToast`
