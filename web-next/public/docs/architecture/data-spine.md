# Data Spine Architecture

## Overview

The data spine consolidates clan telemetry inside Supabase so the dashboard no longer relies on JSON dumps or browser caches. The goals are:

- Provide an authoritative store for roster history, wars, capital raids, metrics, alerts, tasks, and notes.
- Decouple ingestion from rendering by persisting raw snapshots and derived stats nightly.
- Enable real-time dashboards, automation, and predictive analytics off consistent tables.

## Supabase Schema Highlights

| Table | Purpose |
| --- | --- |
| `clans` | Canonical clan metadata (tag, name, logo). |
| `members` | Current roster registry keyed by clan + tag. |
| `roster_snapshots` | Nightly roster snapshot metadata and raw payload. |
| `member_snapshot_stats` | Per-member metrics for a snapshot (TH, hero levels, rush %, donations). |
| `wars`, `war_attacks`, `war_defenses` | War activity, attack/defense performance. |
| `capital_raid_seasons`, `capital_attacks` | Capital raid participation and efficiency. |
| `tenure_ledger` | Effective tenure ledger for historical tracking. |
| `metrics` | Derived metrics (trend windows, activity scores, etc.). |
| `alerts`, `tasks`, `notes` | Leadership tooling (alerts, assignments, player notes). |
| `user_roles` | Role mapping between Supabase auth users and clans. |
| `settings` | Clan-specific configuration (thresholds, webhook URLs). |
| `ingest_logs` | Audit trail for automated jobs. |

## Ingestion Flow

1. **Fetch** – `fetchFullClanSnapshot` pulls the current roster, player details, war/capital context via the Clash API.
2. **Persist** –
   - Local JSON backup (optional in development).
   - `persistRosterSnapshotToDataSpine` upserts clan/members, stores the snapshot, and inserts member metrics.
3. **Change detection / insights** – Existing automation (change summaries, Smart Insights, departures) runs after persistence.
4. **Scheduling** – A Supabase cron/edge function or external scheduler should call `/api/admin/run-ingestion` nightly. (`ingestion/schedule.ts` exists for node-cron setups if we self-host jobs.)

## Frontend Hydration

- `/api/v2/roster` aggregates the latest snapshot + member stats directly from Supabase.
- The Zustand store (`loadRoster`) first attempts to hydrate from this API before falling back to legacy live-fetch logic.
- Subsequent sprints will expose similar endpoints for wars, capital raids, alerts, etc.

## Deployment Notes

- Set `ADMIN_API_KEY` (or `INGESTION_TRIGGER_KEY`) to guard `/api/admin/run-ingestion`.
- Configure nightly cron (e.g., Vercel cron job or Supabase scheduled function) to POST to `/api/admin/run-ingestion`.
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is available to the server. Client code continues to use the anon key.
- Backups: Supabase offers automated backups on paid tiers; consider exporting snapshots periodically if you remain on the free tier.

## Next Steps

- Migrate historical snapshot backlog into the new tables (optional but recommended).
- Extend ingestion to populate wars/capital tables in addition to roster.
- Add derived metric jobs (activity trends, donation ratios, etc.) writing into the `metrics` table.
- Wire the dashboard UI to leverage trends/alerts once available.

