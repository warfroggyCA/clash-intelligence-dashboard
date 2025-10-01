-- Pipeline schema hardening migration
-- Adds typed columns for league/battle metrics, ingestion telemetry, and cache metadata.

begin;

-- Members: typed league + trophy fields for upcoming dual-mode split
alter table public.members
  add column if not exists league_id integer,
  add column if not exists league_name text,
  add column if not exists league_trophies integer,
  add column if not exists league_icon_small text,
  add column if not exists league_icon_medium text,
  add column if not exists battle_mode_trophies integer,
  add column if not exists ranked_trophies integer,
  add column if not exists ranked_league_id integer,
  add column if not exists ranked_league_name text,
  add column if not exists ranked_modifier jsonb,
  add column if not exists season_reset_at date,
  add column if not exists equipment_flags jsonb;

create index if not exists members_battle_mode_trophies_idx on public.members (battle_mode_trophies);
create index if not exists members_ranked_trophies_idx on public.members (ranked_trophies);
create index if not exists members_ranked_league_idx on public.members (ranked_league_id);

-- Roster snapshots: capture versioning for cache governance and ingest tracking
alter table public.roster_snapshots
  add column if not exists payload_version text,
  add column if not exists ingestion_version text,
  add column if not exists schema_version text,
  add column if not exists computed_at timestamptz;

-- Member snapshot stats: persist league + mode split for historical analysis
alter table public.member_snapshot_stats
  add column if not exists league_id integer,
  add column if not exists league_name text,
  add column if not exists league_trophies integer,
  add column if not exists battle_mode_trophies integer,
  add column if not exists ranked_trophies integer,
  add column if not exists ranked_league_id integer,
  add column if not exists ranked_modifier jsonb,
  add column if not exists equipment_flags jsonb;

create index if not exists member_snapshot_stats_ranked_idx on public.member_snapshot_stats (ranked_trophies);

-- Ingest logs: phase-level telemetry
alter table public.ingest_logs
  add column if not exists phase text,
  add column if not exists duration_ms integer,
  add column if not exists row_delta integer,
  add column if not exists error_message text;

commit;
