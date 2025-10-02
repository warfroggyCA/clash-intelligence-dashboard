-- Check if season columns exist in roster_snapshots table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'roster_snapshots' 
AND column_name IN ('season_id', 'season_start', 'season_end')
ORDER BY column_name;

-- Check if there are any snapshots with season data
SELECT id, fetched_at, season_id, season_start, season_end 
FROM roster_snapshots 
ORDER BY fetched_at DESC 
LIMIT 5;

