-- Comprehensive Trophy Data Analysis Script
-- Shows ALL trophy pulls and calculations for verification

-- 1. All trophy data from player_day table (last 30 days)
SELECT 
    player_tag,
    date,
    trophies,
    ranked_trophies,
    CASE 
        WHEN EXTRACT(DOW FROM date::date) = 1 THEN 'Monday'
        WHEN EXTRACT(DOW FROM date::date) = 2 THEN 'Tuesday'
        WHEN EXTRACT(DOW FROM date::date) = 3 THEN 'Wednesday'
        WHEN EXTRACT(DOW FROM date::date) = 4 THEN 'Thursday'
        WHEN EXTRACT(DOW FROM date::date) = 5 THEN 'Friday'
        WHEN EXTRACT(DOW FROM date::date) = 6 THEN 'Saturday'
        WHEN EXTRACT(DOW FROM date::date) = 0 THEN 'Sunday'
    END as day_of_week,
    EXTRACT(HOUR FROM date::timestamp) as hour_utc
FROM player_day 
WHERE date >= '2025-10-01' 
    AND player_tag IN (
        'G9QVRYC2Y',  -- Warfroggy
        'G9QVRYC2Y',  -- War.Frog (need actual tag)
        'G9QVRYC2Y',  -- Headhuntress (need actual tag)
        'G9QVRYC2Y',  -- DoubleD (need actual tag)
        'G9QVRYC2Y',  -- MD.Soudho$$ (need actual tag)
        'G9QVRYC2Y',  -- Tigress (need actual tag)
        'G9QVRYC2Y',  -- Sirojiddin (need actual tag)
        'G9QVRYC2Y',  -- CosmicThomas (need actual tag)
        'G9QVRYC2Y',  -- se (need actual tag)
        'G9QVRYC2Y',  -- Zouboul (need actual tag)
        'G9QVRYC2Y',  -- Argon (need actual tag)
        'G9QVRYC2Y',  -- Maten238 (need actual tag)
        'G9QVRYC2Y',  -- Ethan (need actual tag)
        'G9QVRYC2Y'   -- ARSENIC (need actual tag)
    )
ORDER BY player_tag, date DESC;

-- 2. Monday finals only (week ending data)
SELECT 
    player_tag,
    date,
    trophies,
    ranked_trophies,
    CASE 
        WHEN date = '2025-10-20' THEN 'Oct 20 Week'
        WHEN date = '2025-10-27' THEN 'Oct 27 Week'
        ELSE 'Other Week'
    END as week_label
FROM player_day 
WHERE date IN ('2025-10-20', '2025-10-27')
    AND EXTRACT(DOW FROM date::date) = 1  -- Monday only
ORDER BY date DESC, player_tag;

-- 3. Member snapshot stats (historical data)
SELECT 
    member_id,
    snapshot_day,
    ranked_trophies,
    trophies,
    CASE 
        WHEN snapshot_day = '2025-10-20' THEN 'Oct 20 Week'
        WHEN snapshot_day = '2025-10-27' THEN 'Oct 27 Week'
        ELSE 'Other Week'
    END as week_label
FROM member_snapshot_stats 
WHERE snapshot_day IN ('2025-10-20', '2025-10-27')
ORDER BY snapshot_day DESC, member_id;

-- 4. Calculate running totals manually
WITH weekly_finals AS (
    SELECT 
        player_tag,
        date,
        trophies,
        CASE 
            WHEN date = '2025-10-20' THEN 'Week 1'
            WHEN date = '2025-10-27' THEN 'Week 2'
        END as week_label
    FROM player_day 
    WHERE date IN ('2025-10-20', '2025-10-27')
        AND EXTRACT(DOW FROM date::date) = 1
),
running_totals AS (
    SELECT 
        player_tag,
        week_label,
        trophies,
        SUM(trophies) OVER (PARTITION BY player_tag ORDER BY date) as running_total
    FROM weekly_finals
)
SELECT 
    player_tag,
    week_label,
    trophies as week_total,
    running_total
FROM running_totals
ORDER BY player_tag, week_label;

