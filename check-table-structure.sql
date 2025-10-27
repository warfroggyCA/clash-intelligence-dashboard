-- CHECK ACTUAL TABLE STRUCTURE FIRST
-- Run these to see what columns actually exist

-- 1. Check player_day table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'player_day' 
ORDER BY ordinal_position;

-- 2. Check member_snapshot_stats table structure  
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'member_snapshot_stats' 
ORDER BY ordinal_position;

-- 3. Get sample data from player_day (last 10 records)
SELECT * FROM player_day 
ORDER BY created_at DESC 
LIMIT 10;

-- 4. Get sample data from member_snapshot_stats (last 10 records)
SELECT * FROM member_snapshot_stats 
ORDER BY created_at DESC 
LIMIT 10;

