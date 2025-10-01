-- Verification script for pipeline schema migration
-- Run this to confirm all new columns and indexes are working

-- Check that all new columns exist and have data
select 
  'members table' as check_name,
  case 
    when count(*) > 0 then '✓ Table exists with data'
    else '✗ No data found'
  end as status
from public.members;

-- Check new member columns
select 
  'members new columns' as check_name,
  count(*) as total_members,
  count(league_id) as with_league_id,
  count(league_name) as with_league_name,
  count(battle_mode_trophies) as with_battle_trophies,
  count(ranked_trophies) as with_ranked_trophies,
  count(equipment_flags) as with_equipment_flags
from public.members;

-- Check new indexes exist
select 
  'members indexes' as check_name,
  indexname,
  indexdef
from pg_indexes 
where tablename = 'members' 
  and indexname like '%battle_mode%' or indexname like '%ranked%';

-- Check roster_snapshots versioning
select 
  'roster_snapshots versioning' as check_name,
  count(*) as total_snapshots,
  count(payload_version) as with_payload_version,
  count(ingestion_version) as with_ingestion_version,
  count(schema_version) as with_schema_version
from public.roster_snapshots;

-- Check member_snapshot_stats new columns
select 
  'member_snapshot_stats new columns' as check_name,
  count(*) as total_stats,
  count(league_id) as with_league_id,
  count(battle_mode_trophies) as with_battle_trophies,
  count(ranked_trophies) as with_ranked_trophies
from public.member_snapshot_stats;

-- Check ingest_logs phase telemetry
select 
  'ingest_logs phase telemetry' as check_name,
  count(*) as total_logs,
  count(phase) as with_phase,
  count(duration_ms) as with_duration,
  count(row_delta) as with_row_delta
from public.ingest_logs;

-- Sample data to verify structure
select 
  'sample member data' as check_name,
  tag,
  name,
  league_name,
  league_trophies,
  battle_mode_trophies,
  ranked_trophies,
  equipment_flags
from public.members 
where league_id is not null
limit 5;
