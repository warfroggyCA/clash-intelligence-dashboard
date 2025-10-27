-- CORRECTED: EVERY SINGLE TROPHY RECORD IN THE DATABASE
-- Based on actual table structure from your data

-- 1. ALL member_snapshot_stats records (last 60 days)  
SELECT 
    'member_snapshot_stats' as source_table,
    member_id::text as player_tag,
    snapshot_date as date,
    trophies,
    ranked_trophies,
    created_at,
    NULL as updated_at
FROM member_snapshot_stats 
WHERE snapshot_date >= '2025-10-01'
ORDER BY member_id, snapshot_date DESC, created_at DESC;

-- 2. ALL player_day records (last 60 days)
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
ORDER BY player_tag, date DESC, created_at DESC;

-- 3. COMBINED VIEW - ALL TROPHY DATA
SELECT 
    'member_snapshot_stats' as source_table,
    member_id::text as player_tag,
    snapshot_date as date,
    trophies,
    ranked_trophies,
    created_at,
    NULL as updated_at
FROM member_snapshot_stats 
WHERE snapshot_date >= '2025-10-01'

UNION ALL

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

ORDER BY player_tag, date DESC, created_at DESC;
