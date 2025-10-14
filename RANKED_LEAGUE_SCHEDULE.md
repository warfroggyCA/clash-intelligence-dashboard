# Clash of Clans Ranked League Weekly Tournament Schedule

## Official Tournament Cycle (October 2025 Update)

### Weekly Tournament Phases

| Phase | Duration | Description |
|-------|----------|-------------|
| **Sign-Up (Current Week)** | Monday 5:00 AM → Friday 5:00 AM UTC | Players register for the current tournament week |
| **Sign-Up (Next Week)** | Friday 5:00 AM → Monday 5:00 AM UTC | Early registration opens for next week's tournament |
| **Battle Period** | Tuesday 5:00 AM → Monday 5:00 AM UTC | **Active tournament fights** — earn trophies, climb rankings |
| **Reset Period** | Monday 5:00 AM → Tuesday 5:00 AM UTC | Server processes results, resets standings for new week |

### Key Timestamps

**UTC (Coordinated Universal Time)**:
- Battle Period Ends: **Monday 5:00 AM UTC**
- Reset Window: **Monday 5:00 AM → Tuesday 5:00 AM UTC**
- New Tournament Starts: **Tuesday 5:00 AM UTC**

**North American Eastern Time**:
- Battle Period Ends: **Monday 1:00 AM EDT** / **12:00 AM EST**
- Reset Window: **Monday 1:00 AM → Tuesday 1:00 AM EDT** / **12:00 AM → 1:00 AM EST**
- New Tournament Starts: **Tuesday 1:00 AM EDT** / **12:00 AM EST**

### Tournament Week Structure

```
Week 1: Oct 8 (Tue) 5:00 AM UTC → Oct 14 (Mon) 5:00 AM UTC
  ↓ Reset Period (1 hour)
Week 2: Oct 15 (Tue) 5:00 AM UTC → Oct 21 (Mon) 5:00 AM UTC
  ↓ Reset Period (1 hour)
Week 3: Oct 22 (Tue) 5:00 AM UTC → Oct 28 (Mon) 5:00 AM UTC
  ↓ Reset Period (1 hour)
Week 4: Oct 29 (Tue) 5:00 AM UTC → Nov 4 (Mon) 5:00 AM UTC
```

---

## Clash Intelligence Cron Timing Strategy

### Optimal Capture Window

**Cron Schedule**: **4:30 AM UTC daily** (12:30 AM EDT / 11:30 PM EST)

### Why This Timing is Perfect

1. **Captures Active Battle Data**
   - Runs **30 minutes BEFORE** the Monday 5:00 AM UTC reset
   - Captures final trophy counts while battles are still valid
   - No risk of capturing post-reset zero values

2. **Maximizes Data Completeness**
   - Players have until Monday 5:00 AM UTC to complete attacks
   - 4:30 AM snapshot includes late-night competitive pushes
   - Captures the true "final standings" for the week

3. **Safe Margin for Processing**
   - 30-minute buffer ensures ingestion completes before reset
   - Prevents race conditions with server reset process
   - Allows for API latency and database writes

### What Gets Captured

| Day of Week | What's Captured | Purpose |
|-------------|-----------------|---------|
| **Tuesday–Sunday** | Current week's progress | Daily snapshots during active battle period |
| **Monday (4:30 AM UTC)** | **Final pre-reset trophy counts** | **Weekly finals for historical tracking** |
| **Tuesday (after 5:00 AM UTC)** | Fresh start (0 trophies) | New tournament week begins |

---

## Dashboard Data Flow

### Three Trophy Metrics

1. **Current Week Trophies**
   - **Source**: Live CoC API call (real-time)
   - **Resets**: Automatically every Tuesday 5:00 AM UTC (game mechanic)
   - **Display**: "Trophies" column in roster table
   - **Use Case**: See who's actively climbing this week

2. **Last Week Trophies**
   - **Source**: Most recent Monday 4:30 AM UTC snapshot
   - **Captured**: 30 minutes before weekly reset
   - **Display**: "Last Week" column in roster table
   - **Use Case**: Compare week-over-week performance

3. **Season Cumulative Trophies**
   - **Source**: SUM of all Monday snapshots in current season
   - **Calculation**: `Oct 7 + Oct 14 + Oct 21 + Oct 28 = Season Total`
   - **Display**: Future "Season Total" column
   - **Use Case**: Identify most consistent competitive players

### Data Lineage

```
CoC API (real-time)
  ↓
Daily Cron (4:30 AM UTC)
  ↓
member_snapshot_stats table (Supabase)
  ↓
/api/v2/roster endpoint
  ↓
Dashboard Roster Table
```

### Monday Snapshot Special Logic

```typescript
// Detect Monday snapshots for weekly finals
if (dayOfWeek === 1) { // Monday
  lastWeekTrophies.set(member_id, trophies);
  seasonCumulativeTrophies += trophies; // For future feature
}
```

---

## Critical Reset Window

### What Happens During Reset (Monday 5:00 AM → Tuesday 5:00 AM UTC)

1. **Server Processing**
   - Calculates final rankings
   - Determines promotions/demotions across 34 league tiers
   - Awards weekly rewards

2. **Trophy Reset**
   - All player trophies set to 0
   - League tier assignments may change (promotion/demotion)
   - Attack counters reset

3. **Registration Opens**
   - Players can sign up for new tournament
   - Must register to participate (or face league decay)

### Why We Don't Capture During Reset

- ❌ Trophies are zeroed (invalid data)
- ❌ API may be unstable during server processing
- ❌ No battles possible (no new data being generated)

---

## Verification & Monitoring

### Success Criteria

✅ **Monday snapshots captured at 4:30 AM UTC**
- Verify in Supabase: `SELECT * FROM member_snapshot_stats WHERE EXTRACT(DOW FROM snapshot_date) = 1`

✅ **Trophy values > 0 on Mondays**
- Competitive players should have non-zero trophies
- Zero values indicate missed capture or inactive players

✅ **Tuesday snapshots show fresh start**
- New tournament week shows 0 or low trophy counts
- Confirms reset happened correctly

### Monitoring Query

```sql
-- Check recent snapshots and confirm Monday capture
SELECT 
  DATE(snapshot_date) as date,
  CASE EXTRACT(DOW FROM snapshot_date)
    WHEN 0 THEN 'Sunday'
    WHEN 1 THEN '🎯 MONDAY (WEEKLY FINAL)'
    WHEN 2 THEN 'Tuesday (Fresh Start)'
    ELSE TO_CHAR(snapshot_date, 'Day')
  END as day_type,
  COUNT(DISTINCT member_id) as members,
  AVG(trophies) as avg_trophies,
  MAX(trophies) as max_trophies
FROM member_snapshot_stats
WHERE snapshot_date >= NOW() - INTERVAL '14 days'
GROUP BY DATE(snapshot_date), EXTRACT(DOW FROM snapshot_date)
ORDER BY date DESC;
```

Expected output:
- Mondays: Higher avg_trophies (end of battle period)
- Tuesdays: Lower avg_trophies (fresh start)

---

## Future Enhancements

### Season Cumulative Tracking
- Add "Season Total" column to roster
- SUM all Monday snapshots for October 2025
- Compare players' total competitive output

### Week-over-Week Analysis
- Trophy gain/loss percentage
- Consistency scoring (how many weeks participated)
- Promotion/demotion tracking

### Weekly Competitive Index (WCI)
- Replace ACE score with tournament-focused metrics
- Weight recent weeks higher (recency bias)
- Factor in league tier (harder leagues = more valuable trophies)

---

## Summary

**The Perfect Storm**:
- Tournament ends: Monday 5:00 AM UTC
- Our cron runs: Monday 4:30 AM UTC (**30 min buffer**)
- Reset happens: Monday 5:00 AM UTC
- New tournament: Tuesday 5:00 AM UTC

**Result**: We capture the absolute final trophy counts before reset, every single week, automatically and reliably! 🎯

---

**Last Updated**: 2025-10-14  
**Status**: Production ready, perfectly aligned with game schedule

