# Data Enrichment: Field Inventory & Schema Mapping

## Executive Summary

This document inventories all Clash of Clans API fields available in `playerDetails` that should be historized in the data spine for rich analytics, timelines, and insights.

**Status**: Phase 1 - Field Inventory ✅  
**Next**: Phase 2 - Schema Design  
**Date**: January 2025  
**Version**: 1.0

---

## Current State

### What's Stored Today
The current `member_snapshot_stats` table captures:
- ✅ Basic identity: `member_id`, `snapshot_id`, `snapshot_date`
- ✅ Core metrics: `trophies`, `donations`, `donations_received`, `activity_score`
- ✅ Progress: `th_level`, `hero_levels` (JSONB), `rush_percent`
- ✅ Role & league: `role`, `ranked_league_id`, `ranked_league_name`, `ranked_trophies`
- ✅ Equipment: `equipment_flags` (JSONB)

### What's Missing (Available but Not Historized)
Rich player data from the Clash API `playerDetails` object that's **not** being persisted historically:

---

## Field Inventory by Category

### 1️⃣ **Pets** 🐾
**Source**: `playerDetails[tag].pets[]`

| Field | Type | Example | Priority | Notes |
|-------|------|---------|----------|-------|
| `pets[].name` | string | "L.A.S.S.I" | HIGH | Pet identity |
| `pets[].level` | number | 10 | HIGH | Current level |
| `pets[].maxLevel` | number | 15 | MEDIUM | Cap for TH |
| `pets[].village` | string | "home" | LOW | Always "home" for pets |

**Use Cases**:
- Timeline: "Upgraded L.A.S.S.I to level 10"
- Analytics: Pet progression velocity
- Highlights: First maxed pet celebration

**Storage Strategy**: JSONB column `pet_levels` in `member_snapshot_stats`
```json
{
  "LASSI": 10,
  "Electro Owl": 8,
  "Mighty Yak": 5,
  "Unicorn": 0
}
```

---

### 2️⃣ **Troops & Spells** ⚔️
**Source**: `playerDetails[tag].troops[]`, `playerDetails[tag].spells[]`

| Field | Type | Example | Priority | Notes |
|-------|------|---------|----------|-------|
| `troops[].name` | string | "Barbarian" | MEDIUM | Troop identity |
| `troops[].level` | number | 9 | MEDIUM | Current level |
| `troops[].maxLevel` | number | 11 | LOW | Lab cap |
| `troops[].village` | string | "home"/"builderBase" | LOW | Village context |
| `troops[].superTroopIsActive` | boolean | true | LOW | Super troop active |
| `spells[].name` | string | "Healing Spell" | LOW | Spell identity |
| `spells[].level` | number | 7 | LOW | Current level |

**Use Cases**:
- Timeline: "Unlocked Super Barbarians"
- Analytics: Lab upgrade priorities
- Highlights: First max-level troop

**Storage Strategy**: Aggregated stats in `member_snapshot_stats`:
- `max_troop_count` (integer): Number of maxed troops
- `max_spell_count` (integer): Number of maxed spells
- `super_troops_active` (text[]): Active super troops

---

### 3️⃣ **Hero Equipment** 🛡️
**Source**: `playerDetails[tag].heroEquipment[]`

| Field | Type | Example | Priority | Notes |
|-------|------|---------|----------|-------|
| `heroEquipment[].name` | string | "Barbarian Puppet" | HIGH | Equipment identity |
| `heroEquipment[].level` | number | 18 | HIGH | Current level |
| `heroEquipment[].maxLevel` | number | 18 | MEDIUM | Max possible |
| `heroEquipment[].village` | string | "home" | LOW | Village context |

**Use Cases**:
- Timeline: "Maxed Barbarian Puppet"
- Analytics: Equipment progression tracking
- Highlights: First maxed equipment

**Storage Strategy**: Already exists as `equipment_flags` (JSONB), but enhance with level tracking:
```json
{
  "Barbarian Puppet": 18,
  "Rage Vial": 15,
  "Archer Puppet": 12
}
```

---

### 4️⃣ **Achievements** 🏆
**Source**: `playerDetails[tag].achievements[]`

| Field | Type | Example | Priority | Notes |
|-------|------|---------|----------|-------|
| `achievements[].name` | string | "Gold Grab" | MEDIUM | Achievement name |
| `achievements[].stars` | number | 3 | MEDIUM | Stars earned (0-3) |
| `achievements[].value` | number | 1000000 | LOW | Progress value |
| `achievements[].target` | number | 1000000 | LOW | Target value |
| `achievements[].info` | string | "Steal..." | LOW | Description |
| `achievements[].completionInfo` | string | "Jan 2025" | LOW | Completion date |
| `achievements[].village` | string | "home" | LOW | Village context |

**Use Cases**:
- Timeline: "Completed 'Gold Grab' achievement"
- Analytics: Achievement completion rate
- Highlights: 3-star achievement milestones

**Storage Strategy**: Aggregated metrics in `member_snapshot_stats`:
- `achievement_count` (integer): Total achievements completed (3-star)
- `achievement_score` (integer): Total stars earned

---

### 5️⃣ **Builder Base / Builder Hall** 🏗️
**Source**: `playerDetails[tag]` (root level fields)

| Field | Type | Example | Priority | Notes |
|-------|------|---------|----------|-------|
| `builderHallLevel` | number | 10 | HIGH | BH level |
| `versusTrophies` | number | 3500 | HIGH | Builder trophies |
| `versusBattleWins` | number | 1200 | MEDIUM | Versus wins |
| `builderBaseLeague` | object | {...} | MEDIUM | Builder league info |

**Use Cases**:
- Timeline: "Upgraded Builder Hall to 10"
- Analytics: Builder base progression
- Highlights: Builder trophy milestones

**Storage Strategy**: Add dedicated columns to `member_snapshot_stats`:
- `builder_hall_level` (integer)
- `versus_trophies` (integer)
- `versus_battle_wins` (integer)
- `builder_league_id` (integer)

---

### 6️⃣ **War & Raid Statistics** ⚔️
**Source**: `playerDetails[tag]` (root level fields)

| Field | Type | Example | Priority | Notes |
|-------|------|---------|----------|-------|
| `warStars` | number | 450 | HIGH | Total war stars |
| `attackWins` | number | 2500 | MEDIUM | Total attack wins |
| `defenseWins` | number | 800 | LOW | Total defense wins |
| `clanCapitalContributions` | number | 125000 | HIGH | Capital gold contributed |

**Use Cases**:
- Timeline: "Reached 500 war stars"
- Analytics: War participation trends
- Highlights: Major war milestones

**Storage Strategy**: Add columns to `member_snapshot_stats`:
- `war_stars` (integer)
- `attack_wins` (integer)
- `defense_wins` (integer)
- `capital_contributions` (integer)

---

### 7️⃣ **Experience & Progression** 📈
**Source**: `playerDetails[tag]` (root level fields)

| Field | Type | Example | Priority | Notes |
|-------|------|---------|----------|-------|
| `expLevel` | number | 180 | MEDIUM | Player experience level |
| `bestTrophies` | number | 5200 | LOW | All-time trophy high |
| `bestVersusTrophies` | number | 4500 | LOW | BH trophy high |
| `legendStatistics` | object | {...} | LOW | Legend league stats |

**Use Cases**:
- Timeline: "Reached level 200"
- Analytics: XP velocity
- Highlights: Level milestones (100, 150, 200, 250)

**Storage Strategy**: Add columns to `member_snapshot_stats`:
- `exp_level` (integer)
- `best_trophies` (integer)
- `best_versus_trophies` (integer)

---

### 8️⃣ **Clan War League** 🏅
**Source**: `playerDetails[tag].labels[]`, `war_log` context

| Field | Type | Example | Priority | Notes |
|-------|------|---------|----------|-------|
| `labels[].name` | string | "CWL" | LOW | Player labels |
| `labels[].iconUrls` | object | {...} | LOW | Label icons |

**Note**: CWL participation is better tracked via `war_log` and `current_war` data at the clan level rather than player level.

---

### 9️⃣ **Clan Context** 👥
**Source**: `playerDetails[tag].clan`

| Field | Type | Example | Priority | Notes |
|-------|------|---------|----------|-------|
| `clan.clanLevel` | number | 15 | LOW | Clan level (redundant) |
| `clan.name` | string | "HeCk YeAh" | LOW | Clan name (redundant) |
| `clan.tag` | string | "#2PR8R8V8P" | LOW | Clan tag (redundant) |

**Storage Strategy**: Already tracked via `clans` table. No additional historization needed.

---

## Priority Matrix

| Priority | Category | Fields | Justification |
|----------|----------|--------|---------------|
| **HIGH** | Pets | All levels | Core feature, high user interest |
| **HIGH** | Hero Equipment | Levels | Equipment system is new, high engagement |
| **HIGH** | Builder Base | BH level, trophies | Parallel progression track |
| **HIGH** | War Stats | War stars, capital contributions | Core clan activity |
| **MEDIUM** | Troops/Spells | Max counts | Lab progression insights |
| **MEDIUM** | Achievements | Completion count | Milestone tracking |
| **MEDIUM** | Experience | XP level | Player maturity indicator |
| **LOW** | Labels | Player tags | Limited analytical value |
| **LOW** | Best Trophies | Historical highs | Nice-to-have, low query frequency |

---

## Schema Design Preview

### New Columns for `member_snapshot_stats`

```sql
-- Pets (JSONB)
ALTER TABLE member_snapshot_stats ADD COLUMN pet_levels JSONB;

-- Builder Base
ALTER TABLE member_snapshot_stats ADD COLUMN builder_hall_level INTEGER;
ALTER TABLE member_snapshot_stats ADD COLUMN versus_trophies INTEGER;
ALTER TABLE member_snapshot_stats ADD COLUMN versus_battle_wins INTEGER;
ALTER TABLE member_snapshot_stats ADD COLUMN builder_league_id INTEGER;

-- War & Raids
ALTER TABLE member_snapshot_stats ADD COLUMN war_stars INTEGER;
ALTER TABLE member_snapshot_stats ADD COLUMN attack_wins INTEGER;
ALTER TABLE member_snapshot_stats ADD COLUMN defense_wins INTEGER;
ALTER TABLE member_snapshot_stats ADD COLUMN capital_contributions INTEGER;

-- Troops & Spells (aggregated)
ALTER TABLE member_snapshot_stats ADD COLUMN max_troop_count INTEGER;
ALTER TABLE member_snapshot_stats ADD COLUMN max_spell_count INTEGER;
ALTER TABLE member_snapshot_stats ADD COLUMN super_troops_active TEXT[];

-- Achievements (aggregated)
ALTER TABLE member_snapshot_stats ADD COLUMN achievement_count INTEGER;
ALTER TABLE member_snapshot_stats ADD COLUMN achievement_score INTEGER;

-- Experience
ALTER TABLE member_snapshot_stats ADD COLUMN exp_level INTEGER;
ALTER TABLE member_snapshot_stats ADD COLUMN best_trophies INTEGER;
ALTER TABLE member_snapshot_stats ADD COLUMN best_versus_trophies INTEGER;

-- Enhance existing equipment_flags to include levels (no schema change, just data format)
```

---

## Ingestion Pipeline Changes

### Files to Update:
1. `web-next/src/lib/ingestion/persist-roster.ts` - Add field extraction logic
2. `web-next/src/lib/ingestion/staged-pipeline.ts` - Update `snapshotStats` mapping
3. `web-next/src/types/index.ts` - Add TypeScript interfaces

### Extraction Functions Needed:

```typescript
// Extract pet levels from player detail
function extractPetLevels(playerDetail: any): Record<string, number> {
  const pets = playerDetail?.pets || [];
  return pets.reduce((acc: any, pet: any) => {
    acc[pet.name] = pet.level;
    return acc;
  }, {});
}

// Count maxed troops
function countMaxedTroops(playerDetail: any): number {
  const troops = playerDetail?.troops || [];
  return troops.filter((t: any) => t.level === t.maxLevel && t.village === 'home').length;
}

// Count completed achievements (3-star)
function countCompletedAchievements(playerDetail: any): number {
  const achievements = playerDetail?.achievements || [];
  return achievements.filter((a: any) => a.stars === 3).length;
}
```

---

## Timeline Highlight Rules

### Auto-Generated Highlights:

| Event Type | Trigger | Message Template | Icon |
|------------|---------|------------------|------|
| Pet Maxed | `pet_levels[x] === maxLevel` | "🐾 Maxed {petName}!" | 🐾 |
| Equipment Maxed | `equipment_flags[x] === maxLevel` | "🛡️ Maxed {equipmentName}!" | 🛡️ |
| BH Upgrade | `builder_hall_level` increases | "🏗️ Upgraded Builder Hall to {level}" | 🏗️ |
| War Milestone | `war_stars % 100 === 0` | "⭐ Reached {count} war stars!" | ⭐ |
| Capital Hero | `capital_contributions >= 100000` | "💰 Contributed 100k+ capital gold!" | 💰 |
| XP Milestone | `exp_level % 50 === 0` | "📈 Reached level {level}!" | 📈 |
| Achievement | `achievement_count` increases | "🏆 Completed '{achievementName}'!" | 🏆 |
| Lab Master | `max_troop_count >= 20` | "⚔️ Maxed 20+ troops!" | ⚔️ |

---

## Backfill Strategy

### Approach:
1. **Replay Historical Snapshots**: Read `clan_snapshots.player_details` JSONB for each snapshot
2. **Extract New Fields**: Apply new extraction functions to historical data
3. **Update `member_snapshot_stats`**: Backfill rows with new columns

### Script Outline:
```typescript
// web-next/scripts/backfill-enriched-data.ts
async function backfillEnrichedData() {
  // 1. Fetch all clan_snapshots with player_details
  const snapshots = await supabase
    .from('clan_snapshots')
    .select('id, player_details, fetched_at')
    .order('fetched_at', { ascending: true });

  // 2. For each snapshot, extract new fields
  for (const snapshot of snapshots) {
    const updates = [];
    for (const [tag, detail] of Object.entries(snapshot.player_details)) {
      const enriched = {
        pet_levels: extractPetLevels(detail),
        builder_hall_level: detail.builderHallLevel,
        war_stars: detail.warStars,
        // ... all new fields
      };
      updates.push({ tag, ...enriched });
    }
    
    // 3. Update member_snapshot_stats
    await updateMemberStats(snapshot.id, updates);
  }
}
```

---

## Testing Plan

### 1. Unit Tests (`__tests__/ingestion/field-extraction.test.ts`)
- Test `extractPetLevels()` with mock player data
- Test `countMaxedTroops()` edge cases (no troops, all maxed)
- Test `countCompletedAchievements()` with partial completion

### 2. Integration Tests
- Fetch real player data from API
- Verify all new fields are extracted correctly
- Compare backfilled data vs. fresh ingestion

### 3. Regression Tests
- Load saved snapshot fixture (JSON file)
- Run ingestion pipeline
- Assert all expected fields are populated

---

## API Surface Changes

### New Endpoints:
- `GET /api/v2/player/[tag]/timeline` - Historical highlights with enriched data
- `GET /api/v2/player/[tag]/pets` - Pet progression over time
- `GET /api/v2/player/[tag]/war-stats` - War performance history

### Enhanced Endpoints:
- `GET /api/v2/player/[tag]` - Include `pets`, `builderBase`, `warStats` in response
- `GET /api/v2/player/[tag]/history` - Add charts for new metrics

---

## Documentation Deliverables

1. ✅ **This Document** - Field inventory and mapping
2. ⏳ **Migration Guide** - SQL scripts and rollback plan
3. ⏳ **API Documentation** - Updated endpoint specs
4. ⏳ **Developer Guide** - How to add new tracked fields

---

## Next Steps

1. ✅ **Phase 1: Field Inventory** (This document)
2. ⏳ **Phase 2: Schema Design** - Finalize SQL migrations
3. ⏳ **Phase 3: Ingestion Updates** - Modify persist logic
4. ⏳ **Phase 4: Backfill Script** - Historical data replay
5. ⏳ **Phase 5: API Enhancements** - Expose new data
6. ⏳ **Phase 6: Timeline Features** - Leverage enriched data
7. ⏳ **Phase 7: Testing** - Unit + integration tests
8. ⏳ **Phase 8: Documentation** - API specs and guides

---

## Questions for Review

1. **Pet Levels**: Store as JSONB `{"LASSI": 10}` or dedicated table `pet_snapshots`?
2. **Troops/Spells**: Store full list or aggregated counts? (Leaning toward aggregates for perf)
3. **Achievements**: Track all achievements or only completion counts?
4. **Backfill**: Run once manually or automate via cron?
5. **API Response Size**: Add all new fields to default player endpoint or separate routes?

---

**End of Phase 1 Field Inventory**

