# Running Total Implementation Plan

## Overview
Add a **Season Total** column to track cumulative competitive trophy performance throughout the entire season (Oct 2025 - ongoing).

## Column Placement
The column will be positioned in the roster table as:

1. **Trophies** - Current week's trophy count (resets Tuesday 5:00 AM UTC)
2. **Last Week** - Previous week's final trophy count (Monday 4:30 AM snapshot)
3. **Season Total** ⭐ **NEW** - Cumulative total of all weekly trophy finals since season start
4. **Rush %** - Hero progression metric

## Visual Example

```
| Player | League | Trophies | Last Week | Season Total | Rush % | BK | AQ | ... |
|--------|--------|----------|-----------|--------------|--------|----|----|-----|
| War.Frog | Val 14 | 0 | 431 | 1,247 | 2% | 75 | 75 | ... |
| warfroggy | Val 13 | 0 | 380 | 1,095 | 9% | 73 | 74 | ... |
```

## Database Schema

### Option 1: Computed Field (Recommended)
Calculate on-the-fly by summing all Monday snapshots for each member:

```sql
-- Query to get season total
SELECT 
  m.id,
  m.name,
  SUM(mss.trophies) as season_total_trophies
FROM members m
JOIN member_snapshot_stats mss ON mss.member_id = m.id
JOIN roster_snapshots rs ON rs.id = mss.snapshot_id
WHERE EXTRACT(DOW FROM rs.fetched_at) = 1  -- Monday snapshots only
  AND rs.fetched_at >= '2025-10-01'::date   -- Season start
GROUP BY m.id, m.name;
```

**Pros:**
- Always accurate
- No additional storage
- Automatically updates with historical data

**Cons:**
- Slightly more complex query
- Need to define "season start" date

### Option 2: Cached Field
Add `season_total_trophies` column to `members` table, updated during ingestion:

```sql
ALTER TABLE members ADD COLUMN season_total_trophies INTEGER DEFAULT 0;
```

**Pros:**
- Faster queries
- Simple to display

**Cons:**
- Requires backfill for historical data
- Need to maintain cache logic
- More complex migration

## Implementation Steps

### 1. Backend (API Route)
Update `/api/v2/roster/route.ts` to include season total calculation:

```typescript
// Calculate season total for each member
const seasonStart = '2025-10-01';
const { data: seasonTotals, error: seasonError } = await supabase
  .from('member_snapshot_stats')
  .select('member_id, trophies, snapshot_date')
  .in('member_id', memberIds)
  .gte('snapshot_date', seasonStart)
  .order('snapshot_date', { ascending: false });

if (!seasonError && seasonTotals) {
  const seasonTotalMap = new Map<string, number>();
  
  for (const row of seasonTotals) {
    const snapshotDate = new Date(row.snapshot_date);
    const dayOfWeek = snapshotDate.getUTCDay();
    
    // Only count Monday snapshots (DOW=1)
    if (dayOfWeek === 1) {
      const currentTotal = seasonTotalMap.get(row.member_id) || 0;
      seasonTotalMap.set(row.member_id, currentTotal + (row.trophies || 0));
    }
  }
  
  // Add to member data
  return {
    ...member,
    seasonTotalTrophies: seasonTotalMap.get(stat.member_id) || 0,
  };
}
```

### 2. Frontend (Type Definition)
Update `RosterMember` interface in `simple-roster/page.tsx`:

```typescript
interface RosterMember {
  tag: string;
  name: string;
  // ... existing fields
  trophies: number;
  lastWeekTrophies?: number;
  seasonTotalTrophies?: number;  // NEW
  // ... other fields
}
```

### 3. Frontend (Table Header)
Add column header after "Last Week":

```tsx
<th 
  onClick={() => handleSort('seasonTotal')}
  title="Season total competitive trophies (sum of all weekly finals since Oct 2025) - Shows overall season performance - Click to sort"
  className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider cursor-pointer hover:text-brand-accent"
>
  Season Total {sortKey === 'seasonTotal' && (sortDirection === 'asc' ? '↑' : '↓')}
</th>
```

### 4. Frontend (Table Cell)
Add data cell after "Last Week":

```tsx
<td className="px-4 py-3 text-center">
  {player.seasonTotalTrophies !== null && player.seasonTotalTrophies !== undefined ? (
    <span 
      title={`Season total competitive trophies: ${player.seasonTotalTrophies.toLocaleString()}`}
      className="font-mono text-sm font-bold text-brand-accent cursor-help"
    >
      {player.seasonTotalTrophies.toLocaleString()}
    </span>
  ) : (
    <span className="text-xs text-brand-text-muted">–</span>
  )}
</td>
```

### 5. Frontend (Sort Logic)
Add sorting case:

```typescript
case 'seasonTotal':
  comparison = (a.seasonTotalTrophies ?? 0) - (b.seasonTotalTrophies ?? 0);
  break;
```

## Season Definition

### Current Season (October 2025 - Ongoing)
- **Start Date**: October 1, 2025 (when Ranked League system launched)
- **End Date**: TBD (when Supercell announces season end or new season)
- **Weekly Resets**: Every Tuesday 5:00 AM UTC
- **Capture Time**: Every Monday 4:30 AM UTC (30 minutes before reset)

### Future Seasons
When a new season starts, we'll need to:
1. Archive current season data
2. Update `seasonStart` date in the query
3. Potentially add a `season_id` field to track multiple seasons

## Visual Design Notes

- **Font Weight**: Use `font-bold` to emphasize this is the primary competitive metric
- **Color**: Use `text-brand-accent` (yellow/gold) to highlight importance
- **Number Format**: Always show full numbers with commas (e.g., "1,247" not "1.2k")
- **Tooltip**: Include explanation that it's a sum of weekly finals

## Related Documentation

- `WEEKLY_TOURNAMENT_TRACKING.md` - Explains the weekly capture strategy
- `RANKED_LEAGUE_SCHEDULE.md` - Details the tournament schedule
- `CRON_TIMING_OPTIMIZATION_SUMMARY.md` - Why we capture at 4:30 AM UTC Monday

## Testing Checklist

- [ ] API returns correct season totals for all members
- [ ] Frontend displays season totals correctly
- [ ] Sorting by season total works correctly
- [ ] Tooltips show correct information
- [ ] Numbers are formatted with commas
- [ ] Column header is clear and clickable
- [ ] Historical data is included (all past Monday snapshots)
- [ ] New members start at 0
- [ ] Inactive members show their accumulated total

## Priority

**Medium-High** - This is a core feature for tracking long-term competitive performance, but the immediate weekly tracking (Last Week column) is already functional.

