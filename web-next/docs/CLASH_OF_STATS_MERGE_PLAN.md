# Clash of Stats Data Merge Plan

**Purpose:** Merge Clash of Stats scraper data (historical clan membership) with existing player history and database.

**Data Source:** `clan-2PR8R8V8P-Jan-11-2026-HISTORY.json` from Clash of Stats scraper

**Last Updated:** 2026-01-15

---

## ✅ Feasibility: YES, This is Possible

The data structure from Clash of Stats can be merged with our existing `player_history` table and player database. However, there are some limitations and considerations.

---

## 📊 Data Mapping Analysis

### Clash of Stats Structure → Our Structure

#### 1. `member_history` Array → `player_history` Table

**Clash of Stats format:**
```json
{
  "player_name": "flame",
  "player_tag": "#299PGYLG",
  "role": "Member",
  "first_seen": "November 16, 2025",
  "last_seen": "Still a Member",
  "is_active": true,
  "player_slug": "flame-299PGYLG"
}
```

**Our `player_history` format:**
```typescript
{
  clan_tag: string;
  player_tag: string;  // Normalized (no #, uppercase)
  primary_name: string;
  status: 'active' | 'departed' | 'applicant' | 'rejected';
  total_tenure: number;  // Days
  current_stint: { startDate: string; isActive: boolean } | null;
  movements: Array<{
    type: 'joined' | 'departed' | 'returned';
    date: string;  // ISO date string
    reason?: string;
    tenureAtDeparture?: number;
    notes?: string;
  }>;
  aliases: Array<{
    name: string;
    firstSeen: string;  // ISO date
    lastSeen: string;   // ISO date
  }>;
  notes: Array<{
    timestamp: string;
    note: string;
    customFields?: Record<string, string>;
  }>;
}
```

#### 2. `active_member_logs` → `movements` Array

**Clash of Stats format:**
```json
{
  "clan_tag": "#2PR8R8V8P",
  "clan_name": "",
  "from": "Jan 10, 2026",
  "to": "Jan 11, 2026"
}
```

**Our `movements` format:**
- Each period in `active_member_logs` represents a stint in the clan
- Can be converted to:
  - `{ type: 'joined', date: <from date> }`
  - `{ type: 'departed', date: <to date> }` (if `to` is not "Still a Member")
  - `{ type: 'returned', date: <from date> }` (if there are multiple periods)

---

## 🔄 Merge Strategy

### Option 1: Merge into `player_history` Table (RECOMMENDED)

**What it does:**
- Creates/updates `player_history` records for all players in `member_history`
- Adds `movements` from `active_member_logs`
- Calculates tenure from date ranges
- Sets appropriate `status` based on `is_active`
- Adds aliases if name changed

**Benefits:**
- Preserves existing data
- Adds historical context
- Enables Activity History timeline views
- Supports tenure calculations

**Process:**
1. **Normalize tags**: Convert `#299PGYLG` → `299PGYLG` (uppercase, no #)
2. **Parse dates**: Convert "November 16, 2025" → "2025-11-16" (ISO format)
3. **Map status**: 
   - `is_active: true` + `last_seen: "Still a Member"` → `status: 'active'`
   - `is_active: false` → `status: 'departed'`
4. **Convert movements**:
   - For each player, process `active_member_logs[player_slug]` array
   - Sort by date (earliest first)
   - Create movements:
     - First entry → `{ type: 'joined', date: <from> }`
     - Subsequent entries → `{ type: 'returned', date: <from> }`
     - If `to` is not "Still a Member" → `{ type: 'departed', date: <to> }`
5. **Calculate tenure**:
   - Sum all date ranges in `active_member_logs`
   - Convert to days: `Math.floor((toDate - fromDate) / (1000 * 60 * 60 * 24))`
6. **Merge with existing**:
   - Use `UPSERT` on `(clan_tag, player_tag)`
   - Merge movements arrays (deduplicate by date+type)
   - Preserve existing `notes` and custom `aliases`
   - Update `total_tenure` if new data has more history

### Option 2: Create Historical Events in `player_activity_events`

**What it does:**
- Creates activity events for clan join/departure events
- Stores in `player_activity_events` table with `event_type: 'clan_membership_change'`

**Benefits:**
- Appears in activity timelines
- Less invasive (doesn't modify player_history)
- Can be used for analytics

**Limitations:**
- Doesn't preserve tenure calculations
- Requires separate queries to build complete history

### Option 3: Hybrid Approach (BEST)

**Combination:**
1. Merge into `player_history` (Option 1) for complete record
2. Optionally create events in `player_activity_events` for timeline visibility
3. Update `player_day` table if we have snapshot dates (but scraper data lacks stats)

---

## 🛠️ Implementation Steps

### Step 1: Data Transformation Script

Create a script to:
1. Parse the JSON file
2. Normalize all player tags
3. Convert date strings to ISO format
4. Map `member_history` entries to our structure
5. Convert `active_member_logs` to `movements` arrays
6. Calculate tenure totals

### Step 2: Merge Logic

```typescript
// Pseudocode
for each player in member_history:
  normalizedTag = normalizeTag(player.player_tag) // Remove #, uppercase
  existingRecord = await getPlayerHistory(clanTag, normalizedTag)
  
  // Convert active_member_logs to movements
  movements = []
  if (active_member_logs[player.player_slug]):
    for (let i = 0; i < logs.length; i++):
      log = logs[i]
      fromDate = parseDate(log.from) // "Jan 10, 2026" → "2026-01-10"
      toDate = parseDate(log.to)     // "Jan 11, 2026" → "2026-01-11" or null
      
      if (i === 0):
        movements.push({ type: 'joined', date: fromDate })
      else:
        movements.push({ type: 'returned', date: fromDate })
      
      if (toDate && toDate < today):
        movements.push({ type: 'departed', date: toDate })
  
  // Calculate tenure
  totalTenure = 0
  for (log in active_member_logs[player.player_slug]):
    fromDate = parseDate(log.from)
    toDate = parseDate(log.to) || today
    totalTenure += daysBetween(fromDate, toDate)
  
  // Determine status
  status = player.is_active ? 'active' : 'departed'
  
  // Determine current_stint
  currentStint = null
  if (player.is_active && movements.length > 0):
    lastMovement = movements[movements.length - 1]
    if (lastMovement.type === 'joined' || lastMovement.type === 'returned'):
      currentStint = {
        startDate: lastMovement.date,
        isActive: true
      }
  
  // Merge with existing
  mergedMovements = mergeMovements(existingRecord?.movements || [], movements)
  mergedAliases = mergeAliases(existingRecord?.aliases || [], [{
    name: player.player_name,
    firstSeen: parseDate(player.first_seen),
    lastSeen: parseDate(player.last_seen) || new Date().toISOString()
  }])
  
  // Upsert
  await upsertPlayerHistory({
    clanTag,
    playerTag: normalizedTag,
    primaryName: player.player_name,
    status,
    totalTenure: Math.max(totalTenure, existingRecord?.total_tenure || 0),
    currentStint,
    movements: mergedMovements,
    aliases: mergedAliases,
    notes: existingRecord?.notes || [] // Preserve existing notes
  })
```

### Step 3: Date Parsing Helper

```typescript
function parseDate(dateStr: string): string {
  // Handle various formats:
  // - "November 16, 2025" → "2025-11-16"
  // - "Jan 10, 2026" → "2026-01-10"
  // - "Still a Member" → null (use current date)
  
  if (dateStr === "Still a Member" || !dateStr) {
    return new Date().toISOString().split('T')[0];
  }
  
  // Parse and convert to ISO format
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}
```

### Step 4: Merge/Deduplicate Logic

```typescript
function mergeMovements(existing: Movement[], newMovements: Movement[]): Movement[] {
  const combined = [...existing, ...newMovements];
  const seen = new Set();
  
  return combined
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .filter(m => {
      const key = `${m.type}|${m.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
```

---

## ⚠️ Limitations & Considerations

### 1. **Date Format Inconsistency**
- Clash of Stats uses: "November 16, 2025", "Jan 10, 2026"
- Our system expects: ISO date strings ("2025-11-16")
- **Solution**: Robust date parsing function

### 2. **Missing Player Stats**
- Scraper data has NO player stats (TH level, trophies, heroes, etc.)
- Only has membership history (names, tags, roles, dates)
- **Impact**: Can't populate `player_day` table with historical stats
- **Solution**: Only merge into `player_history` table

### 3. **Tenure Calculation Accuracy**
- `active_member_logs` may have gaps or overlaps
- Dates are approximate (month/day precision, not exact timestamps)
- **Solution**: Sum all periods, handle overlaps by taking union of date ranges

### 4. **Role Information**
- Clash of Stats has `role: "Member" | "Elder" | "Co-leader" | "Leader"`
- Our system tracks role in `roster_snapshots`, not in `player_history`
- **Impact**: Role history not preserved in player_history
- **Solution**: Role is snapshot-based, not historical (acceptable)

### 5. **Name Changes / Aliases**
- Clash of Stats has `player_name` and `first_seen`/`last_seen` dates
- Our system tracks `aliases` array
- **Solution**: Add current name as alias if different from `primary_name`

### 6. **Duplicate Prevention**
- Must deduplicate movements by `(type, date)` combination
- Must preserve existing `notes` and custom data
- **Solution**: Use merge logic that preserves existing data

### 7. **Current vs Historical Players**
- `is_active: true` → `status: 'active'`
- `is_active: false` → `status: 'departed'`
- **Consideration**: If player is currently active in our system but marked as departed in scraper data, need conflict resolution
- **Solution**: Prefer our current data for status, but merge historical movements

---

## 📋 Data Quality Checks

Before merging, validate:
1. ✅ All player tags are valid (8-9 characters, alphanumeric)
2. ✅ All dates are parseable
3. ✅ No duplicate movements (same type + date)
4. ✅ Date ranges are logical (from < to)
5. ✅ Active players have current_stint set
6. ✅ Total tenure is reasonable (not negative, not absurdly large)

---

## 🎯 Expected Outcomes

After merge:
1. **1,028 player records** in `player_history` table (one per player in member_history)
2. **Historical movements** showing join/departure/return events
3. **Accurate tenure calculations** based on date ranges
4. **Complete alias history** showing name changes over time
5. **Activity timeline** showing when players were in the clan
6. **Former players** accessible in player database with full history

---

## 🚀 Next Steps

1. **Create migration script** to parse JSON and transform data
2. **Test on sample data** (5-10 players) first
3. **Validate data quality** before full merge
4. **Run merge script** (can be idempotent with upsert)
5. **Verify results** in database
6. **Update UI** to display historical data (should already work if data is in player_history)

---

## 📝 API Endpoints to Use

- `POST /api/player-history` - Upsert player history records
- `GET /api/player-history?clanTag=...&playerTag=...` - Verify records

---

## 🔍 Verification Queries

After merge, verify with:

```sql
-- Check total players imported
SELECT COUNT(*) FROM player_history 
WHERE clan_tag = '2PR8R8V8P';

-- Check players with movements
SELECT player_tag, primary_name, array_length(movements, 1) as movement_count
FROM player_history 
WHERE clan_tag = '2PR8R8V8P' 
ORDER BY movement_count DESC NULLS LAST;

-- Check tenure totals
SELECT player_tag, primary_name, total_tenure, status
FROM player_history 
WHERE clan_tag = '2PR8R8V8P'
ORDER BY total_tenure DESC NULLS LAST;

-- Check active vs departed
SELECT status, COUNT(*) 
FROM player_history 
WHERE clan_tag = '2PR8R8V8P'
GROUP BY status;
```

---

## ✅ Conclusion

**Yes, this merge is possible and recommended!** 

The Clash of Stats data provides valuable historical context that will enrich the player database and activity history. The main work is:
1. Data transformation (dates, tags, movements)
2. Merge logic (preserve existing, add new)
3. Validation (data quality checks)

The result will be a comprehensive player history showing all former and current members with their tenure, movements, and aliases.
