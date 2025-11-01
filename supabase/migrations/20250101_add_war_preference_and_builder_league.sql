-- Add war preference and builder league name columns for efficient querying
-- Date: 2025-01-01
-- 
-- These columns enable filtering players by war opt-in status and builder league
-- without needing to query JSONB payloads, making it easy to identify non-war players
-- and analyze builder base participation.

begin;

-- Add war preference column (stores "in" or "out")
alter table public.member_snapshot_stats
  add column if not exists war_preference text;

-- Add builder league name column
alter table public.member_snapshot_stats
  add column if not exists builder_league_name text;

-- Create indexes for efficient filtering
create index if not exists member_snapshot_stats_war_preference_idx
  on public.member_snapshot_stats (war_preference)
  where war_preference is not null;

create index if not exists member_snapshot_stats_builder_league_name_idx
  on public.member_snapshot_stats (builder_league_name)
  where builder_league_name is not null;

-- Add comments for documentation
comment on column public.member_snapshot_stats.war_preference is 
  'War opt-in preference: "in" = opted in to clan wars, "out" = opted out. Null if not set.';

comment on column public.member_snapshot_stats.builder_league_name is 
  'Builder Base league name (e.g., "Builder Hall League I", "Builder Hall League II").';

commit;

