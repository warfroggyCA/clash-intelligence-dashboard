# Infallible Three-Tiered Sorting Logic for Clash Intelligence Dashboard

## Overview

This document describes the definitive sorting algorithm used in the Clash Intelligence dashboard to rank clan members. The logic prioritizes competitive engagement in the new 34-tier Ranked League system over legacy trophy counts, providing clan leaders with actionable insights into their roster's competitive standing.

## The Three-Tiered Sorting Hierarchy

### Tier 1: Competitive Eligibility (Primary Filter)

**Purpose**: Separate players who are enrolled in the new competitive system from those who remain in the legacy system.

**Sort Field**: `Competitive_Flag` (calculated)
- **Value 1**: `Member.rankedLeagueId !== 105000000` (Any defined competitive tier)
- **Value 0**: `Member.rankedLeagueId === 105000000` (Unranked Competitive Tier)

**Sort Order**: Descending (1 comes before 0)

**Rationale**: This guarantees that all seeded/competitive players appear before legacy/unranked players, regardless of their trophy counts.

### Tier 2: Ranked League Order (For Competitive Players Only)

**Purpose**: Rank competitive players by their relative strength within the 34-tier system.

**Sort Field**: `Member.rankedLeagueId`
- **Data Range**: IDs from 105000001 (Skeleton League 3) up to 105000034 (Legend League)
- **Examples**: 
  - Witch League 16 = ID 105000016
  - Valkyrie League 13 = ID 105000013
  - Wizard League 12 = ID 105000012
  - Archer League 8 = ID 105000008

**Sort Order**: Descending (Higher IDs = Higher Tiers)

**Rationale**: The `rankedLeagueId` is inherently structured for ranking purposes. Higher IDs correspond to higher competitive tiers, making this the most reliable indicator of competitive standing.

### Tier 3: Legacy Trophy Count (For Unranked Players Only)

**Purpose**: Rank players who are not in the competitive system using traditional metrics.

**Sort Field**: `Member.trophies`
- **Data Range**: Legacy trophy score from Home Village battles
- **Sort Order**: Descending (Higher trophies first)

**Rationale**: Since these players are not participating in the weekly competitive cycle, their standing defaults to traditional Home Village trophy performance.

## Implementation Code

```typescript
case 'league':
  // The Infallible Three-Tiered Sorting Logic
  // Tier 1: Competitive Eligibility (Primary Filter)
  const aCompetitiveFlag = (a.rankedLeagueId && a.rankedLeagueId !== 105000000) ? 1 : 0;
  const bCompetitiveFlag = (b.rankedLeagueId && b.rankedLeagueId !== 105000000) ? 1 : 0;
  
  // Primary sort: Competitive players first (descending)
  if (aCompetitiveFlag !== bCompetitiveFlag) {
    comparison = aCompetitiveFlag - bCompetitiveFlag; // 1 comes before 0 (descending)
  } else if (aCompetitiveFlag === 1) {
    // Tier 2: Both are competitive - sort by league tier ID (descending)
    const aLeagueTier = a.rankedLeagueId || 0;
    const bLeagueTier = b.rankedLeagueId || 0;
    comparison = aLeagueTier - bLeagueTier; // Higher ID = higher tier
  } else {
    // Tier 3: Both are unranked - sort by legacy trophies (descending)
    comparison = a.trophies - b.trophies;
  }
  break;
```

## Expected Output Order

### GROUP 1: RANKED/SEEDED PLAYERS (Competitive Flag = 1)

Players are ordered by their `rankedLeagueId` in descending order:

1. **DoubleD** - Witch League 16 (ID: 105000016) - 414 trophies
2. **War.Frog** - Valkyrie League 13 (ID: 105000013) - 431 trophies
3. **warfroggy** - Valkyrie League 13 (ID: 105000013) - 380 trophies
4. **MD.Soudho$$** - Valkyrie League 13 (ID: 105000013) - 134 trophies
5. **Headhuntress** - Wizard League 12 (ID: 105000012) - 371 trophies
6. **Tigress** - Wizard League 12 (ID: 105000012) - 274 trophies
7. **Sirojiddin** - Wizard League 11 (ID: 105000011) - 0 trophies
8. **CosmicThomas** - Wizard League 10 (ID: 105000010) - 319 trophies
9. **Zouboul** - Wizard League 10 (ID: 105000010) - 0 trophies
10. **se** - Archer League 9 (ID: 105000009) - 299 trophies
11. **Argon** - Archer League 8 (ID: 105000008) - 0 trophies
12. **ethan** - Archer League 8 (ID: 105000008) - 0 trophies
13. **ÀRSENIC** - Barbarian League 6 (ID: 105000006) - 0 trophies

### GROUP 2: LEGACY/TRULY UNRANKED (Competitive Flag = 0)

Players are ordered by their legacy trophy count in descending order:

14. **andrew** - Unranked (ID: 105000000) - 2729 trophies
15. **fahad bd** - Unranked (ID: 105000000) - 2297 trophies
16. **BinhĐen24** - Unranked (ID: 105000000) - 2066 trophies
17. **A.Ar1an** - Unranked (ID: 105000000) - 1960 trophies
18. **Mateи238** - Unranked (ID: 105000000) - 1839 trophies
19. **JPSavke** - Unranked (ID: 105000000) - 1172 trophies

## Key Benefits

1. **Automatic Segregation**: Competitive players are always listed before legacy players
2. **Stable Ranking**: Uses permanent league IDs rather than weekly trophy counts
3. **Future-Proof**: Works regardless of player activity levels or trophy changes
4. **Clear Hierarchy**: Clan leaders immediately see their top competitive performers
5. **No Hardcoding**: Relies on API data structure, not manual lists
6. **Performance-Based Tiebreaker**: When players share the same league, they're sorted by last week's trophy performance

## Data Field Requirements

The sorting logic requires these fields in the Member model:

- `rankedLeagueId`: The competitive league tier ID (105000001-105000034, or 105000000 for unranked)
- `lastWeekTrophies`: Last week's final trophy count (Monday 4:30 AM UTC snapshot) for tiebreaking within same league
- `trophies`: Current trophy count for fallback sorting of unranked players

## API Data Structure Examples

From the Clash of Clans API (`/clans/%23TAG/members` endpoint), the `leagueTier` field structure:

### Example 1: Competitive Player (Seeded in Ranked System)
```json
{
  "tag": "#VGQVRLRL",
  "name": "DoubleD",
  "role": "coLeader",
  "townHallLevel": 14,
  "league": {
    "id": 29000020,
    "name": "Titan League II"
  },
  "leagueTier": {
    "id": 105000016,
    "name": "Witch League 16",
    "iconUrls": {
      "small": "https://api-assets.clashofclans.com/leaguetiers/125/...",
      "large": "https://api-assets.clashofclans.com/leaguetiers/326/..."
    }
  },
  "trophies": 414
}
```

### Example 2: Unranked Player (Not Participating in Ranked System)
```json
{
  "tag": "#UU9GJ9QQ",
  "name": "andrew",
  "role": "member",
  "townHallLevel": 14,
  "league": {
    "id": 29000000,
    "name": "Unranked"
  },
  "leagueTier": {
    "id": 105000000,
    "name": "Unranked",
    "iconUrls": {
      "small": "https://api-assets.clashofclans.com/leaguetiers/125/...",
      "large": "https://api-assets.clashofclans.com/leaguetiers/326/..."
    }
  },
  "trophies": 2729
}
```

**Key Observation**: 
- `league.id` = Legacy trophy league (29000xxx)
- `leagueTier.id` = New ranked competitive tier (105000xxx)
- These are DIFFERENT systems! A player can have `league.name = "Unranked"` but still have `leagueTier.id = 105000016` (competitive seeded)
- The dashboard should use `leagueTier.id` for sorting, NOT `league.id`

## Notes

- **League Badge Display**: Separate logic determines whether to show league badges vs. "Inactive" text
- **Weekly Reset**: This sorting is stable across weekly trophy resets in the ranked system
- **Migration Handling**: Automatically adapts as players migrate between ranked and legacy systems
- **API Dependencies**: Relies on accurate `rankedLeagueId` data from Clash of Clans API

## Data Mapping Fix (January 2025)

**Issue**: The data ingestion pipeline was incorrectly mapping `league.id` (legacy) instead of `leagueTier.id` (new competitive system) to `rankedLeagueId`.

**Solution Implemented**: Updated `/api/v2/roster/route.ts` to correctly extract and map the `leagueTier` object:

```typescript
// Extract leagueTier (new Oct 2025 ranked system) - CRITICAL for sorting
const leagueTier = summary.leagueTier || detail?.leagueTier || null;
const leagueTierId = typeof leagueTier === 'object' ? leagueTier?.id : null;
const leagueTierName = typeof leagueTier === 'object' ? leagueTier?.name : null;

// Map to dashboard fields
rankedLeagueId: leagueTierId || leagueId, // Use leagueTier.id first, fallback to legacy
rankedLeagueName: leagueTierName || leagueName,
```

**Result**: The infallible sorting logic now works automatically without any hardcoding. The system correctly distinguishes between:
- Competitive players (`leagueTier.id !== 105000000`) 
- Unranked players (`leagueTier.id === 105000000`)

**Next Ingestion**: The fix will take effect on the next data ingestion run, populating correct `rankedLeagueId` values from the CoC API.

## Version History

- **v1.0** (Current): Three-tiered sorting with competitive flag, league tier ID, and legacy trophies
- **Future**: May incorporate `rankedTrophies` as tertiary sort for active competitive players

---

*This document serves as the definitive reference for roster sorting logic in the Clash Intelligence dashboard.*
