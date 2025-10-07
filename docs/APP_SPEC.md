# Clash Intelligence – Application Specification

This document provides a pragmatic, implementation‑ready specification of the Clash Intelligence dashboard so an IDE or engineer can quickly understand the purpose, architecture, data flow, and key calculations. It is grounded in the current codebase under `web-next/` and Supabase migrations in `supabase/`.

## Purpose & Scope
- Audience: Clash of Clans clan leaders and co-leaders.
- Goal: Provide a fast, snapshot‑first dashboard with analytics for roster health, war activity, donations, roster tenure, and AI “Smart Insights”.
- Secondary goals: Export/share summaries, trigger/monitor ingestion, and prepare for wars (opponent “pin”).

## High‑Level Architecture
- Frontend: Next.js (App Router) with React, Tailwind, Zustand store for client state.
- Backend: Next.js API routes that read/write Supabase (PostgreSQL + Storage) and call external APIs (CoC API, OpenAI when enabled).
- Data origin: Ingestion pipeline fetches clan + players from CoC API, writes normalized snapshots and per‑member stats into Supabase.
- Caching/versioning: ETags and payload/ingestion schema versions are used to avoid unnecessary roster reloads.

Key directories
- `web-next/src/app`: Next.js routes and API handlers.
- `web-next/src/components`: UI components (Roster, Insights, Layout, etc.).
- `web-next/src/lib`: Business logic (ingestion, snapshots, ACE score, config, stores, Supabase clients).
- `supabase/migrations`: SQL migrations for tables and indexes.

## Runtime Configuration (selected)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `COC_API_TOKEN`.
- `cfg.homeClanTag` default: `#2PR8R8V8P` (web-next/src/lib/config.ts).
- Feature flags (browser-safe): e.g., `NEXT_PUBLIC_ENABLE_INSIGHTS`, `NEXT_PUBLIC_RS_DEBUG_LOG`, `NEXT_PUBLIC_DISABLE_ROSTER_SUMMARY`.

## Core Data Model (TypeScript)
- Member (web-next/src/types/index.ts):
  - identity: `name`, `tag`
  - TH & heroes: `townHallLevel|th`, `bk|aq|gw|rc|mp`
  - stats: `trophies`, `versusTrophies`, `donations`, `donationsReceived`, `warStars`, `clanCapitalContributions`
  - leagues: `league{Id,Name,Trophies,IconSmall,IconMedium}`, `battleModeTrophies`, `rankedTrophies`, `rankedLeague*`, `equipmentFlags`
  - tenure: `tenure_days`, `tenure_as_of`
  - role/metadata: `role`, `metrics`, `extras`

- Roster:
  - `source: 'snapshot'|'live'|...`, `date`, `clanName`, `clanTag`, `members: Member[]`
  - Season/meta: `seasonId|Start|End`, `meta` (counts & versions), `snapshotMetadata` (payload/ingestion/schema versions, fetched/computed timestamps, war/capital counts)
  - `snapshotDetails` (optional): `currentWar`, `warLog`, `capitalRaidSeasons`

- Ingestion health summary (subset):
  - job lifecycle, phase durations, anomalies, `payloadVersion`, `ingestionVersion`, `schemaVersion`, `snapshotId`, timestamps.

## Database Schema (Supabase, key tables)
- `clans`, `members`: current roster entities (+ typed columns for leagues, ranked, tenure).
- `roster_snapshots`: per‑clan snapshot metadata and payload versioning (`payload_version`, `ingestion_version`, `schema_version`, `computed_at`, season columns).
- `member_snapshot_stats`: per‑member snapshot stats + derived fields (hero levels, rush%, donations, tenure, league splits).
- `metrics`: latest derived metrics by member (`rush_percent`, `donation_balance`, `donations_given`, `donations_received`) with `season_id`.
- `clan_snapshots`: full snapshot payloads (member summaries + player details + war/current raid context) for back‑compat and migrations.
- `ingestion_jobs` (+ logs): job status, per‑phase telemetry.
- `war_prep_pins`: pinned opponent for a clan (see war prep page and API).

Relevant migrations: `supabase/migrations/20250115_*` (typed fields, season columns, tenure columns), `20251012_create_war_prep_pins.sql`.

## Data Flows

1) Ingestion pipeline (server‑side)
- Entrypoint: `runStagedIngestion` (web-next/src/lib/ingestion/staged-pipeline.ts)
- Phases: fetch (CoC API) → transform → upsert members → write snapshot → write stats + derived `metrics`.
- Versioning: sets `payload_version`, `ingestion_version`, `schema_version`, plus season fields. Logs per‑phase results to `ingestion_jobs`.

2) Dashboard bootstrap (server → client)
- Server (web-next/src/app/page.tsx) attempts `buildRosterSnapshotFirst(homeClanTag, 'latest')` for initial paint.
- Client store (Zustand) sets `initialRoster` and `initialClanTag` in `ClientDashboard`.

3) Client roster loading and caching
- Store action `loadRoster(clanTag, {mode?, force?})` computes a plan (snapshot‑first, live fallback) via `buildRosterFetchPlan` and fetches `/api/v2/roster`.
- ETag governance: `If-None-Match` uses `payloadVersion` (strong) or `ingestionVersion` (weak). 304 → keep state; otherwise transform via `transformResponse` (web-next/src/lib/data-spine-roster.ts) and `setRoster`.
- Local cache: last roster persisted in `localStorage` with versions and timestamps; hydrated at app start if fresh (<5 min) and schema matches.

4) Snapshot details and history
- `snapshotDetails` includes `currentWar`, `warLog`, `capitalRaidSeasons` (when available via `clan_snapshots` or snapshot payload).
- `loadHistory` merges AI summaries from Supabase/localStorage and server changes from `/api/snapshots/changes` with TTL caching.

5) Smart Insights (AI)
- GET `/api/insights?clanTag=...` returns the latest `SmartInsightsPayload` (metadata, briefing, headlines, recognition, coaching, spotlights, diagnostics, context). Store caches and TTL‑governs.
- QuickActions `generateInsightsSummary` posts to `/api/ai-summary/generate` with recent changes and current clan context; results are persisted separately.

6) War Prep Pin
- GET/POST `/api/war/pin` stores/retrieves a pinned opponent (per clan) in `war_prep_pins` for war preparation workflows.

## Key API Endpoints (selected)
- `GET /api/v2/roster?clanTag=...` → snapshot‑first roster response with `clan`, `snapshot`, `members`, `season*`. 304 honored via ETag.
- `GET /api/insights?clanTag=...` → latest `SmartInsightsPayload`; `POST` saves a provided payload (admin‑guarded).
- `GET /api/snapshots/changes?clanTag=...` → member change summaries for insights.
- `POST /api/admin/run-staged-ingestion` → triggers pipeline; `GET /api/ingestion/health?clanTag=...` → latest job status/fingerprint.
- `GET|POST /api/war/pin` → manage opponent pin for war prep.

Refer to `web-next/src/app/api/*` for full list; these routes are thin facades over Supabase admin/server clients and helpers in `src/lib`.

## Client State (Zustand) – Dashboard Store
File: `web-next/src/lib/stores/dashboard-store.ts`
- Core fields: `roster`, `clanTag`, `homeClan`, `status`, `message`.
- Snapshot: `snapshotMetadata`, `snapshotDetails`, `availableSnapshots`, `selectedSnapshot`.
- History/insights: `historyByClan`, `smartInsights{,Status,Error,ClanTag}`, timestamps.
- Leadership/access: `currentUser`, `userRoles`, `impersonatedRole`, `accessPermissions`.
- UI: active tab, sorting/pagination, modals/toggles.
- Ingestion: `ingestionHealth`, `isTriggeringIngestion`, `lastKnownIngestionVersion`, `latestSnapshotVersion`.
- Actions: `loadRoster`, `refreshData`, `loadIngestionHealth`, `loadSmartInsights`, `hydrateRosterFromCache`, departure notifications, etc.

## UI Composition
- Main shell: `ClientDashboard` renders per‑tab content. Roster tab = `RosterSummary` + `RosterTable`.
- Quick actions: `QuickActions` – copy summary/JSON, export JSON/CSV, trigger insights, refresh snapshot.
- War prep: `app/war/prep` page uses war opponent pin and public profile fetch to prep.
- Insights UX: `components/insights/*` renders Smart Insights headlines, briefing, spotlights.

## Calculations & Business Logic

1) Rush Percentage (member‑level)
- Source: `web-next/src/lib/business/calculations.ts`.
- For heroes available at member’s Town Hall, compute per‑hero deficit: `(maxLevel - currentLevel)/maxLevel`.
- Rush% = average of deficits × 100, rounded. Caps from `HERO_MAX_LEVELS` in `types`, with unlock minima in `HERO_MIN_TH`.

2) Donation Balance
- `given = donations`, `received = donationsReceived`.
- Balance and net‑receiver checks power “Top Donation Balance” and “Deficit Watch” lists.

3) ACE Score (All‑Mode Clan Excellence)
- Source: `web-next/src/lib/ace-score.ts` (+ spec referenced in code).
- Components: OVA (offense vs expectation), DVA (defense), PAR (participation), CAP (capital raids), DON (donations/balance).
- Robust standardization, shrinkage by sample size, weighted sum → logistic squash → availability multiplier (0.70–1.05 clamp).
- UI: `RosterSummary` shows leader and availability; `AceLeaderboardCard` provides breakdown.

4) Season Computation
- Season starts UTC 05:00 on the 1st; ends UTC 05:00 on the last Monday of month. Special case October 2025.
- Applied in ingestion (`staged-pipeline`) and runtime normalization when roster season fields are missing.

5) Summary Metrics (RosterSummary)
- Member count, avg Town Hall, avg trophies, total/avg donations, avg builder trophies, average hero levels (available heroes only).
- War section: current war opponent/state/size/time; recent war log with win‑rate and record.
- Highlights: Top donors, best (lowest) hero rush %, donation balance leaders/deficits, high rush alerts; optionally top capital contributors.

6) Data Age & Soft Refresh
- Selector computes hours since `snapshotMetadata.fetchedAt`. If >12h, soft refresh on focus (min 30m between attempts) unless disabled by flag.

## Roster Fetch Policy & Transform
- `buildRosterFetchPlan(clanTag, selectedSnapshot)` produces ordered URLs (snapshot→live fallback) and preferred source.
- API `/api/v2/roster` assembles data from `roster_snapshots` plus `member_snapshot_stats` and `metrics` with fallback paths:
  - Prefer `clan_snapshots` if newer than latest `roster_snapshots`.
  - If no stats, derive from snapshot payload (member summaries + player details).
- `transformResponse` normalizes API response to `Roster` + `Member` shapes (hero levels, leagues, metrics, season fields), with defensive parsing for JSON string columns.

## Error Handling & Diagnostics
- Per‑route try/catch with structured JSON errors and rate limits (where applicable).
- Client logging gates: `NEXT_PUBLIC_DASHBOARD_DEBUG_LOG`, `NEXT_PUBLIC_RS_DEBUG_LOG` to trace mounts/renders and store updates.
- E2E concerns: React hydration safeguards in client‑only components via shell/wrapper pattern and dynamic imports with `ssr: false` where needed.

## Development Notes
- Environment validation is enforced server‑side in production (`lib/config.ts`). Browser builds avoid throwing to prevent early hydration failures.
- Store intentionally centralizes cross‑component state to reduce prop drilling and enable precise refresh policies.
- Use `normalizeTag` for all clan/player tag comparisons and keys.

## Extending the System (Guidelines)
- Add new derived metrics: compute during the `writeStats` phase and persist to `metrics` with a clear `metric_name` and `metadata`; surface via `member.metrics` in `/api/v2/roster`.
- New UI panels: source data via selectors; avoid direct store updates in render paths; prefer `useMemo` for computed props.
- New API routes: locate under `src/app/api/<feature>`; use `createApiContext`, zod schema validation, rate limiting helpers; keep Supabase access in `lib/*` helpers.
- War‑related features: expand `war_prep_pins` usage or add tables for target evaluation; keep clan/opponent tags normalized.

## Quick Reference (files)
- UI: `web-next/src/components/roster/RosterSummary.tsx`, `web-next/src/components/layout/QuickActions.tsx`
- Store: `web-next/src/lib/stores/dashboard-store.ts`
- Fetch plan: `web-next/src/lib/data-source-policy.ts`
- API roster: `web-next/src/app/api/v2/roster/route.ts`
- Snapshots: `web-next/src/lib/snapshots.ts`, `web-next/src/lib/full-snapshot.ts`
- Ingestion: `web-next/src/lib/ingestion/staged-pipeline.ts`
- ACE: `web-next/src/lib/ace-score.ts`
- Business calcs: `web-next/src/lib/business/calculations.ts`
- Config: `web-next/src/lib/config.ts`
- War pin API: `web-next/src/app/api/war/pin/route.ts`

---

This spec reflects the current implementation and is intended to be “close to the code”. If you want a machine‑readable JSON manifest (endpoints, types, selectors) for tooling, ask and we’ll generate `docs/app-spec.json` next.

