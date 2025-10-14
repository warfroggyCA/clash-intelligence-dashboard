# Cron Timing Optimization for Weekly Tournament Tracking

## Date: 2025-01-14

## The Discovery

While investigating why some players showed 0 trophies while others had trophy counts, we discovered a critical insight about the new October 2025 Ranked League system:

> **Weekly tournaments reset trophies to 0 every Tuesday at 5:00 AM UTC**

This means the CoC API `trophies` field shows **current week's tournament trophies**, which resets weekly. This makes historical tracking impossible using only current snapshots.

## The Insight

Our daily ingestion cron was running at **3:00 AM UTC** - a full **2 hours before the weekly reset**. By moving it to **4:30 AM UTC**, we:

1. **Capture more data**: Includes late Monday night attacks
2. **Weekly finals accuracy**: Monday 4:30 AM snapshot represents true weekly final results
3. **Safe buffer**: 30 minutes before reset ensures ingestion completes
4. **Historical tracking**: Can now sum Monday snapshots for season-long competitive metrics

## Changes Made

### 1. Updated Vercel Cron Schedule
**File**: `web-next/vercel.json`

```diff
  "crons": [
    {
      "path": "/api/cron/daily-ingestion",
-     "schedule": "0 3 * * *"
+     "schedule": "30 4 * * *"
    }
  ]
```

### 2. Updated Documentation
**Files**:
- `web-next/VERCEL_CRON_SETUP.md` - Added weekly reset timing context
- `WEEKLY_TOURNAMENT_TRACKING.md` - **NEW**: Comprehensive strategy guide

### 3. No Schema Changes Required
Our existing `member_snapshot_stats` table already captures everything we need! We just needed to optimize the timing.

## Derived Metrics Now Possible

### Season Total Competitive Trophies
Sum of all Monday snapshots in current season:
```sql
SELECT 
  m.name,
  SUM(mss.trophies) as season_total
FROM member_snapshot_stats mss
JOIN members m ON m.id = mss.member_id
WHERE 
  EXTRACT(DOW FROM mss.snapshot_date) = 1  -- Mondays
  AND mss.snapshot_date >= '2025-10-01'
GROUP BY m.name;
```

### Weekly Participation Rate
Count weeks with active participation:
```sql
SELECT 
  m.name,
  COUNT(CASE WHEN mss.trophies > 0 THEN 1 END) as weeks_active,
  COUNT(*) as weeks_total
FROM member_snapshot_stats mss
JOIN members m ON m.id = mss.member_id
WHERE EXTRACT(DOW FROM mss.snapshot_date) = 1
GROUP BY m.name;
```

### Week-over-Week Comparison
Track competitive improvement:
```sql
SELECT 
  m.name,
  mss.snapshot_date,
  mss.trophies as week_final,
  LAG(mss.trophies) OVER (PARTITION BY m.id ORDER BY mss.snapshot_date) as previous_week,
  mss.trophies - LAG(mss.trophies) OVER (PARTITION BY m.id ORDER BY mss.snapshot_date) as week_delta
FROM member_snapshot_stats mss
JOIN members m ON m.id = mss.member_id
WHERE EXTRACT(DOW FROM mss.snapshot_date) = 1;
```

## Dashboard Implementation Roadmap

### Phase 1: Quick Win - Season Total Column
Add "Season Total" column to roster showing cumulative competitive trophies for the season.

**Complexity**: Low  
**Value**: High (immediate historical context)

### Phase 2: Weekly Stats API
Create `/api/v2/roster/weekly-stats` endpoint:
- Current week trophies
- Season total trophies
- Weekly participation rate
- Best week performance

**Complexity**: Medium  
**Value**: High (enables all downstream features)

### Phase 3: Historical Performance View
New page showing:
- Weekly trophy history chart
- Week-over-week comparison
- Personal bests
- Consistency score

**Complexity**: High  
**Value**: Medium-High (nice-to-have, completes the picture)

### Phase 4: Weekly Competitive Index (WCI)
Replace ACE score with WCI based on:
- Tournament Utilization Rate
- Trophy Efficiency
- League Advancement
- Weekly Consistency

**Complexity**: High  
**Value**: Very High (aligns with game's new competitive focus)

## Next Steps

1. ✅ **DONE**: Updated cron schedule to 4:30 AM UTC
2. ✅ **DONE**: Documented weekly tracking strategy
3. 🔄 **PENDING**: Deploy to production (`vercel deploy --prod`)
4. 🔄 **PENDING**: Verify first Monday snapshot captured (next Monday 4:30 AM UTC)
5. 🔄 **PENDING**: Implement Phase 1 (Season Total column)

## Testing & Verification

After deployment, verify:

1. **Cron runs at correct time**:
   - Check Vercel function logs for timestamp around 4:30 AM UTC

2. **Monday snapshots captured**:
   ```sql
   SELECT snapshot_date, COUNT(*)
   FROM member_snapshot_stats
   WHERE EXTRACT(DOW FROM snapshot_date) = 1
   GROUP BY snapshot_date
   ORDER BY snapshot_date DESC;
   ```

3. **Trophy reset detection**:
   - Monday trophies > Tuesday trophies (confirming weekly reset)

## Success Criteria

- ✅ Cron schedule updated to 4:30 AM UTC
- ✅ Documentation comprehensive and clear
- 🔄 Deployed to production
- 🔄 Monday snapshots verified
- 🔄 Dashboard displays season cumulative data

## Impact

This optimization unlocks **true competitive tracking** aligned with the October 2025 game changes:

- **Leaders can see**: Who's consistently participating vs. ghosting
- **Players can see**: Their season-long competitive performance
- **Clan can track**: Overall competitive health and engagement trends

All without any schema changes - just smarter timing and data aggregation!

---

**Status**: Configuration updated, pending production deployment  
**Next Action**: Deploy to production and verify Monday snapshot capture

