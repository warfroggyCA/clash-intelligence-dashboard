# Weekly Ranked League Tournament Tracking

## Context: October 2025 Ranked League System

As of October 2025, Clash of Clans introduced a major multiplayer overhaul:

- **34-tier Ranked League System** (Barbarian 1 → Electro 34)
- **Weekly tournaments** run Tuesday 5:00 AM UTC → Monday 5:00 AM UTC (7-day battle period)
- **Reset window**: Monday 5:00 AM → Tuesday 5:00 AM UTC (1-hour server processing, no battles)
- **Trophies reset to 0** every Tuesday 5:00 AM UTC when new tournament starts
- **Players must register** each week to participate (or face league decay)

**See `RANKED_LEAGUE_SCHEDULE.md` for complete tournament timing details.**

### The Challenge

The CoC API `trophies` field shows **current week's tournament trophies**, which resets every Tuesday. This makes it impossible to track long-term competitive performance using only the current snapshot.

### The Solution

We capture **Monday night snapshots** (4:30 AM UTC, 30 minutes before Tuesday reset) to preserve each week's final trophy counts.

---

## Data Architecture

### Existing Schema (No Changes Required!)

Our `member_snapshot_stats` table already captures everything we need:

```sql
-- Daily snapshots captured at 4:30 AM UTC
member_snapshot_stats (
  id UUID,
  member_id UUID,
  snapshot_id UUID,
  snapshot_date TIMESTAMPTZ,
  trophies INTEGER,              -- Current week's trophies
  ranked_league_id INTEGER,      -- Current league tier (105000001-105000034)
  ranked_league_name TEXT,       -- e.g., "Valkyrie League 14"
  ...
)
```

### Identifying Weekly Finals

**Monday snapshots** (taken at 4:30 AM UTC) represent the final state of each weekly tournament:

```sql
-- Get all Monday snapshots (DOW=1 in PostgreSQL)
SELECT 
  m.tag,
  m.name,
  mss.snapshot_date,
  mss.trophies as week_final_trophies,
  mss.ranked_league_id,
  mss.ranked_league_name
FROM member_snapshot_stats mss
JOIN members m ON m.id = mss.member_id
WHERE EXTRACT(DOW FROM mss.snapshot_date) = 1  -- Monday
ORDER BY m.tag, mss.snapshot_date;
```

---

## Cron Schedule Optimization

### Previous Schedule
- **Time**: 3:00 AM UTC daily
- **Issue**: 2+ hours before weekly reset, missing late-night attacks

### Optimized Schedule
- **Time**: 4:30 AM UTC daily
- **Benefits**:
  - Captures data 30 minutes before Tuesday 5:00 AM reset
  - Includes late Monday night attacks
  - Safe 30-minute buffer for ingestion to complete
  - Monday snapshots now accurately represent weekly finals

### Configuration
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/daily-ingestion",
      "schedule": "30 4 * * *"  // 4:30 AM UTC daily
    }
  ]
}
```

---

## Derived Metrics

### 1. Current Week Trophies
**Source**: Latest snapshot (any day)  
**Use**: Shows this week's current progress

```sql
SELECT trophies FROM member_snapshot_stats
WHERE member_id = ?
ORDER BY snapshot_date DESC
LIMIT 1;
```

### 2. Last Week Final Trophies
**Source**: Most recent Monday snapshot  
**Use**: Shows previous week's final performance

```sql
SELECT trophies as last_week_trophies
FROM member_snapshot_stats
WHERE member_id = ?
  AND EXTRACT(DOW FROM snapshot_date) = 1
ORDER BY snapshot_date DESC
LIMIT 1;
```

### 3. Season Total Competitive Trophies
**Source**: All Monday snapshots in current season  
**Use**: Cumulative competitive performance for the season

```sql
SELECT 
  m.tag,
  m.name,
  SUM(mss.trophies) as season_total_trophies,
  COUNT(*) as weeks_participated,
  AVG(mss.trophies) as avg_weekly_trophies,
  MAX(mss.trophies) as best_week_trophies
FROM member_snapshot_stats mss
JOIN members m ON m.id = mss.member_id
WHERE 
  EXTRACT(DOW FROM mss.snapshot_date) = 1  -- Mondays only
  AND mss.snapshot_date >= '2025-10-01'     -- Current season
  AND mss.snapshot_date < '2025-11-01'
GROUP BY m.tag, m.name;
```

### 4. Weekly Participation Rate
**Source**: Count of weeks with non-zero trophies  
**Use**: Identifies consistent vs sporadic participants

```sql
SELECT 
  m.tag,
  m.name,
  COUNT(CASE WHEN mss.trophies > 0 THEN 1 END) as weeks_active,
  COUNT(*) as weeks_total,
  ROUND(
    100.0 * COUNT(CASE WHEN mss.trophies > 0 THEN 1 END) / COUNT(*),
    1
  ) as participation_rate_pct
FROM member_snapshot_stats mss
JOIN members m ON m.id = mss.member_id
WHERE 
  EXTRACT(DOW FROM mss.snapshot_date) = 1
  AND mss.snapshot_date >= '2025-10-01'
  AND mss.snapshot_date < '2025-11-01'
GROUP BY m.tag, m.name;
```

---

## Dashboard Implementation Plan

### Phase 1: Add Season Total Column (Quick Win)
Update roster table to show:
- **This Week**: Current trophies (existing)
- **Season Total**: Sum of all Monday snapshots (new)

### Phase 2: Weekly Performance View
New page/section showing:
- Weekly trophy history chart
- Week-over-week comparison
- Personal best week
- Consistency score

### Phase 3: Competitive Index (WCI)
Replace ACE score with Weekly Competitive Index based on:
- Tournament Utilization Rate (attacks used)
- Trophy Efficiency (trophies per attack)
- League Advancement (promotions)
- Weekly Consistency

---

## API Endpoint Design

### GET /api/v2/roster/weekly-stats

**Query Parameters**:
- `season`: Season ID (e.g., "2025-10") - default: current
- `weeks`: Number of recent weeks - default: all in season

**Response**:
```json
{
  "success": true,
  "data": {
    "season": "2025-10",
    "weekRange": {
      "start": "2025-10-01",
      "end": "2025-10-28",
      "totalWeeks": 4
    },
    "members": [
      {
        "tag": "#VGQVRLRL",
        "name": "DoubleD",
        "currentWeek": {
          "trophies": 250,
          "leagueId": 105000017,
          "leagueName": "Witch League 17"
        },
        "seasonTotal": {
          "trophies": 3847,
          "weeksParticipated": 4,
          "weeksTotal": 4,
          "participationRate": 100,
          "avgWeeklyTrophies": 962,
          "bestWeekTrophies": 1203
        },
        "weeklyHistory": [
          { "weekEnd": "2025-10-07", "trophies": 1203 },
          { "weekEnd": "2025-10-14", "trophies": 892 },
          { "weekEnd": "2025-10-21", "trophies": 1025 },
          { "weekEnd": "2025-10-28", "trophies": 727 }
        ]
      }
    ]
  }
}
```

---

## Testing Strategy

### 1. Verify Monday Detection
```sql
-- Check that Monday snapshots are being captured
SELECT 
  snapshot_date,
  EXTRACT(DOW FROM snapshot_date) as day_of_week,
  COUNT(*) as member_count
FROM member_snapshot_stats
WHERE snapshot_date >= NOW() - INTERVAL '7 days'
GROUP BY snapshot_date
ORDER BY snapshot_date DESC;
```

Expected: One row with `day_of_week = 1` (Monday)

### 2. Verify Timing Accuracy
```sql
-- Check snapshot timestamps relative to 4:30 AM UTC
SELECT 
  snapshot_date,
  EXTRACT(HOUR FROM snapshot_date) as hour,
  EXTRACT(MINUTE FROM snapshot_date) as minute
FROM member_snapshot_stats
WHERE EXTRACT(DOW FROM snapshot_date) = 1
ORDER BY snapshot_date DESC
LIMIT 5;
```

Expected: `hour = 4`, `minute` ≈ 30-35 (allowing for processing time)

### 3. Verify Trophy Reset Detection
```sql
-- Compare Monday vs Tuesday snapshots to confirm reset
WITH monday_tuesday AS (
  SELECT 
    m.tag,
    m.name,
    mss.trophies,
    mss.snapshot_date,
    EXTRACT(DOW FROM mss.snapshot_date) as dow
  FROM member_snapshot_stats mss
  JOIN members m ON m.id = mss.member_id
  WHERE mss.snapshot_date >= NOW() - INTERVAL '7 days'
    AND EXTRACT(DOW FROM mss.snapshot_date) IN (1, 2)  -- Mon, Tue
)
SELECT 
  tag,
  name,
  MAX(CASE WHEN dow = 1 THEN trophies END) as monday_trophies,
  MAX(CASE WHEN dow = 2 THEN trophies END) as tuesday_trophies,
  MAX(CASE WHEN dow = 1 THEN trophies END) - 
    MAX(CASE WHEN dow = 2 THEN trophies END) as trophy_drop
FROM monday_tuesday
GROUP BY tag, name
HAVING MAX(CASE WHEN dow = 1 THEN trophies END) > 0;
```

Expected: `trophy_drop` should be positive for active players (confirming reset)

---

## Migration & Deployment

### Step 1: Update Cron Schedule
- ✅ Changed `vercel.json`: `"schedule": "30 4 * * *"`
- ✅ Updated `VERCEL_CRON_SETUP.md` documentation

### Step 2: Deploy to Production
```bash
cd web-next
vercel deploy --prod
```

### Step 3: Verify First Run
- Wait for Tuesday 4:30 AM UTC
- Check Vercel function logs
- Verify Monday snapshot captured

### Step 4: Implement Dashboard Changes
- Add "Season Total" column to roster
- Create weekly stats API endpoint
- Build historical performance charts

---

## Success Criteria

- ✅ Cron runs at 4:30 AM UTC daily (verified in logs)
- ✅ Monday snapshots captured before Tuesday 5:00 AM reset
- ✅ Trophy reset detected (Monday trophies > Tuesday trophies)
- ✅ Season total metrics calculated correctly
- ✅ Dashboard displays both current week and season cumulative data

---

**Last Updated**: 2025-01-14  
**Status**: Cron optimized, ready for dashboard implementation

