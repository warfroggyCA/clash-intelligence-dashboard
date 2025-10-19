-- Adds enriched player columns captured by the roster ingestion pipeline
-- Date: 2025-02-17

begin;

alter table public.member_snapshot_stats
  add column if not exists activity_score integer,
  add column if not exists best_trophies integer,
  add column if not exists best_versus_trophies integer,
  add column if not exists ranked_trophies integer,
  add column if not exists league_name text,
  add column if not exists league_trophies integer;

comment on column public.member_snapshot_stats.activity_score is 'Calculated activity score (0-100) derived from roster ingestion.';
comment on column public.member_snapshot_stats.best_trophies is 'All-time best home village trophies.';
comment on column public.member_snapshot_stats.best_versus_trophies is 'All-time best builder base trophies.';
comment on column public.member_snapshot_stats.ranked_trophies is 'Current ranked-mode trophy count captured at snapshot time.';
comment on column public.member_snapshot_stats.league_name is 'League name captured at snapshot time.';
comment on column public.member_snapshot_stats.league_trophies is 'League trophy count (post-October 2025 split) captured at snapshot time.';

commit;
