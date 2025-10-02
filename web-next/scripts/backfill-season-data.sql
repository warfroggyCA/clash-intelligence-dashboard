-- Backfill season data for existing snapshots and metrics
-- This script calculates season_id, season_start, and season_end for existing data

begin;

-- Function to calculate season info from a timestamp
create or replace function calculate_season_info(timestamp_iso text)
returns json as $$
declare
  date_val timestamp with time zone;
  year_val integer;
  month_val integer;
  season_id text;
  season_start timestamp with time zone;
  season_end timestamp with time zone;
begin
  -- Parse the timestamp
  date_val := timestamp_iso::timestamp with time zone;
  
  -- Extract year and month
  year_val := extract(year from date_val);
  month_val := extract(month from date_val);
  
  -- Generate season ID (YYYY-MM format)
  season_id := year_val || '-' || lpad(month_val::text, 2, '0');
  
  -- Calculate season start (1st of month at 05:00 UTC)
  season_start := make_timestamptz(year_val, month_val, 1, 5, 0, 0, 'UTC');
  
  -- Calculate season end (1st of next month at 04:59:59 UTC)
  if month_val = 12 then
    season_end := make_timestamptz(year_val + 1, 1, 1, 4, 59, 59, 'UTC');
  else
    season_end := make_timestamptz(year_val, month_val + 1, 1, 4, 59, 59, 'UTC');
  end if;
  
  return json_build_object(
    'season_id', season_id,
    'season_start', season_start,
    'season_end', season_end
  );
end;
$$ language plpgsql;

-- Update roster_snapshots with season data
update public.roster_snapshots
set 
  season_id = (calculate_season_info(fetched_at::text))->>'season_id',
  season_start = ((calculate_season_info(fetched_at::text))->>'season_start')::timestamptz,
  season_end = ((calculate_season_info(fetched_at::text))->>'season_end')::timestamptz
where season_id is null;

-- Update member_snapshot_stats with season data
update public.member_snapshot_stats
set season_id = (
  select rs.season_id 
  from public.roster_snapshots rs 
  where rs.id = member_snapshot_stats.snapshot_id
)
where season_id is null;

-- Update metrics with season data
update public.metrics
set season_id = 'latest'
where season_id is null and metric_window = 'latest';

-- Clean up the function
drop function calculate_season_info(text);

commit;

-- Verify the updates
select 
  'roster_snapshots' as table_name,
  count(*) as total_rows,
  count(season_id) as rows_with_season_id,
  count(season_start) as rows_with_season_start,
  count(season_end) as rows_with_season_end
from public.roster_snapshots
union all
select 
  'member_snapshot_stats' as table_name,
  count(*) as total_rows,
  count(season_id) as rows_with_season_id,
  null as rows_with_season_start,
  null as rows_with_season_end
from public.member_snapshot_stats
union all
select 
  'metrics' as table_name,
  count(*) as total_rows,
  count(season_id) as rows_with_season_id,
  null as rows_with_season_start,
  null as rows_with_season_end
from public.metrics;
