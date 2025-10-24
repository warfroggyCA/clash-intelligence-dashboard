# Player Day Implementation Summary

## ✅ Completed

### 1. Database Schema
- **Migration**: `supabase/migrations/20251018_create_player_day_table.sql`
- **Update**: `supabase/migrations/20250217_add_player_day_builder_war_columns.sql`
- **Table**: `player_day` with comprehensive player state tracking
- **Features**:
  - Core player stats (TH, league, trophies, donations, etc.)
  - War & builder snapshots (attack wins, defense wins, builder hall level, builder wins, builder trophies)
  - Enrichment fields (hero levels, equipment, pets, super troops, achievements)
  - Delta tracking (trophies, donations, war stars, capital contributions)
  - Event categorization (upgrades, league changes, activity milestones)
  - Notability scoring for timeline markers
  - Snapshot hash for duplicate detection
  - RLS policies and updated_at triggers

### 2. Data Processing Logic
- **File**: `web-next/src/lib/player-day.ts`
- **Function**: `generatePlayerDayRow(prev, curr)`
- **Features**:
  - Delta calculation between consecutive snapshots
  - Event detection and categorization
  - Notability scoring based on event categories
  - Snapshot hash generation for deduplication
  - Comprehensive state tracking

### 3. Ingestion Integration
- **File**: `web-next/src/lib/ingestion/persist-roster.ts`
- **Integration**: Wired into `persistRosterSnapshotToDataSpine()`
- **Process**:
  - Builds canonical player states from snapshot data
  - Fetches previous day's state for delta calculation
    - Generates player day rows with deltas and events
  - Upserts to player_day table with conflict resolution
  - Skips only repeat writes for the same date/snapshot hash so quiet days are still recorded

### 4. Backfill Infrastructure
- **Helper**: `backfillPlayerDay()` in `web-next/src/lib/ingestion/player-day-backfill.ts`
- **Script**: `web-next/scripts/backfill-player-day.ts`
- **Command**: `npm run backfill:player-day`
- **Features**:
  - Processes historical canonical snapshots (per-player chronological order)
  - Reuses shared helper for CLI, cron, or manual triggers
  - Skips duplicate entries for the same date while preserving daily ledger
  - Progress callbacks for logging and monitoring

## 🔄 Next Steps

### 1. Run Backfill (When Environment Ready)
```bash
cd web-next
npm run backfill:player-day
```

### 2. Verify Data Population
- Check player_day table row counts
- Verify delta calculations are correct
- Confirm event categorization works
- Test notability scoring

### 2a. Nightly Refresh Expectations
- Each nightly ingestion now writes a `player_day` row per player even on quiet days
- Validate with: `select player_tag, date from player_day order by player_tag, date desc limit 20;`
- Spot-check donors with no changes to ensure dates progress daily

### 3. UI/API Migration
- Update player profile pages to use player_day data
- Modify timeline components to use events and notability
- Switch analytics to use daily ledger
- Update API endpoints to serve player_day data

### 4. Performance Optimization
- Add indexes for common query patterns
- Optimize timeline queries
- Consider partitioning by date for large datasets

## 📊 Data Structure

### Player Day Row
```typescript
{
  player_tag: string;
  clan_tag: string;
  date: string;
  // Core stats
  th: number | null;
  league: string | null;
  trophies: number | null;
  donations: number | null;
  donations_rcv: number | null;
  war_stars: number | null;
  attack_wins: number | null;
  defense_wins: number | null;
  builder_hall_level: number | null;
  builder_battle_wins: number | null;
  builder_trophies: number | null;
  capital_contrib: number | null;
  legend_attacks: number | null;
  // Enrichment
  hero_levels: HeroLevels | null;
  equipment_levels: Record<string, number> | null;
  pets: Record<string, number> | null;
  super_troops_active: string[] | null;
  achievements: { count: number; score: number } | null;
  rush_percent: number | null;
  exp_level: number | null;
  // Timeline features
  deltas: Record<string, number>;
  events: string[];
  notability: number;
  snapshot_hash: string;
}
```

### Event Categories
- `upgrade`: TH level up, hero level up, pet level up, equipment upgrade
- `league`: League change, legend reentry
- `trophies`: Big trophy deltas
- `war`: War performance day
- `capital`: Capital activity
- `donations`: Donation thresholds
- `activity`: Legend activity

## 🎯 Benefits

1. **Timeline Scrubbing**: Events and notability enable rich timeline navigation
2. **Delta Tracking**: Precise change detection between snapshots
3. **Performance**: Dedicated table optimized for timeline queries
4. **Deduplication**: Hash-based duplicate detection prevents data bloat
5. **Historical Analysis**: Complete player progression tracking
6. **Event Categorization**: Structured event system for UI features

## 🔧 Technical Notes

- **Conflict Resolution**: Uses `player_tag,date` primary key with upsert
- **Deduplication**: Skips re-writing identical rows for the same date while retaining quiet-day entries
- **Error Handling**: Graceful handling of missing previous states
- **Performance**: Indexed on `clan_tag,date` and `player_tag,date`
- **Security**: RLS policies for service role and authenticated access
