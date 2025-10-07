# October 2025 Overhaul – IDE‑Ready Revision Plan (Captured)

This document captures and normalizes the requested October 2025 gameplay overhaul deltas for the Clash Intelligence Dashboard. It is non‑prescriptive and planning‑only. No code changes are implied by this doc.

Status: captured for planning; pending scoping/estimates.

## Executive Summary
- Game split into Battle (Farming) and Ranked (Competitive) modes.
- 34‑tier Ranked league architecture (33 divisions + Legend), weekly tournaments, frozen defense.
- New economic parameters (loot multipliers by TH gap, loot cart decrease), Magic Shield/Legend Shield.
- Hero cap changes: 15 levels moved from TH15 to TH14 (BK/AQ/GW +5 each).
- Spring Trap rework and meta shifts (defense, equipment).

## Data Model & Types (planned deltas)
File: `web-next/src/types/index.ts`
- Member fields (planned additions/clarifications):
  - `rankedTrophies: number`
  - `rankedLeague: { id: number; name: string; tier: number }`
  - `leagueFloor: { th: number; id: number; name: string }`
  - `tournamentStats: { seasonId: string; attacksUsed: number; attacksMax: number; offTrophies: number; defTrophies: number; offAvgDestruction?: number; defAvgDestruction?: number; rank?: number; promotion?: 'promoted'|'retained'|'demoted'|'decay' }`
  - `shieldStatus: { type: 'none'|'magic'|'legend'; durationHours: number; lootProtected: boolean; revengeAvailable: boolean }`
  - Clarify `trophies` → Battle/Farming trophies; keep `battleModeTrophies` as alias/back‑compat
- Hero caps table: adjust TH14 maxes (BK/AQ/GW +5) and exclude TH weapon levels from rush calcs.
- Roster snapshot metadata additions:
  - `defenseSnapshotTimestamp?: string; defenseSnapshotLayoutId?: string` (ranked defense freeze context)

## Database Schema (planned migrations)
Create new migration (placeholder name): `202510XX_ranked_league_migration.sql`
- members / member_snapshot_stats (ensure presence; many columns already exist from 2025‑01 migrations):
  - Add/confirm: `ranked_trophies`, `ranked_league_id`, `ranked_league_name`, `league_floor_id` (indexed)
- New table: `member_tournament_stats` (weekly rollup)
  - `member_id uuid fk members`, `season_id text`,
  - `attacks_used int`, `attacks_max int`,
  - `offense_trophies_gained int`, `defense_trophies_gained int`,
  - `offense_avg_destruction numeric`, `defense_avg_destruction numeric`,
  - `tournament_rank int`, `promotion_status text check in ('promoted','retained','demoted','decay')`, timestamps, indexes (member_id, season_id)
- metrics (derived): planned metric_names
  - `starry_ore_acquisition`, `loot_multiplier_efficiency`, `magic_shield_triggers`, `revenge_success_rate`

## Ingestion Pipeline (planned changes)
File: `web-next/src/lib/ingestion/staged-pipeline.ts`
- fetch: accommodate dual‑mode API (Battle vs Ranked), handle extended final Legend season through Oct 6.
- transform: map 34‑tier league ids/names; compute league floor by TH; normalize ranked defense snapshot/meta.
- write stats: 
  - Rush%: update hero caps for TH14; exclude TH weapon from computation.
  - ACE: redefine PAR using ranked attacks used/max; DVA using defensive trophies gained & defense snapshot effectiveness; keep DON but note economic shift.

## API (planned changes)
- GET `/api/v2/roster` should surface `rankedTrophies`, `rankedLeague`, `leagueFloor`, `tournamentStats` if available.
- Consider `GET /api/ranked/defense-snapshot-details?clanTag=…` for frozen defense insights.
- Maintain ETag governance (`payloadVersion`/`ingestionVersion`) despite higher tournament cadence.

## UI/UX (planned changes)
- Store: extend `Roster` typing (planned fields), add `activeTournamentId`, `weeklyAttackPacingStatus`, `isLeagueDecayRisk` (computed/derived).
- RosterSummary/Table: prioritize `rankedTrophies` display; adopt 34‑tier league icons/labels; surface league floor prominently.
- New panels: 
  - Weekly Tournament card (attacks remaining, group rank, promotion/demotion band, link to defense snapshot).
  - Defense insights (defensive trophy gain average; highlight consistent 1‑star defenses).
- QuickActions: potential “Send Tournament Signup Reminder”.

## Gameplay & Calc Specs (to document in spec)
- Multi‑mode definitions (Battle vs Ranked): shields, limits, matchmaking overview.
- Ranked scoring reference: attacker/defender trophy pool (max 40), 3*/2*/1* mapping, defender earns (40 – attacker’s earn).
- Spring Trap rework summary; equipment meta flagging for insights.
- Economic updates: TH loot multipliers (120%..200%), loot cart 10%.

## Actionable Backlog (not implemented)
Priority P1 unless stated otherwise. Owners TBD.
- Types: add planned fields; update hero caps (TH14) [types/calculations] (P1)
- DB: create `member_tournament_stats`, add league floor columns and indexes (P1)
- Ingestion: ranked data parsing, floor computation, ACE PAR/DVA refactor (P1)
- API: extend `/api/v2/roster` response fields; evaluate new ranked defense endpoint (P2)
- UI: tournament card + defense insights; shift trophies to ranked; league visuals (P1)
- Metrics: add new metric_names, collection strategy (P2)

## Open Questions / Assumptions
- Exact CoC API surface for ranked weekly stats and defense snapshot metadata.
- League tier ID → name mapping authoritative source and icon assets.
- Revenge & Magic Shield counters availability via API vs. derived.

## Links
- Spec anchor: `docs/APP_SPEC.md` → “Upcoming Changes (Oct 2025 Overhaul)”
- Checklist: `PLANNING_NOTES.md` → “October 2025 Overhaul: Task Checklist”

*** End of captured plan ***
