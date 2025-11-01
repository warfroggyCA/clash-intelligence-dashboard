# Warfroggy Data Comparison: Roster vs Profile

## Player Tag: #G9QVRYC2Y

### Data Sources

**Roster API** (`/api/v2/roster`):
- Primary snapshot: Latest `canonical_member_snapshots` for clan
- Last Week Trophies: `member_snapshot_stats` table (previous Monday's final)
- Season Total: `member_snapshot_stats` table (sum of Monday finals since Oct 13, 2025)
- VIP: `vip_scores` table (current week)
- Activity: Calculated from `player_day` timeline (last 14 days)

**Profile API** (`/api/player/[tag]/profile`):
- Primary snapshot: Latest `canonical_member_snapshots` for player
- Last Week Trophies: `player_day` table OR canonical snapshots (14-7 days ago)
- Season Total: `player_day` table OR canonical snapshots (sum of Monday snapshots)
- VIP: `vip_scores` table (current week) - same source
- Activity: Calculated from `player_day` timeline (last 7 days)

### Key Differences

#### 1. Last Week Trophies Calculation

**Roster API Logic:**
```typescript
// Lines 428-464
// Finds snapshots between last Monday and current Monday
// Takes MAXIMUM ranked_trophies for that week
const lastMondayISO = lastMonday.toISOString().slice(0, 10);
const { data: lastWeekSnapshotRows } = await supabase
  .from('member_snapshot_stats')
  .select('member_id, trophies, ranked_trophies, snapshot_date')
  .in('member_id', historicalMemberIds)
  .filter('snapshot_date', 'gte', lastMondayISO + 'T00:00:00Z')
  .filter('snapshot_date', 'lte', currentMonday + 'T23:59:59Z')
  // Then takes MAX value for each member
```

**Profile API Logic:**
```typescript
// Lines 57-75
// Looks for ANY snapshot between 14 days ago and 7 days ago
// Takes FIRST trophy value found
const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
if (dateObj >= fourteenDaysAgo && dateObj < sevenDaysAgo) {
  lastWeekTrophies = trophies ?? null;
}
```

**Impact:** Roster uses Monday finals (more accurate), Profile uses date range (could be any day)

#### 2. Season Total Trophies Calculation

**Roster API Logic:**
```typescript
// Lines 466-629
// Uses member_snapshot_stats table
// Groups by Monday week starts
// Only counts weeks >= RANKED_START_MONDAY_ISO (2025-10-13)
// Sums tournament finals (ranked_trophies) from completed weeks
// Filters: trophyValue > 0 && trophyValue <= 600
const weekStartISO = weekStartKey(snapshotDate);
if (weekStartISO < RANKED_START_MONDAY_ISO) {
  continue; // Skip weeks before ranked system started
}
const trophyValue = row.ranked_trophies ?? 0;
if (trophyValue > existingValue && trophyValue > 0 && trophyValue <= 600) {
  memberWeekMap.set(weekStartISO, trophyValue);
}
```

**Profile API Logic:**
```typescript
// Lines 77-85
// Uses canonical snapshots OR player_day table
// Sums ALL Monday snapshots since season start
// Adds latest snapshot trophies at the end
if (dateObj >= seasonStart && dateObj.getUTCDay() === 1 && snapshotDate) {
  const key = `${row.payload.playerTag}|${snapshotDate}`;
  if (!mondayKeysByPlayer.has(key)) {
    seasonTotal += trophies ?? 0;
    mondayKeysByPlayer.add(key);
  }
}
// Then adds latest snapshot
const latestTrophies = latestSnapshot?.member?.ranked?.trophies ?? latestSnapshot?.member?.trophies ?? null;
if (latestTrophies != null) {
  seasonTotal += latestTrophies;
}
```

**Impact:** 
- Roster only counts ranked weeks (Oct 13+), Profile counts all Mondays
- Roster uses ranked_trophies (tournament finals), Profile uses regular trophies
- Profile double-counts latest snapshot

#### 3. Activity Score Lookback

**Roster API:**
```typescript
// Line 663
lookbackDays: 7
```

**Profile API:**
```typescript
// Line 343
lookbackDays: 7
```

**Impact:** Same (both use 7 days)

### Expected Discrepancies

1. **Last Week Trophies**: 
   - Roster: Previous Monday's final ranked_trophies
   - Profile: Any snapshot from 14-7 days ago (could be different day/value)

2. **Season Total Trophies**:
   - Roster: Sum of Monday finals (ranked_trophies) since Oct 13
   - Profile: Sum of all Monday snapshots (regular trophies) + latest snapshot

3. **VIP Score**: Should match (both use same table)

4. **Core Stats** (trophies, donations, hero levels, etc.): Should match (both use latest canonical snapshot)

### Recommendation

The Roster API logic is more accurate for:
- Last Week Trophies (uses Monday finals specifically)
- Season Total (uses ranked_trophies and filters pre-ranked weeks)

The Profile API should be updated to match Roster API logic for consistency.

