-- Adds season-aligned metadata to snapshots, stats, and metrics tables

begin;

alter table public.roster_snapshots
  add column if not exists season_id text,
  add column if not exists season_start timestamptz,
  add column if not exists season_end timestamptz;

create index if not exists roster_snapshots_season_idx on public.roster_snapshots (season_id);

alter table public.member_snapshot_stats
  add column if not exists season_id text;

create index if not exists member_snapshot_stats_season_idx on public.member_snapshot_stats (season_id);

alter table public.metrics
  add column if not exists season_id text;

create index if not exists metrics_season_idx on public.metrics (season_id);

commit;
