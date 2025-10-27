-- EVERY SINGLE TROPHY RECORD IN THE DATABASE
-- Run this in Supabase to see exactly what's being recorded

-- 1. ALL player_day records (last 60 days)
SELECT 
    'player_day' as source_table,
    player_tag,
    date,
    trophies,
    created_at,
    updated_at
FROM player_day 
WHERE date >= '2025-10-01'
ORDER BY player_tag, date DESC, created_at DESC;

-- 2. ALL member_snapshot_stats records (last 60 days)  
SELECT 
    'member_snapshot_stats' as source_table,
    member_id as player_tag,
    snapshot_day as date,
    trophies,
    ranked_trophies,
    created_at,
    updated_at
FROM member_snapshot_stats 
WHERE snapshot_day >= '2025-10-01'
ORDER BY member_id, snapshot_day DESC, created_at DESC;

-- 3. COMBINED VIEW - ALL TROPHY DATA
SELECT 
    'player_day' as source_table,
    player_tag,
    date,
    trophies,
    NULL as ranked_trophies,
    created_at,
    updated_at
FROM player_day 
WHERE date >= '2025-10-01'

UNION ALL

SELECT 
    'member_snapshot_stats' as source_table,
    member_id as player_tag,
    snapshot_day as date,
    trophies,
    ranked_trophies,
    created_at,
    updated_at
FROM member_snapshot_stats 
WHERE snapshot_day >= '2025-10-01'

ORDER BY player_tag, date DESC, created_at DESC;
