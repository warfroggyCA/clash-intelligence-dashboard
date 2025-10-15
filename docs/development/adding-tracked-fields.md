# Developer Guide: Adding New Tracked Fields

## Overview

This guide explains how to add new fields to the historical tracking system when new Clash of Clans API data becomes available or when you want to track additional metrics.

**Last Updated**: October 12, 2025

---

## The Process (7 Steps)

### 1️⃣ Identify the Field Source

**Where does the data come from?**
- Clash of Clans API `/players/{tag}` endpoint
- Calculated/derived from existing data
- Third-party source

**Example:**
```typescript
// Source: CoC API player response
{
  "tag": "#G9QVRYC2Y",
  "name": "warfroggy",
  "pets": [
    {
      "name": "L.A.S.S.I",
      "level": 10,
      "maxLevel": 15,
      "village": "home"
    }
  ]
}
```

---

### 2️⃣ Design the Schema

**Decision Tree:**

```
Is it a complex nested structure?
├─ YES → Use JSONB column (e.g., pet_levels)
└─ NO  → Use typed column (e.g., INTEGER, TEXT[])

Is it queried frequently?
├─ YES → Add index
└─ NO  → No index needed

Is it cumulative or snapshot?
├─ CUMULATIVE → Document as "always increasing"
└─ SNAPSHOT   → Document as "point-in-time value"
```

**Example Schema:**
```sql
-- JSONB for complex nested data
ALTER TABLE member_snapshot_stats
  ADD COLUMN pet_levels JSONB DEFAULT NULL;

-- Typed column for simple metrics
ALTER TABLE member_snapshot_stats
  ADD COLUMN builder_hall_level INTEGER DEFAULT NULL;

-- Index for frequently queried fields
CREATE INDEX member_snapshot_stats_builder_hall_level_idx
  ON member_snapshot_stats (builder_hall_level);
```

---

### 3️⃣ Create Migration File

**File**: `supabase/migrations/YYYYMMDD_description.sql`

```sql
-- Migration: Add [field name] tracking
-- Date: October 12, 2025
-- 
-- This migration adds:
-- - [field_name] column to member_snapshot_stats
-- - Index for query performance
-- - Comments for documentation

BEGIN;

ALTER TABLE public.member_snapshot_stats
  ADD COLUMN IF NOT EXISTS field_name TYPE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS member_snapshot_stats_field_name_idx
  ON public.member_snapshot_stats (field_name);

COMMENT ON COLUMN public.member_snapshot_stats.field_name IS
  'Description of what this field represents and example values';

COMMIT;

-- ROLLBACK SCRIPT (for reference)
/*
BEGIN;
DROP INDEX IF EXISTS member_snapshot_stats_field_name_idx;
ALTER TABLE member_snapshot_stats DROP COLUMN IF EXISTS field_name;
COMMIT;
*/
```

**Apply in Supabase:**
- Copy migration SQL to Supabase SQL Editor
- Execute
- Verify with: `\d+ member_snapshot_stats`

---

### 4️⃣ Add Extraction Function

**File**: `web-next/src/lib/ingestion/field-extractors.ts`

```typescript
/**
 * Extract [field description]
 * @param playerDetail Full player object from CoC API
 * @returns [return type and description]
 */
export function extractFieldName(playerDetail: any): ReturnType {
  // Handle missing data gracefully
  if (!playerDetail?.sourceField) return null;
  
  // Extract and transform
  const value = playerDetail.sourceField;
  
  // Apply any business logic
  const transformed = transform(value);
  
  return transformed;
}
```

**Example:**
```typescript
export function extractPetLevels(playerDetail: any): Record<string, number> | null {
  const pets = playerDetail?.pets || [];
  if (pets.length === 0) return null;

  return pets.reduce((acc: Record<string, number>, pet: any) => {
    if (pet.name && typeof pet.level === 'number') {
      acc[pet.name] = pet.level;
    }
    return acc;
  }, {});
}
```

---

### 5️⃣ Update extractEnrichedFields()

**File**: `web-next/src/lib/ingestion/field-extractors.ts`

Add your new field to the main extraction function:

```typescript
export function extractEnrichedFields(playerDetail: any) {
  if (!playerDetail) {
    return {
      // ... existing fields
      fieldName: null, // Add your new field
    };
  }

  return {
    // ... existing fields
    fieldName: extractFieldName(playerDetail), // Add extraction
  };
}
```

---

### 6️⃣ Update TypeScript Interfaces

**File**: `web-next/src/lib/ingestion/staged-pipeline.ts`

```typescript
interface SnapshotStats {
  // ... existing fields
  field_name?: ReturnType | null; // Add your new field
}
```

**File**: `web-next/src/app/api/v2/player/[tag]/route.ts`

```typescript
interface RawSnapshotRow {
  // ... existing fields
  field_name?: ReturnType | null; // Add your new field
}
```

---

### 7️⃣ Map in Ingestion Pipeline

**File**: `web-next/src/lib/ingestion/staged-pipeline.ts`

In the `snapshotStats` mapping (around line 800):

```typescript
const snapshotStats = transformedData.memberData.map((member) => {
  // ... existing code
  const enriched = extractEnrichedFields(detail);

  return {
    // ... existing fields
    field_name: enriched.fieldName, // Add mapping
  };
});
```

---

## Testing Checklist

After adding a new field, verify:

- [ ] Migration runs without errors
- [ ] Column appears in `member_snapshot_stats` table
- [ ] Index created successfully
- [ ] Extraction function handles null/missing data
- [ ] TypeScript interfaces updated (no lint errors)
- [ ] Fresh ingestion populates the field
- [ ] API response includes the field
- [ ] Backfill script works with the field

---

## Real-World Example: Adding "Clan Games Points"

Let's say Supercell adds a new field `clanGamesPoints` to the player API.

### Step 1: Identify Source
```json
{
  "tag": "#G9QVRYC2Y",
  "name": "warfroggy",
  "clanGamesPoints": 4000  // ← NEW FIELD
}
```

### Step 2: Design Schema
- **Type**: INTEGER (simple cumulative metric)
- **Index**: Yes (will be queried for leaderboards)
- **Semantic**: Cumulative (lifetime total)

### Step 3: Create Migration
```sql
-- supabase/migrations/20251015_add_clan_games_points.sql
BEGIN;

ALTER TABLE public.member_snapshot_stats
  ADD COLUMN IF NOT EXISTS clan_games_points INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS member_snapshot_stats_clan_games_points_idx
  ON public.member_snapshot_stats (clan_games_points);

COMMENT ON COLUMN public.member_snapshot_stats.clan_games_points IS
  'Lifetime clan games points earned';

COMMIT;
```

### Step 4: Add Extractor
```typescript
// web-next/src/lib/ingestion/field-extractors.ts

export function extractClanGamesPoints(playerDetail: any): number | null {
  return playerDetail?.clanGamesPoints ?? null;
}
```

### Step 5: Update extractEnrichedFields()
```typescript
export function extractEnrichedFields(playerDetail: any) {
  if (!playerDetail) {
    return {
      // ... existing
      clanGamesPoints: null,
    };
  }

  return {
    // ... existing
    clanGamesPoints: extractClanGamesPoints(playerDetail),
  };
}
```

### Step 6: Update Interfaces
```typescript
// staged-pipeline.ts
interface SnapshotStats {
  // ... existing
  clan_games_points?: number | null;
}

// api/v2/player/[tag]/route.ts
interface RawSnapshotRow {
  // ... existing
  clan_games_points?: number | null;
}
```

### Step 7: Map in Pipeline
```typescript
// staged-pipeline.ts (line ~840)
return {
  // ... existing
  clan_games_points: enriched.clanGamesPoints,
};
```

### Step 8: Update API Response
```typescript
// api/v2/player/[tag]/route.ts
enriched: {
  // ... existing
  clanGamesPoints: primaryStats?.clan_games_points ?? null,
}
```

### Step 9: Run Backfill
```bash
npm run backfill-enriched-data -- --execute
```

**Done!** The new field is now tracked historically. ✅

---

## Best Practices

### 1. Always Default to NULL
```sql
-- ✅ GOOD
ADD COLUMN field_name TYPE DEFAULT NULL;

-- ❌ BAD (non-null requires backfill or default value)
ADD COLUMN field_name TYPE NOT NULL DEFAULT 0;
```

### 2. Document Field Semantics
```sql
COMMENT ON COLUMN table.field IS 
  'Clear description. Example values: 1, 5, 10. Semantic: snapshot/cumulative';
```

### 3. Use Optional Chaining
```typescript
// ✅ GOOD
const value = playerDetail?.nested?.field ?? null;

// ❌ BAD
const value = playerDetail.nested.field; // Crash if null!
```

### 4. Handle Array Fields Safely
```typescript
// ✅ GOOD
const troops = playerDetail?.troops || [];
return troops.filter(...).map(...);

// ❌ BAD
return playerDetail.troops.filter(...); // Crash if null!
```

### 5. Test with Missing Data
```typescript
// Always test extractors with:
extractFieldName(null)           // → should return null
extractFieldName({})             // → should return null
extractFieldName({ field: 0 })   // → should handle 0 correctly
```

---

## Troubleshooting

### "Column does not exist" Error

**Problem**: Migration wasn't applied to Supabase.

**Solution**:
1. Check Supabase SQL Editor history
2. Re-run migration if needed
3. Verify with `\d+ member_snapshot_stats`

### TypeScript Error: "Property does not exist"

**Problem**: Interface not updated.

**Solution**:
1. Update `SnapshotStats` in `staged-pipeline.ts`
2. Update `RawSnapshotRow` in `api/v2/player/[tag]/route.ts`
3. Restart TypeScript server

### Ingestion Fails After Adding Field

**Problem**: Extractor is throwing errors.

**Solution**:
1. Add null checks in extractor function
2. Test extractor in isolation
3. Check ingestion job logs for specific error

### Backfill Shows 0 Rows Updated

**Problem**: `player_details` is null in `clan_snapshots`.

**Solution**:
- Historical snapshots may not have `player_details`
- Only snapshots after Sept 2025 have full player details
- Accept that some historical data will be incomplete

---

**End of Developer Guide**

