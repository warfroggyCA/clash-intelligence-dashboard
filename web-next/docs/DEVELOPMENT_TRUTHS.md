# Clash Intelligence Development Truths

This document is a living guide. Update it whenever a rule, resolver, or data contract changes.

## Core Principles

- Simple Architecture is primary: backend calculates, frontend presents.
- Supabase is the Single Source of Truth (SSOT). No page should invent its own data.
- One roster snapshot feeds everything. If data changes in one view, it must change everywhere.
- Avoid the deprecated complex architecture. Use `/new/*` and Simple Architecture patterns.

## Canonical Data Resolvers (Use These)

- Roster data: `resolveRosterMembers` (`web-next/src/lib/roster-resolver.ts`)
- Current roster payload: `getCurrentRosterData` (`web-next/src/lib/roster-current.ts`)
- Roster API: `/api/v2/roster` (server route is the canonical shape for roster views)
- Player profile: `/api/v2/player/[tag]` must fall back to roster stats, not replace them

If you need roster fields, do NOT query `member_snapshot_stats` directly in a page.

## Consistency Rules

- Derivations (league, trophies, activity, tenure) must use the same fallback order everywhere.
- Roster, profile, assessment, leadership, and analytics must all use the same snapshot data.
- If a field is missing, prefer `null` and render `—` rather than inventing zeros.
- Never compute a metric in a page if a shared function already exists.

## Data Flow (Canonical)

Clash API → Ingestion → `member_snapshot_stats` → `resolveRosterMembers` → API routes → UI

The roster snapshot is the unit of truth. Analytics use the same roster snapshot unless
explicitly called out (e.g., war/capital analytics with their own time windows).

## CWL Planning (SSOT)

- CWL week roster lives in `cwl_eligible_members` and is frozen when `cwl_seasons.locked_at` is set.
- Day planners must hydrate from Supabase first (`cwl_eligible_members`, `cwl_opponents.roster_snapshot`, `cwl_day_lineups`).
- Opponent snapshots are persisted in `cwl_opponents.roster_snapshot`; do not overwrite them with null on setup saves.
- Attendance and lineup signals are persisted in `cwl_player_day_activity` and `cwl_attendance_rollups`; use `/api/cwl/attendance` for planning prompts.

## League / Trophy Resolution

All trophy and league rank resolution must follow the same fallback order:

1) `ranked_trophies`
2) `trophies`
3) `league_trophies`
4) `battle_mode_trophies`

League name resolution:

1) `ranked_league_name`
2) `league_name`
3) `rankedLeague?.name` (profile fallback only)

If this changes, update the roster resolver and all consumers.

NOTE: `ranked_trophies` may be zeroed by the weekly reset logic. Treat `ranked_trophies <= 0`
as missing and fall back to `trophies` for current ladder participation unless explicitly
working with Monday finals.

If trophies are unavailable or zero but a league name exists, derive league participation
from the ranked league name (tier score normalization) rather than forcing 0.

## Tenure

- Tenure is ledger-backed and should never reset due to dev work.
- Use `tenure_days` (or `tenure` alias) from the roster resolver and player history.
- If tenure is missing, treat it as unknown, not zero.
- Tenure gates (current policy): 30 days for Elder eligibility, 90 days for Co-leader eligibility.

## Activity Scoring

- Activity uses a 7-day lookback on `player_day` deltas plus real-time signals (donations, trophies, ranked league).
- If timeline data is unavailable, fall back to real-time signals only.
- Do not mark players inactive based solely on missing ranked trophies; use league name or trophies fallback.

## Leadership / Assessment

- Leadership assessment uses roster snapshot data and shared resolvers.
- Assessment output is persisted; running an assessment is required after data changes.
- Scores must be explainable and consistent with roster fields.
- Current band thresholds: Successor ≥ 82, Lieutenant ≥ 70, Core ≥ 50, Watch ≥ 40, Liability < 40.

## UI/UX Expectations

- No hidden state: if data is loading, show a ghost/skeleton state.
- Avoid horizontal scroll in key headers or primary navigation rows.
- Always ensure narrow screens still show critical badges and labels.

## When You Change Something

1) Update shared resolver or helper first.
2) Update consumers to use the resolver.
3) Re-run assessment/ingestion if the change affects persisted outputs.
4) Update this document.
