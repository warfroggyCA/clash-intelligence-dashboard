# Data Fetch & Write Inventory (Nov 2025)

This document catalogs the major data touchpoints across the Clash Intelligence dashboard so we can spot stale dependencies (e.g., legacy canonical tables, local JSON stores, unauthenticated fetches) and confirm each feature’s expected read/write flow.

Legend: `ROUTE` = Next.js API handler path, `DB` = Supabase tables / views, `AUTH` = guard or token requirement, `NOTES` highlight risks or TODOs.

---

## 1. Core Roster / Dashboard
- **UI / Store**: `dashboard-store.ts` (`loadRoster`, `loadSmartInsights`, `loadJoiners`, etc.), `/app/page.tsx`, `/components/simple-roster/*`.
- **Primary routes**
  - `GET /api/v2/roster` → DB: `roster_snapshots`, `member_snapshot_stats`, `members`, `canonical_member_snapshots`, `player_day`, `vip_scores`. `AUTH`: server-side service role, no client auth needed. **Note** caching 12h; force refresh needed for immediate updates.
  - `POST /api/admin/force-refresh` → triggers `fetchFullClanSnapshot` then `persist_full_snapshot`. Writes to `roster_snapshots`, `member_snapshot_stats`, `canonical_member_snapshots`, `player_day`, `clan_capital_*`, change summaries, insights bundle. `AUTH`: `requireLeadership` or leadership token header. **Risk**: relies on valid Clash API key + Supabase write perms.
  - `POST /api/admin/capital-ingestion` → DB: `capital_raid_*`. `AUTH`: `requireLeadership`.
  - `GET /api/insights` & `GET /api/news-feed/...` (via store `loadHistory/loadSmartInsights`). DB: `change_summaries`, `insights_bundle`, `smart_insights` materialized data. `AUTH`: `requireLeadership`.
  - `GET /api/joiners`, `GET /api/departures/notifications` used for leadership alerts. DB: Supabase JSON buckets via `lib/joiners`/`lib/departures` (file-backed). **Risk**: still using filesystem/JSON; consider migrating to Supabase tables.
- **Notes**
  - Dashboard header/Quick Actions rely on Zustand state hydrated from `/api/session` + `/api/v2/roster`.
  - Ensure any component still importing `/api/roster` hits the v2 redirect.

## 2. War Planning & Opponent Analysis
- **UI**: `/app/war/page.tsx`, war planning components, selection lists.
- **Routes**
  - `GET /api/v2/war-planning/our-roster` → DB: `roster_snapshots`, `member_snapshot_stats`, `members`. `AUTH`: server-side; no explicit guard yet (leadership-only UI). Recently switched off `canonical_member_snapshots`.
  - `GET /api/v2/war-planning/opponents` → tries Supabase canonical snapshots, falls back to live Clash API (via `COC_API_TOKEN`) and upserts into `clans`. `AUTH`: none (leadership UI). **Risk**: API token quotas + missing Supabase clan rows.
  - `POST /api/v2/war-planning/matchup` → DB: reads `canonical_member_snapshots` for tagged players, writes nothing. Calls `war-planning/analysis` + optional AI summarizer. `AUTH`: none.
  - `POST /api/v2/war-planning/plan`, `GET /plan`, `POST /selected`, `/our-selection`, `/opponents`, etc. DB: `war_plans`, `war_plan_profiles` (see route). `AUTH`: `requireLeadership`.
  - Legacy helpers: `/api/war/opponent`, `/api/war/pin`, `/api/war/history` still store pinned opponents & history in Supabase tables (`war_center_history`, etc.).
- **Notes**
  - UI now auto-loads our roster; ensure `our-clan-tag` state remains synced with Settings.
  - Opponent roster fallback uses profile data; still dependent on canonical snapshot freshness.

## 3. Leadership Utilities (Access / Departures / Joiners / News)
- **Access management** (`SettingsContent`, `LeadershipGuard`, `PermissionManager`)
  - Routes: `GET/POST/PATCH /api/admin/roles` (DB: `clan_roles`, Supabase auth tables) – `requireLeadership`.
  - `POST /api/admin/provision-user` (if present) to seed Supabase accounts.
  - `GET /api/access/permissions`, `/api/access/impersonation` for UI toggles.
- **Departures / joiners / departure manager**
  - `GET/POST /api/departures`, `/api/departures/notifications`, `/api/joiners` rely on `lib/departures` & `lib/joiners` which currently persist to JSON/kv (not Supabase). **Risk**: brittle, no per-user auth, subject to rate limits.
  - `POST /api/player-actions` (tenure/departure actions) writes to `player_actions` table w/ `requireLeadership`.
- **News / Insights**
  - `GET /api/news-feed/summary`, `/api/news-feed/highlights`, `/api/news-feed/action-queue`. Data sources: `smart_insights`, `change_summaries`, `vip_scores`, `clan_history`.
  - `POST /api/news-feed/actioned` persists action state (table `insight_actions`).
- **Notes**: leadership panels still show stale member names when canonical data outdated—keep ingestion healthy.

## 4. Player Database & Linked Accounts
- **UI**: `/app/player-database/PlayerDatabasePage.tsx`.
- **Routes / Tables**
  - `GET/POST/PUT/DELETE /api/player-notes` → `player_notes`. Auto-prefix `created_by` via `getCurrentUserIdentifier`. `AUTH`: `requireLeadership`.
  - `GET/POST /api/player-warnings` → `player_warnings`.
  - `GET/POST /api/player-actions` → `player_actions` (tenure/departure logs).
  - `GET/POST /api/player-aliases` → `player_alias_links` (recent migration). Handles linked account restoration.
  - `GET /api/player-database` or `/player-db` (depending on legacy) loads aggregated data from Supabase views.
- **Recent change**: Add-player modal now accepts tag only; `/api/player-notes` backfills missing names.
- **Risks**: Several routes still query `canonical_member_snapshots` for lookups, meaning newly ingested players must exist there; ensure canonical population isn’t removed from ingestion pipeline.

## 5. Clan Games Tracker
- **UI**: `ClanGamesManager`, `ClanGamesHistoryCard`, `CapitalAnalyticsDashboard`.
- **Route**: `GET/POST/DELETE /api/clan-games`.
- **DB**: `clan_game_seasons`, optional `clan_game_participants` (future expansion).
- **Auth**: `requireRole` (`VIEW_ROLES` for GET, `EDIT_ROLES` for POST/DELETE).
- **Notes**: expects migration `20250216…` & Supabase policies; verify production DB includes table/policies.

## 6. Capital & War Analytics Dashboards
- **UI**: `CapitalAnalyticsDashboard.tsx`, `PlayerActivityAnalytics.tsx`, `ClanAnalytics.tsx`.
- **Routes**:
  - `GET /api/capital-analytics/...` (multiple endpoints for raid stats) – DB: `capital_raid_weekends`, `capital_raid_players`.
  - `GET /api/war-intelligence`, `/api/war/history`, `/api/war/summary` – DB: `war_history`, `war_events`.
  - `GET /api/cron/war-ingestion` (serverless cron) writes to war tables; requires Vercel cron token.
- **Auth**: mostly `requireLeadership`.
- **Notes**: Some analytics require multiple historical rows; consider “latest weekend summary” endpoint so UI shows something even with single sample (per user feedback).

## 7. Settings, Auth & Session
- **Settings panel** interacts with:
  - `POST /api/admin/force-refresh`
  - `POST /api/admin/capital-ingestion`
  - `GET/POST /api/admin/roles`
  - `POST /api/auth/session-sync` via `SupabaseSessionSync`.
- **Auth**
  - `/api/auth/*` handles Supabase + NextAuth integration.
  - `SupabaseSessionSync.tsx` subscribes to `supabase.auth.onAuthStateChange`.
  - `/app/login/page.tsx` now locked (no self-signup); leadership must provision accounts.
- **Notes**: verify `supabaseClient` env keys available in both server & client contexts; TypeScript error from build log already fixed (added `event` type).

## 8. Background Cron & Ingestion Hooks
- `app/api/cron/*` endpoints (war ingestion, raid ingestion, snapshots) expect Vercel Cron secret header.
- `scripts/pull_all_coc_data.sh` & `/api/full-snapshots`, `/api/upload-snapshots` support manual backfills; all use service-role key.
- **Risk**: Many of these still write to both old JSON caches and Supabase; ensure duplicates removed.

## 9. Miscellaneous Utilities
- `/api/player-resolver`, `/api/coc-player-names` → fetch from Clash API, cached via Supabase table `player_name_cache`.
- `/api/tracked-clans` manages `tracked_clans` table (list of clans to ingest nightly).
- `/api/faq` used by FAQ rewrite; data stored in `faq_entries`.
- `/api/logout` + `/api/session` maintain Supabase session cookie & Next router redirect.

---

## Observations & Recommended Follow-ups
1. **Legacy JSON stores** (`lib/departures`, `lib/joiners`, some `player_*` caches) bypass Supabase. Consider migrating to tables so writes survive across deploys and can be audited.
2. **Mixed data sources**: War planning still reads `canonical_member_snapshots` for player detail while roster uses `member_snapshot_stats`. Eventually migrate war planning to the same SSOT or ensure canonical stays fresh.
3. **Auth consistency**: Several leadership-only routes (war planning APIs, some news-feed endpoints) lack explicit `requireLeadership`—security relies on UI gating. Evaluate adding guards.
4. **AI configuration**: War-plan AI analysis only runs when `OPENAI_API_KEY` (and optionally `WAR_PLANNING_AI_MODEL`) is present server-side. Ensure the var is set in `.env.local`/project envs; otherwise the toggle silently falls back to heuristic summaries.
5. **Caching visibility**: `/api/v2/roster` caches 12h. Documented already, but Quick Actions should highlight when snapshot is stale and encourage force refresh.
6. **Automated checks**: Build lightweight integration tests that call each critical route with mocked Supabase to catch regressions when auth/session logic changes (the “broken fetch/write” symptoms you saw).

This inventory should be updated whenever new data features are added so we can quickly verify their fetch/write paths after auth or architecture changes.
