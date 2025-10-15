# Data Enrichment: Progress Report

## 🎯 Project Goal

Expose additional Clash API data (pets, troops, achievements, war stats, builder base, etc.) historically per player for timeline highlights and analytics dashboards.

---

## ✅ Completed (Phases 1-2)

### Phase 1: Field Inventory ✅
**Document**: `DATA_ENRICHMENT_FIELD_INVENTORY.md`

- ✅ Inventoried all available Clash API fields in `playerDetails`
- ✅ Categorized fields by priority (HIGH/MEDIUM/LOW)
- ✅ Defined storage strategies (JSONB vs dedicated columns vs aggregates)
- ✅ Documented timeline highlight rules
- ✅ Mapped data types and example values

**Key Decisions**:
- **Pets**: Store as JSONB `pet_levels: {"L.A.S.S.I": 10}`
- **Troops/Spells**: Store aggregated counts (not full lists) for performance
- **Achievements**: Store completion count + score (not individual achievements)
- **Equipment**: Enhance existing `equipment_flags` with level tracking

---

### Phase 2: Schema Design ✅
**File**: `supabase/migrations/20250115_data_enrichment_schema.sql`

Added **17 new columns** to `member_snapshot_stats`:

| Column | Type | Purpose |
|--------|------|---------|
| `pet_levels` | JSONB | Pet name → level mapping |
| `builder_hall_level` | INTEGER | Builder Hall level (1-10) |
| `versus_trophies` | INTEGER | Builder Base trophies |
| `versus_battle_wins` | INTEGER | Versus battle win count |
| `builder_league_id` | INTEGER | Builder Base league ID |
| `war_stars` | INTEGER | Total war stars earned |
| `attack_wins` | INTEGER | Multiplayer attack wins |
| `defense_wins` | INTEGER | Defense wins |
| `capital_contributions` | INTEGER | Capital gold contributed |
| `max_troop_count` | INTEGER | Number of maxed troops |
| `max_spell_count` | INTEGER | Number of maxed spells |
| `super_troops_active` | TEXT[] | Active super troop names |
| `achievement_count` | INTEGER | 3-star achievements |
| `achievement_score` | INTEGER | Total achievement stars |
| `exp_level` | INTEGER | Player experience level |
| `best_trophies` | INTEGER | All-time trophy high |
| `best_versus_trophies` | INTEGER | BH trophy high |

**Indexes Added**: 8 new indexes for performance on most-queried columns

**Migration Features**:
- ✅ Idempotent (safe to run multiple times)
- ✅ Non-breaking (adds columns, doesn't modify existing)
- ✅ Rollback script included
- ✅ Verification queries included

---

### Phase 2.5: Field Extractors ✅
**File**: `web-next/src/lib/ingestion/field-extractors.ts`

Created utility functions to extract enriched fields from CoC API `playerDetails`:

```typescript
extractPetLevels(playerDetail)           // → {"L.A.S.S.I": 10}
countMaxedTroops(playerDetail)           // → 15
countMaxedSpells(playerDetail)           // → 8
getActiveSuperTroops(playerDetail)       // → ["Super Barbarian"]
extractEquipmentLevels(playerDetail)     // → {"Barbarian Puppet": 18}
countCompletedAchievements(playerDetail) // → 42
calculateAchievementScore(playerDetail)  // → 120
extractBuilderBaseMetrics(playerDetail)  // → {builderHallLevel, versusTrophies, ...}
extractWarStats(playerDetail)            // → {warStars, attackWins, ...}
extractExperienceMetrics(playerDetail)   // → {expLevel, bestTrophies, ...}
extractEnrichedFields(playerDetail)      // → All fields combined
```

**Integrated**: Imported into `staged-pipeline.ts` ✅

---

## 🚧 In Progress (Phase 3)

### Wire Up Field Extractors in Ingestion Pipeline
**File**: `web-next/src/lib/ingestion/staged-pipeline.ts`

**Status**: Import added ✅, need to wire into `snapshotStats` mapping

**Next Step**: Update the `return` statement around line 776-800 to include:
```typescript
return {
  snapshot_id: latestSnapshot.id,
  member_id: memberId,
  snapshot_date: snapshot.fetchedAt,
  th_level: member.townHallLevel,
  role: member.role,
  trophies: member.trophies ?? 0,
  // ... existing fields ...
  
  // 🆕 ADD ENRICHED FIELDS HERE
  ...extractEnrichedFields(detail), // detail = snapshot.playerDetails[member.tag]
};
```

**Challenge**: Need to pass `playerDetail` into the mapping function (currently only `member` is available)

---

## ⏳ Remaining Work (Phases 4-8)

### Phase 4: Backfill Historical Data
**File**: Create `web-next/scripts/backfill-enriched-data.ts`

**Approach**:
1. Fetch all `clan_snapshots` with `player_details` JSONB
2. For each snapshot, extract enriched fields from `playerDetails`
3. Update corresponding `member_snapshot_stats` rows

**Estimated Complexity**: Medium (replay logic similar to existing migrations)

---

### Phase 5: Extend Player APIs
**Files to Update**:
- `web-next/src/app/api/v2/player/[tag]/route.ts` - Include enriched fields in response
- `web-next/src/app/api/v2/player/[tag]/history/route.ts` - Add charts for new metrics

**New Endpoints**:
- `GET /api/v2/player/[tag]/timeline` - Historical highlights with enriched data
- `GET /api/v2/player/[tag]/pets` - Pet progression over time
- `GET /api/v2/player/[tag]/war-stats` - War performance history

---

### Phase 6: Timeline Highlights
**File**: Update `web-next/src/lib/timeline/highlights.ts` (or create if doesn't exist)

**Auto-Generated Highlights**:
- 🐾 "Maxed L.A.S.S.I!"
- 🛡️ "Maxed Barbarian Puppet!"
- 🏗️ "Upgraded Builder Hall to 10"
- ⭐ "Reached 500 war stars!"
- 💰 "Contributed 100k+ capital gold!"
- 📈 "Reached level 200!"
- 🏆 "Completed 'Gold Grab' achievement!"
- ⚔️ "Maxed 20+ troops!"

---

### Phase 7: Testing
**Files to Create**:
- `web-next/__tests__/ingestion/field-extractors.test.ts` - Unit tests
- `web-next/__tests__/ingestion/enriched-ingestion.test.ts` - Integration tests

**Test Coverage**:
- ✅ Extract pet levels from various API payloads
- ✅ Count maxed troops edge cases (no troops, all maxed)
- ✅ Handle missing/null player details gracefully
- ✅ Backfill script dry-run mode
- ✅ API endpoints return enriched data

---

### Phase 8: Documentation
**Files to Create/Update**:
- `docs/api/enriched-player-endpoints.md` - API specifications
- `docs/development/adding-tracked-fields.md` - Developer guide
- Update `README.md` with new features

---

## 📊 Overall Progress

| Phase | Status | Completion |
|-------|--------|------------|
| 1. Field Inventory | ✅ Complete | 100% |
| 2. Schema Design | ✅ Complete | 100% |
| 2.5. Field Extractors | ✅ Complete | 100% |
| 3. Pipeline Integration | 🚧 In Progress | 25% |
| 4. Backfill Script | ⏳ Not Started | 0% |
| 5. API Enhancements | ⏳ Not Started | 0% |
| 6. Timeline Features | ⏳ Not Started | 0% |
| 7. Testing | ⏳ Not Started | 0% |
| 8. Documentation | ⏳ Not Started | 0% |

**Overall**: ~35% Complete

---

## 🎯 Next Immediate Steps

1. **Complete Phase 3**: Wire up `extractEnrichedFields()` in `staged-pipeline.ts`
   - Locate the `snapshotStats` mapping (around line 776)
   - Spread enriched fields into return object
   - Test with a fresh ingestion

2. **Run Schema Migration**: Apply `20250115_data_enrichment_schema.sql` in Supabase
   ```sql
   -- Run in Supabase SQL Editor
   -- File: supabase/migrations/20250115_data_enrichment_schema.sql
   ```

3. **Create Backfill Script**: Start with dry-run mode to preview changes

4. **Test Fresh Ingestion**: Run daily ingestion and verify new fields are populated

---

## 🐛 Known Issues & Considerations

1. **PlayerDetail Availability**: Not all snapshots have `playerDetails` (some failed fetches)
   - **Mitigation**: Backfill script should handle missing data gracefully

2. **Performance Impact**: 17 new columns + indexes
   - **Expected Impact**: Minimal (nullable columns, no backfill yet)
   - **Monitor**: Query performance after backfill

3. **API Field Stability**: Supercell may add/remove fields
   - **Mitigation**: Extractors use optional chaining (`?.`) and default to `null`

4. **Historical Accuracy**: Some fields are cumulative (war stars), others are snapshots (trophies)
   - **Document**: Clarify field semantics in API docs

---

## 📝 Files Changed

### Created
- `DATA_ENRICHMENT_FIELD_INVENTORY.md` - Comprehensive field inventory
- `supabase/migrations/20250115_data_enrichment_schema.sql` - Schema migration
- `web-next/src/lib/ingestion/field-extractors.ts` - Extraction utilities

### Modified
- `web-next/src/lib/ingestion/staged-pipeline.ts` - Added import

### Next to Create
- `web-next/scripts/backfill-enriched-data.ts`
- `web-next/__tests__/ingestion/field-extractors.test.ts`
- `docs/api/enriched-player-endpoints.md`

---

## 🚀 Deployment Plan

1. **Schema Migration**: Run in Supabase (staging first, then production)
2. **Code Deployment**: Deploy ingestion updates (Phase 3 complete)
3. **Backfill Execution**: Run backfill script manually (one-time)
4. **API Deployment**: Deploy API enhancements (Phase 5)
5. **UI Deployment**: Deploy timeline features (Phase 6)

**Estimated Timeline**: 
- Phase 3: 1-2 hours
- Phases 4-6: 4-6 hours
- Phases 7-8: 2-3 hours
- **Total**: 8-12 hours of dev work

---

## 💡 Future Enhancements (Post-Launch)

- **Machine Learning**: Predict player churn based on enriched metrics
- **Advanced Analytics**: War performance trends, donation ratios, hero upgrade velocity
- **Clan Comparisons**: Benchmark against top clans using aggregated stats
- **Player Archetypes**: Classify players (Farmer, Warrior, Builder, etc.) based on metrics
- **Achievement Tracker**: Individual achievement progress over time

---

**Last Updated**: October 12, 2025  
**Maintained By**: Clash Intelligence Team  
**Status**: Active Development 🚧

