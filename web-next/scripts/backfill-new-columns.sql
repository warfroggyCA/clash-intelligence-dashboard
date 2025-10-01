-- Backfill script for new pipeline schema columns
-- Run this AFTER applying the migration to populate existing data

begin;

-- Backfill members table with league data from existing JSON
update public.members 
set 
  league_id = (raw_data->>'league'->>'id')::integer,
  league_name = raw_data->>'league'->>'name',
  league_trophies = (raw_data->>'league'->>'trophies')::integer,
  league_icon_small = raw_data->>'league'->>'iconUrls'->>'small',
  league_icon_medium = raw_data->>'league'->>'iconUrls'->>'medium',
  battle_mode_trophies = coalesce(
    (raw_data->>'league'->>'trophies')::integer, 
    (raw_data->>'trophies')::integer
  ),
  ranked_trophies = coalesce(
    (raw_data->>'league'->>'trophies')::integer, 
    (raw_data->>'trophies')::integer
  ),
  ranked_league_id = (raw_data->>'league'->>'id')::integer,
  ranked_league_name = raw_data->>'league'->>'name',
  ranked_modifier = raw_data->>'league'->>'modifier',
  equipment_flags = raw_data->>'equipment'
where raw_data is not null
  and raw_data != '{}'::jsonb;

-- Backfill roster_snapshots with version metadata
update public.roster_snapshots 
set 
  payload_version = md5(concat(
    coalesce(clan_tag, ''),
    coalesce(fetched_at::text, ''),
    coalesce(member_count::text, '0')
  )),
  ingestion_version = 'v1.0.0',
  schema_version = 'pipeline-upgrade-20250115',
  computed_at = fetched_at
where payload_version is null;

-- Backfill member_snapshot_stats with league data
update public.member_snapshot_stats 
set 
  league_id = (raw_data->>'league'->>'id')::integer,
  league_name = raw_data->>'league'->>'name',
  league_trophies = (raw_data->>'league'->>'trophies')::integer,
  battle_mode_trophies = coalesce(
    (raw_data->>'league'->>'trophies')::integer, 
    (raw_data->>'trophies')::integer
  ),
  ranked_trophies = coalesce(
    (raw_data->>'league'->>'trophies')::integer, 
    (raw_data->>'trophies')::integer
  ),
  ranked_league_id = (raw_data->>'league'->>'id')::integer,
  ranked_modifier = raw_data->>'league'->>'modifier',
  equipment_flags = raw_data->>'equipment'
where raw_data is not null
  and raw_data != '{}'::jsonb;

-- Verify the backfill worked
select 
  'members' as table_name,
  count(*) as total_rows,
  count(league_id) as with_league_id,
  count(battle_mode_trophies) as with_battle_trophies
from public.members
union all
select 
  'roster_snapshots' as table_name,
  count(*) as total_rows,
  count(payload_version) as with_payload_version,
  count(ingestion_version) as with_ingestion_version
from public.roster_snapshots
union all
select 
  'member_snapshot_stats' as table_name,
  count(*) as total_rows,
  count(league_id) as with_league_id,
  count(battle_mode_trophies) as with_battle_trophies
from public.member_snapshot_stats;

commit;
