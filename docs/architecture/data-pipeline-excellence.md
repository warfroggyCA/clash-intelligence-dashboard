# Data Pipeline Excellence Roadmap

## Objectives
- Harden Supabase schema so core battle metrics, league tiers, and equipment data are strongly typed and queryable.
- Rework ingestion into fault-tolerant stages with incremental writes and metrics instrumentation.
- Offload heavy calculations to background workers, leaving the UI to perform read-only queries.
- Introduce cache governance so clients automatically refresh when payload versions change.
- Deliver observability (logs + alerts) on every ingestion cycle.

## Milestones

### M1 – Schema Hardening & Backfill
- Promote member league/trophy data to typed columns (`league_id`, `league_trophies`, etc.).
- Add battle-mode and ranked trophy columns in preparation for the 2025 split.
- Store equipment / modifier flags in structured JSONB with indexes for fast lookups.
- Record snapshot and ingestion version metadata on `roster_snapshots`.
- Ship SQL migration + idempotent backfill procedure.

### M2 – Staged Ingestion Pipeline
- Split current ingestion into phases: `fetch`, `transform`, `upsertMembers`, `writeSnapshot`, `writeStats`.
- Each phase records checkpoints in `ingest_logs` with duration, row counts, and error payloads.
- Differential writes: only upsert members whose data changed (compare hash of key fields).
- Implement retries per phase; partial failures leave prior data intact.

### M3 – Derived Metric Workers
- Move rush %, donation balance, ACE inputs, and tenure calculations into a worker queue (Supabase Functions or background job runner).
- Metrics written to `metrics` table with `metric_name`/`window` to support time-series queries.
- Dashboard fetchers read pre-computed metrics; fallback to sync computation disabled.

### M4 – Cache & Version Governance
- Add `payload_version` to roster API responses (hash of schema + snapshot timestamp).
- Replace `localStorage` caching with version-aware store that invalidates when version mismatch occurs.
- Introduce ETag/If-None-Match support on `/api/v2/roster` to reduce bandwidth while staying fresh.

### M5 – Observability & Alerting
- Expand `ingest_logs` to capture phase metrics, Supabase RPC timings, and row deltas.
- Create scheduled monitor that flags anomalous ingestion (missing members, zero deltas, long durations) and raises entries in `alerts` table.
- Wire a dashboard widget to show ingestion health (last success, duration, anomalies).

## Implementation Notes
- SQL migrations live under `supabase/migrations` with naming convention `YYYYMMDDHHMM__description.sql`.
- Backfills run via Supabase `pg_net` jobs or temporary scripts; ensure they are idempotent.
- Worker queue options: Supabase Functions + cron, Upstash QStash, or hosted Node worker triggered by Supabase events.
- Leverage Postgres generated columns / indexes for frequently filtered fields (e.g., `battle_mode_trophies`, `ranked_league_id`).

## Open Questions
- Do we persist historical battle/league modifiers per season or only current state? (lean towards historical via `member_snapshot_stats`).
- Should derived metrics store raw components (e.g., donations given/received) or only computed scores? Proposed approach: store both raw totals and computed indexes with explicit `metric_name`.
- How do we authenticate ingestion workers post-migration? (Possible: service-level Supabase key stored in Vercel/cron job secrets.)

## Next Actions
1. Merge schema migration + backfill SQL into repo and run against staging.
2. Refactor ingestion pipeline code to honor new schema (phased approach).
3. Prototype metrics worker using donation/rush calculations as first workloads.
4. Implement versioned cache layer in frontend store and retire raw `localStorage` snapshot persistence.

