# Enriched Player Data API Reference

## Overview

As of **October 12, 2025**, the Clash Intelligence platform tracks 17 additional enriched fields for every player in historical snapshots. This enriched data enables timeline highlights, advanced analytics, and deeper insights into player progression.

---

## API Endpoints

### `GET /api/v2/player/[tag]`

Returns comprehensive player profile data including enriched historical metrics.

**Response Structure:**
```typescript
{
  success: true,
  data: {
    // Core player info
    name: string,
    tag: string,
    role: string | null,
    townHallLevel: number | null,
    trophies: number,
    lastWeekTrophies: number,
    rankedTrophies: number | null,
    donations: number | null,
    donationsReceived: number | null,
    
    // Ranked league
    rankedLeagueId: number | null,
    rankedLeagueName: string | null,
    rankedLeague: { id: number, name: string } | null,
    
    // Heroes
    bk: number | null,
    aq: number | null,
    gw: number | null,
    rc: number | null,
    mp: number | null,
    
    // Activity timeline
    activityTimeline: PlayerActivityTimelineEvent[],
    
    // 🆕 ENRICHED DATA (October 2025)
    enriched: {
      petLevels: Record<string, number> | null,        // e.g. {"L.A.S.S.I": 10}
      builderHallLevel: number | null,                 // 1-10
      versusTrophies: number | null,                   // Builder Base trophies
      versusBattleWins: number | null,                 // Versus wins
      warStars: number | null,                         // Total war stars
      attackWins: number | null,                       // Multiplayer wins
      capitalContributions: number | null,             // Capital gold contributed
      maxTroopCount: number | null,                    // Number of maxed troops
      maxSpellCount: number | null,                    // Number of maxed spells
      achievementCount: number | null,                 // 3-star achievements
      achievementScore: number | null,                 // Total achievement stars
      expLevel: number | null,                         // Player XP level
      bestTrophies: number | null,                     // All-time trophy high
    }
  }
}
```

**Example Request:**
```bash
curl http://localhost:5050/api/v2/player/G9QVRYC2Y
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "name": "warfroggy",
    "tag": "#G9QVRYC2Y",
    "townHallLevel": 13,
    "trophies": 145,
    "rankedLeagueId": 105000013,
    "rankedLeagueName": "Valkyrie League 13",
    "bk": 73,
    "aq": 74,
    "gw": 50,
    "rc": 15,
    "mp": 50,
    "enriched": {
      "petLevels": {
        "L.A.S.S.I": 10,
        "Electro Owl": 8,
        "Mighty Yak": 5,
        "Unicorn": 3
      },
      "builderHallLevel": 10,
      "versusTrophies": 2800,
      "versusBattleWins": 450,
      "warStars": 387,
      "attackWins": 2150,
      "capitalContributions": 125000,
      "maxTroopCount": 18,
      "maxSpellCount": 9,
      "achievementCount": 42,
      "achievementScore": 120,
      "expLevel": 180,
      "bestTrophies": 4200
    }
  }
}
```

---

## Database Schema

### `member_snapshot_stats` Table

All enriched fields are stored as nullable columns in `member_snapshot_stats`:

| Column | Type | Description | Null? |
|--------|------|-------------|-------|
| `pet_levels` | JSONB | Pet name → level mapping | ✅ |
| `builder_hall_level` | INTEGER | Builder Hall level (1-10) | ✅ |
| `versus_trophies` | INTEGER | Builder Base trophies | ✅ |
| `versus_battle_wins` | INTEGER | Total versus wins | ✅ |
| `builder_league_id` | INTEGER | Builder league ID | ✅ |
| `war_stars` | INTEGER | Cumulative war stars | ✅ |
| `attack_wins` | INTEGER | Multiplayer attack wins | ✅ |
| `defense_wins` | INTEGER | Defense wins | ✅ |
| `capital_contributions` | INTEGER | Capital gold contributed | ✅ |
| `max_troop_count` | INTEGER | Maxed troop count | ✅ |
| `max_spell_count` | INTEGER | Maxed spell count | ✅ |
| `super_troops_active` | TEXT[] | Active super troop names | ✅ |
| `achievement_count` | INTEGER | 3-star achievements | ✅ |
| `achievement_score` | INTEGER | Total achievement stars | ✅ |
| `exp_level` | INTEGER | Player XP level | ✅ |
| `best_trophies` | INTEGER | All-time trophy high | ✅ |
| `best_versus_trophies` | INTEGER | All-time BH trophy high | ✅ |

**Indexes:**
- `member_snapshot_stats_pet_levels_idx` (GIN index on JSONB)
- `member_snapshot_stats_builder_hall_level_idx`
- `member_snapshot_stats_versus_trophies_idx`
- `member_snapshot_stats_war_stars_idx`
- `member_snapshot_stats_capital_contributions_idx`
- `member_snapshot_stats_max_troop_count_idx`
- `member_snapshot_stats_achievement_count_idx`
- `member_snapshot_stats_exp_level_idx`

---

## Field Semantics

### Snapshot vs. Cumulative Fields

**Snapshot Fields** (change over time, reset, or fluctuate):
- `pet_levels` - Current pet levels at time of snapshot
- `builder_hall_level` - Current BH level
- `versus_trophies` - Current Builder Base trophy count
- `max_troop_count` - Current count of maxed troops (changes with TH upgrades)
- `max_spell_count` - Current count of maxed spells

**Cumulative Fields** (always increase, never decrease):
- `war_stars` - Lifetime total war stars
- `attack_wins` - Lifetime multiplayer wins
- `defense_wins` - Lifetime defense wins
- `versus_battle_wins` - Lifetime versus wins
- `capital_contributions` - Lifetime capital gold contributed
- `achievement_count` - Total 3-star achievements completed
- `achievement_score` - Lifetime achievement stars earned
- `exp_level` - Player experience level
- `best_trophies` - All-time trophy record
- `best_versus_trophies` - All-time BH trophy record

**Important**: When analyzing deltas, only snapshot fields should be compared between dates. Cumulative fields should always be increasing.

---

## Timeline Highlight Rules

### Automatic Highlight Detection

The system can generate timeline highlights based on enriched data changes:

| Event Type | Trigger Logic | Message Template | Priority |
|------------|---------------|------------------|----------|
| **Pet Maxed** | `petLevels[petName]` reaches pet max level | "🐾 Maxed {petName}!" | HIGH |
| **BH Upgrade** | `builder_hall_level` increases | "🏗️ Upgraded Builder Hall to {level}" | HIGH |
| **War Milestone** | `war_stars % 100 === 0` | "⭐ Reached {count} war stars!" | HIGH |
| **Capital Hero** | `capital_contributions >= 100000` | "💰 Contributed 100k+ capital gold!" | MEDIUM |
| **Lab Master** | `max_troop_count >= 20` | "⚔️ Maxed 20+ troops!" | MEDIUM |
| **Achievement** | `achievement_count` increases | "🏆 Completed achievement!" | MEDIUM |
| **XP Milestone** | `exp_level % 50 === 0` | "📈 Reached level {level}!" | LOW |
| **Trophy Record** | `best_trophies` increases | "🏅 New trophy record: {trophies}!" | LOW |

**Implementation Example:**
```typescript
function detectPetMaxed(prev: RawSnapshotRow, curr: RawSnapshotRow) {
  const prevPets = prev.pet_levels || {};
  const currPets = curr.pet_levels || {};
  
  const newlyMaxed: string[] = [];
  for (const [petName, level] of Object.entries(currPets)) {
    const prevLevel = prevPets[petName] || 0;
    // Check if pet was just maxed (assuming level 15 is max for all pets)
    if (level === 15 && prevLevel < 15) {
      newlyMaxed.push(petName);
    }
  }
  
  return newlyMaxed;
}
```

---

## Query Examples

### Get Player's Pet Progression Over Time

```sql
SELECT 
  snapshot_date,
  pet_levels
FROM member_snapshot_stats
WHERE member_id = 'uuid-here'
  AND pet_levels IS NOT NULL
ORDER BY snapshot_date ASC;
```

### Find Players with Most War Stars

```sql
SELECT 
  m.name,
  mss.war_stars,
  mss.attack_wins,
  mss.snapshot_date
FROM member_snapshot_stats mss
JOIN members m ON mss.member_id = m.id
WHERE mss.snapshot_date = (
  SELECT MAX(snapshot_date) FROM member_snapshot_stats
)
ORDER BY mss.war_stars DESC NULLS LAST
LIMIT 10;
```

### Track Builder Base Progression

```sql
SELECT 
  snapshot_date,
  builder_hall_level,
  versus_trophies,
  versus_battle_wins
FROM member_snapshot_stats
WHERE member_id = 'uuid-here'
  AND builder_hall_level IS NOT NULL
ORDER BY snapshot_date ASC;
```

### Find Achievement Leaders

```sql
SELECT 
  m.name,
  mss.achievement_count,
  mss.achievement_score,
  mss.exp_level
FROM member_snapshot_stats mss
JOIN members m ON mss.member_id = m.id
WHERE mss.snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY mss.achievement_score DESC NULLS LAST
LIMIT 10;
```

---

## Frontend Integration

### Displaying Pet Levels

```tsx
interface EnrichedData {
  petLevels: Record<string, number> | null;
  // ... other enriched fields
}

function PetLevelsDisplay({ enriched }: { enriched: EnrichedData }) {
  if (!enriched.petLevels) {
    return <span className="text-gray-500">No pets unlocked</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(enriched.petLevels).map(([petName, level]) => (
        <div key={petName} className="flex items-center gap-1 px-2 py-1 bg-slate-800 rounded">
          <span className="text-sm font-semibold">{petName}</span>
          <span className="text-xs text-slate-400">Lv {level}</span>
        </div>
      ))}
    </div>
  );
}
```

### Displaying War Stats

```tsx
function WarStatsCard({ enriched }: { enriched: EnrichedData }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <div className="text-slate-400 text-sm">War Stars</div>
        <div className="text-2xl font-bold">{enriched.warStars ?? '—'}</div>
      </div>
      <div>
        <div className="text-slate-400 text-sm">Attack Wins</div>
        <div className="text-2xl font-bold">{enriched.attackWins?.toLocaleString() ?? '—'}</div>
      </div>
      <div>
        <div className="text-slate-400 text-sm">Capital Gold</div>
        <div className="text-2xl font-bold">{enriched.capitalContributions?.toLocaleString() ?? '—'}</div>
      </div>
    </div>
  );
}
```

---

## Data Quality & Nullability

### Why Fields Are Nullable

Enriched fields are nullable for several reasons:

1. **Historical Data**: Older snapshots (before Oct 2025) don't have enriched data
2. **API Failures**: Some player details fetches may fail
3. **New Accounts**: Low-level players may not have pets, equipment, etc.
4. **Privacy**: Players may have restricted profiles

### Handling Null Values

```typescript
// ✅ GOOD: Check for null before using
const petCount = enriched.petLevels ? Object.keys(enriched.petLevels).length : 0;

// ✅ GOOD: Provide fallback display
const warStarsDisplay = enriched.warStars?.toLocaleString() ?? '—';

// ❌ BAD: Assume field exists
const lassiLevel = enriched.petLevels['L.A.S.S.I']; // Error if null!

// ✅ GOOD: Safe access
const lassiLevel = enriched.petLevels?.['L.A.S.S.I'] ?? 0;
```

---

## Backfilling Historical Data

To populate enriched fields for historical snapshots, use the backfill script:

```bash
# Dry run - preview first 5 snapshots
cd web-next
npm run backfill-enriched-data -- --limit=5

# Execute backfill for October 2025
npm run backfill-enriched-data -- --execute --start-date=2025-10-01

# Execute full backfill (all historical snapshots)
npm run backfill-enriched-data -- --execute
```

**Note**: Backfill requires historical `clan_snapshots` to have `player_details` JSONB populated. If player details were not fetched during snapshot, those rows will remain null.

---

## Performance Considerations

### Query Optimization

1. **Use Indexes**: All high-priority enriched fields have indexes
2. **Limit Date Ranges**: Don't fetch all history when you only need recent
3. **Selective Fields**: Only SELECT the enriched fields you need

**Example - Efficient Query:**
```sql
-- ✅ GOOD: Specific fields, date range, indexed columns
SELECT snapshot_date, war_stars, capital_contributions
FROM member_snapshot_stats
WHERE member_id = 'uuid'
  AND snapshot_date >= CURRENT_DATE - INTERVAL '30 days'
  AND war_stars IS NOT NULL
ORDER BY snapshot_date DESC;

-- ❌ BAD: SELECT *, no date filter, no null filter
SELECT *
FROM member_snapshot_stats
WHERE member_id = 'uuid'
ORDER BY snapshot_date DESC;
```

### JSONB Query Performance

For `pet_levels` (JSONB column), use GIN index for efficient queries:

```sql
-- Find players with L.A.S.S.I at level 10+
SELECT m.name, mss.pet_levels
FROM member_snapshot_stats mss
JOIN members m ON mss.member_id = m.id
WHERE mss.snapshot_date = CURRENT_DATE
  AND mss.pet_levels ? 'L.A.S.S.I'
  AND (mss.pet_levels->>'L.A.S.S.I')::int >= 10;
```

---

## Future Enhancements

### Planned Features (Not Yet Implemented)

1. **Timeline Highlights API** (`GET /api/v2/player/[tag]/timeline`)
   - Auto-generated milestones based on enriched data
   - Pet maxed, BH upgrades, war milestones, etc.

2. **Pet Progression API** (`GET /api/v2/player/[tag]/pets`)
   - Historical pet level tracking
   - Pet upgrade velocity charts

3. **War Performance API** (`GET /api/v2/player/[tag]/war-stats`)
   - War stars over time
   - Capital contributions history
   - Attack win rate trends

4. **Builder Base Analytics**
   - BH upgrade timeline
   - Versus trophy progression
   - Builder league history

---

## Changelog

### October 12, 2025 - Initial Release

**Added:**
- 17 new enriched fields to `member_snapshot_stats`
- Field extraction utilities (`field-extractors.ts`)
- Ingestion pipeline integration
- Player API enriched data response
- Backfill script for historical data

**Indexes Added:**
- 8 new B-tree indexes for performance
- 1 GIN index for JSONB pet_levels

**Files Modified:**
- `supabase/migrations/20250115_data_enrichment_schema.sql`
- `web-next/src/lib/ingestion/field-extractors.ts` (new)
- `web-next/src/lib/ingestion/staged-pipeline.ts`
- `web-next/src/app/api/v2/player/[tag]/route.ts`
- `web-next/scripts/backfill-enriched-data.ts` (new)

---

## Support & Troubleshooting

### Common Issues

**Q: Enriched fields are null for recent snapshots?**  
A: Check that `player_details` JSONB is populated in `clan_snapshots`. If null, the ingestion pipeline couldn't fetch player details from Clash API.

**Q: How do I know if backfill is needed?**  
A: Query `member_snapshot_stats` where `snapshot_date < '2025-10-12'` and check if enriched fields are null.

**Q: Can I add more enriched fields later?**  
A: Yes! Follow the same pattern:
1. Add column to `member_snapshot_stats` (migration)
2. Add extractor function in `field-extractors.ts`
3. Update `SnapshotStats` interface
4. Map in `staged-pipeline.ts`
5. Run backfill script

---

**Last Updated**: October 12, 2025  
**Maintained By**: Clash Intelligence Team  
**Version**: 1.0

