# Data Format Specification for Clash Intelligence Harvesting Tool

**Purpose:** This document specifies the optimal data structure and format for a tool that harvests Clash of Clans player/clan data from external sources (e.g., Clash of Stats, ClashAPI, etc.) to be imported into this dashboard.

**Last Updated:** 2026-01-15

## Overview

When importing data for a **new clan** (starting fresh), the tool should present data in a format that aligns with our ingestion pipeline and database schema. This ensures smooth data import and maximizes compatibility with existing features.

## Core Data Structure

### Clan-Level Data

```typescript
interface ClanData {
  tag: string;              // REQUIRED: Clan tag (with or without #, will be normalized)
  name: string;             // REQUIRED: Clan name
  logo_url?: string | null; // Optional: URL to clan badge/logo
}
```

**Important:** 
- Tags are normalized (removed `#` and uppercased) internally
- Logo URL should be the largest/highest quality badge image available

### Member-Level Data (Per Player)

The core member data structure should match our `Member` interface. Here's the **priority-ordered** structure:

#### **TIER 1: Essential Fields (Must Have)**

```typescript
interface EssentialMemberData {
  tag: string;                    // REQUIRED: Player tag (with or without #)
  name: string;                   // REQUIRED: Player name
  townHallLevel: number;          // REQUIRED: Town Hall level (1-18)
  role: string;                   // REQUIRED: 'leader' | 'coLeader' | 'admin' | 'member'
  
  // Trophy & League (CRITICAL - use fallback order)
  trophies?: number | null;       // Primary trophies
  rankedTrophies?: number | null; // Ranked trophies (priority 1 for fallback)
  rankedLeagueId?: number | null;
  rankedLeagueName?: string | null;
  leagueId?: number | null;       // Regular league ID
  leagueName?: string | null;     // Regular league name (priority 2 for fallback)
  leagueTrophies?: number | null;
  battleModeTrophies?: number | null; // Battle mode trophies (priority 4)
  
  // Donations (REQUIRED for activity scoring)
  donations?: number | null;
  donationsReceived?: number | null;
  
  // Hero Levels (REQUIRED for war planning)
  heroLevels?: {
    'Barbarian King'?: number | null;
    'Archer Queen'?: number | null;
    'Grand Warden'?: number | null;
    'Royal Champion'?: number | null;
    'Minion Prince'?: number | null;
  } | null;
  
  // Timestamps
  lastSeen?: string | number | null; // ISO date string or timestamp
  snapshotDate?: string;             // Date when data was captured (YYYY-MM-DD)
  fetchedAt?: string;                // ISO timestamp when data was fetched
}
```

#### **TIER 2: Highly Recommended Fields**

```typescript
interface RecommendedMemberData {
  // War Stats
  warStars?: number | null;
  attackWins?: number | null;
  defenseWins?: number | null;
  
  // Builder Base
  builderHallLevel?: number | null;
  versusTrophies?: number | null;
  versusBattleWins?: number | null;
  builderLeagueId?: number | null;
  
  // Capital
  clanCapitalContributions?: number | null;
  
  // Achievements
  expLevel?: number | null;
  achievementCount?: number | null;
  achievementScore?: number | null;
  bestTrophies?: number | null;
  bestVersusTrophies?: number | null;
  
  // Equipment (Oct 2025+)
  equipmentFlags?: Record<string, any> | null;
  
  // League Details
  leagueIconSmall?: string | null;
  leagueIconMedium?: string | null;
  rankedModifier?: Record<string, any> | null;
  seasonResetAt?: string | null;
}
```

#### **TIER 3: Nice-to-Have Fields**

```typescript
interface OptionalMemberData {
  // Pets (if available)
  petLevels?: {
    'L.A.S.S.I'?: number | null;
    'Electro Owl'?: number | null;
    'Mighty Yak'?: number | null;
    // ... other pets
  } | null;
  
  // Tournament Stats (if available)
  tournamentStats?: {
    seasonId: string;
    attacksUsed: number;
    attacksMax: number;
    offTrophies: number;
    defTrophies: number;
    offAvgDestruction?: number;
    defAvgDestruction?: number;
    rank?: number;
    promotion?: 'promoted' | 'retained' | 'demoted' | 'decay';
  } | null;
  
  // Shield Status
  shieldStatus?: {
    type: 'none' | 'magic' | 'legend';
    durationHours: number;
    lootProtected: boolean;
    revengeAvailable: boolean;
  } | null;
  
  // Troop/Spell Capacities
  maxTroopCount?: number | null;
  maxSpellCount?: number | null;
  superTroopsActive?: string[] | null;
}
```

## Trophy & League Resolution Order

**CRITICAL:** Our system uses a fallback order for trophies and leagues. Present data with these fields so the system can apply the correct fallback:

1. **rankedTrophies** (highest priority - Monday finals)
2. **trophies** (regular league trophies)
3. **leagueTrophies** (fallback if trophies missing)
4. **battleModeTrophies** (lowest priority)

For league names:
1. **rankedLeagueName** (highest priority)
2. **leagueName** (regular league)
3. Fallback to league object if available

**Recommendation:** Provide ALL available trophy/league fields. The system will automatically use the highest-priority available value.

## Complete Snapshot Structure

When harvesting a full clan roster, structure it as:

```typescript
interface ClanSnapshot {
  clan: ClanData;
  members: Array<EssentialMemberData & RecommendedMemberData & OptionalMemberData>;
  snapshotDate: string;        // YYYY-MM-DD format
  fetchedAt: string;           // ISO 8601 timestamp
  metadata?: {
    source: string;            // e.g., "clash-of-stats", "clash-api"
    sourceVersion?: string;
    clanLevel?: number;
    memberCount?: number;
    totalTrophies?: number;
    totalDonations?: number;
  };
}
```

## Data Format Recommendations

### 1. **JSON Format (Recommended)**

```json
{
  "clan": {
    "tag": "#ABC123",
    "name": "Example Clan",
    "logo_url": "https://..."
  },
  "members": [
    {
      "tag": "#PLAYER1",
      "name": "Player One",
      "townHallLevel": 15,
      "role": "coLeader",
      "trophies": 5200,
      "rankedTrophies": 5100,
      "rankedLeagueId": 29000022,
      "rankedLeagueName": "Titan League I",
      "leagueName": "Titan League I",
      "leagueTrophies": 5200,
      "donations": 2500,
      "donationsReceived": 2500,
      "heroLevels": {
        "Barbarian King": 85,
        "Archer Queen": 85,
        "Grand Warden": 65,
        "Royal Champion": 25
      },
      "warStars": 500,
      "attackWins": 1200,
      "defenseWins": 50,
      "clanCapitalContributions": 50000,
      "snapshotDate": "2026-01-15",
      "fetchedAt": "2026-01-15T12:00:00Z"
    }
    // ... more members
  ],
  "snapshotDate": "2026-01-15",
  "fetchedAt": "2026-01-15T12:00:00Z",
  "metadata": {
    "source": "clash-of-stats",
    "memberCount": 50,
    "totalTrophies": 260000
  }
}
```

### 2. **CSV Format (Alternative)**

If using CSV, include these columns (in order of priority):

**Required Columns:**
- `tag`, `name`, `townHallLevel`, `role`
- `trophies`, `donations`, `donationsReceived`
- `snapshotDate`, `fetchedAt`

**Recommended Columns:**
- `rankedTrophies`, `rankedLeagueId`, `rankedLeagueName`
- `leagueId`, `leagueName`, `leagueTrophies`
- `warStars`, `attackWins`, `defenseWins`
- `heroLevels` (JSON string or separate columns: `bk`, `aq`, `gw`, `rc`, `mp`)

**Hero Levels in CSV:**
- Option A: Single JSON column: `{"Barbarian King": 85, "Archer Queen": 85, ...}`
- Option B: Separate columns: `bk`, `aq`, `gw`, `rc`, `mp`

## Field Type Specifications

### Numbers
- Use `null` (not `0`) for missing/unknown values
- Use actual `0` only when the value is genuinely zero (e.g., `donations: 0` means they gave zero donations this season)

### Strings
- Tags: Can include or omit `#` (will be normalized)
- Names: Use exact player names as shown in-game
- Dates: Use ISO 8601 format (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ssZ`)

### Enums/Roles
- Role values: `'leader'`, `'coLeader'`, `'admin'`, `'member'` (case-sensitive)
- League types: Use standard Clash of Clans league IDs/names

### Null vs Undefined
- Use `null` for missing values (our TypeScript types expect `null` for optional fields)
- Omit fields entirely if completely unavailable (undefined)

## Import Workflow (For New Clan)

When starting fresh with a new clan:

1. **Harvest initial snapshot** with Tier 1 + Tier 2 fields
2. **Structure as ClanSnapshot** with proper timestamps
3. **Import into system** via ingestion pipeline (or manual import if tool supports it)
4. **Subsequent snapshots** should maintain consistency:
   - Same field structure
   - Incremental `snapshotDate` and `fetchedAt` values
   - Track changes over time

## What Gets Computed vs Provided

### Provided by Harvesting Tool
- Raw player data (trophies, heroes, donations, etc.)
- Timestamps (when data was captured)
- League information

### Computed by This System
- **Activity Score**: Calculated from donations, trophy changes, tenure
- **Rush Percent**: Computed from TH level vs hero levels
- **VIP Score**: Calculated from multiple factors
- **Tenure**: Ledger-backed (requires historical tracking)
- **Resolved Trophies/Leagues**: Applied fallback logic automatically

**Recommendation:** Don't try to compute activity scores or VIP scores. Focus on providing clean, accurate raw data.

## Best Practices for Harvesting Tool

1. **Consistency**: Use the same field names and structure across all snapshots
2. **Completeness**: Provide Tier 1 fields for ALL members (even if some Tier 2/3 fields are missing)
3. **Timestamps**: Always include `snapshotDate` and `fetchedAt` for time-series analysis
4. **Tag Normalization**: The tool can include `#` in tags; our system will normalize
5. **Null Handling**: Use `null` (not `0`) for missing data
6. **Hero Levels**: Always provide hero levels if available (critical for war planning)
7. **League Data**: Provide both ranked and regular league info when available
8. **Metadata**: Include source information for traceability

## Integration Points

Once data is harvested in this format, it can be:

1. **Direct Import**: Processed through our ingestion pipeline (`web-next/src/lib/ingestion/staged-pipeline.ts`)
2. **API Upload**: Sent to an import endpoint (if created)
3. **Database Insert**: Directly inserted into `roster_snapshots` and `member_snapshot_stats` tables

The ingestion pipeline will:
- Normalize tags
- Apply trophy/league fallback logic
- Compute derived fields (rush%, activity scores)
- Persist to database with proper relationships
- Create snapshot records for historical tracking

## Example: Minimal Valid Snapshot

```json
{
  "clan": {
    "tag": "#ABC123",
    "name": "Example Clan"
  },
  "members": [
    {
      "tag": "#PLAYER1",
      "name": "Player One",
      "townHallLevel": 15,
      "role": "member",
      "trophies": 5000,
      "donations": 1000,
      "donationsReceived": 1000,
      "heroLevels": {
        "Barbarian King": 80,
        "Archer Queen": 80
      },
      "snapshotDate": "2026-01-15",
      "fetchedAt": "2026-01-15T12:00:00Z"
    }
  ],
  "snapshotDate": "2026-01-15",
  "fetchedAt": "2026-01-15T12:00:00Z"
}
```

This minimal structure contains all Tier 1 essential fields and is sufficient for basic roster tracking.

## Questions or Issues?

Refer to:
- `web-next/src/types/index.ts` - Full type definitions
- `web-next/src/lib/ingestion/staged-pipeline.ts` - How data is processed
- `web-next/src/app/api/v2/roster/route.ts` - Canonical output format
- `web-next/docs/DEVELOPMENT_TRUTHS.md` - Data flow and SSOT principles

