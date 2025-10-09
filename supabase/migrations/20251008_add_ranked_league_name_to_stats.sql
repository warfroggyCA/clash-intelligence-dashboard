-- Add missing ranked_league_name column to member_snapshot_stats
-- This column is needed for the league icon system to display ranked league badges

begin;

alter table public.member_snapshot_stats
  add column if not exists ranked_league_name text;

create index if not exists member_snapshot_stats_ranked_league_name_idx 
  on public.member_snapshot_stats (ranked_league_name);

commit;

