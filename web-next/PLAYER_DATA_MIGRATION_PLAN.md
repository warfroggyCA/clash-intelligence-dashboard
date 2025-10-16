# Player Data Migration Plan: localStorage → Supabase

## Overview

Currently, the Player Database stores all player data (notes, warnings, tenure actions, departure actions) in browser localStorage. This approach has several limitations:

- **Data Loss Risk**: Data is lost if browser storage is cleared
- **No Multi-Device Access**: Data doesn't sync across devices
- **No Backup**: No automatic backup or recovery
- **Limited Scalability**: localStorage has size limits
- **No Collaboration**: Multiple users can't access the same data

## Solution: Migrate to Supabase

The Supabase schema already includes proper tables for player data. We need to:

1. **Set up Supabase tables** for player data
2. **Create API endpoints** for CRUD operations
3. **Migrate existing data** from localStorage
4. **Update Player Database** to use Supabase APIs
5. **Remove localStorage dependency**

## Migration Steps

### Step 1: Set up Supabase Tables

Run the SQL migration script:

```bash
# In Supabase SQL Editor
cat web-next/scripts/migrate-player-data-to-supabase.sql
```

This creates:
- `player_notes` - Store player notes with timestamps
- `player_warnings` - Store warning notes for returning players
- `player_tenure_actions` - Store tenure granted/revoked actions
- `player_departure_actions` - Store departure recordings

### Step 2: Create API Endpoints

New API endpoints created:
- `GET/POST/PUT/DELETE /api/player-notes` - Manage player notes
- `GET/POST/DELETE /api/player-warnings` - Manage player warnings
- `GET/POST /api/player-actions` - Manage tenure and departure actions

### Step 3: Migrate Existing Data

Run the migration script to move localStorage data to Supabase:

```bash
# In browser console or Node.js
tsx web-next/scripts/migrate-localStorage-to-supabase.ts
```

### Step 4: Update Player Database

Update `PlayerDatabasePage.tsx` to:
- Use Supabase APIs instead of localStorage
- Fetch data from `/api/player-notes`, `/api/player-warnings`, `/api/player-actions`
- Store new data via API calls
- Remove localStorage dependencies

### Step 5: Update Other Components

Update components that use localStorage for player data:
- `PlayerProfileModal.tsx`
- `CreatePlayerNoteModal.tsx`
- Any other components with player note functionality

## Benefits of Migration

### ✅ **Data Persistence**
- Data stored in PostgreSQL database
- Automatic backups and recovery
- No data loss from browser clearing

### ✅ **Multi-Device Access**
- Access player data from any device
- Real-time synchronization
- Consistent experience across platforms

### ✅ **Scalability**
- No localStorage size limits
- Proper indexing for fast queries
- Support for large amounts of data

### ✅ **Collaboration**
- Multiple users can access same data
- Proper user attribution (created_by fields)
- Audit trail of all changes

### ✅ **Advanced Features**
- Full-text search capabilities
- Complex queries and filtering
- Data analytics and reporting
- Integration with other Supabase features

## Database Schema

### player_notes
```sql
- id (UUID, Primary Key)
- clan_tag (TEXT, NOT NULL)
- player_tag (TEXT, NOT NULL)
- player_name (TEXT)
- note (TEXT, NOT NULL)
- custom_fields (JSONB)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
- created_by (TEXT)
```

### player_warnings
```sql
- id (UUID, Primary Key)
- clan_tag (TEXT, NOT NULL)
- player_tag (TEXT, NOT NULL)
- player_name (TEXT)
- warning_note (TEXT, NOT NULL)
- is_active (BOOLEAN)
- created_at (TIMESTAMPTZ)
- updated_at (TIMESTAMPTZ)
- created_by (TEXT)
```

### player_tenure_actions
```sql
- id (UUID, Primary Key)
- clan_tag (TEXT, NOT NULL)
- player_tag (TEXT, NOT NULL)
- player_name (TEXT)
- action (TEXT: 'granted' | 'revoked')
- reason (TEXT)
- granted_by (TEXT)
- created_at (TIMESTAMPTZ)
- created_by (TEXT)
```

### player_departure_actions
```sql
- id (UUID, Primary Key)
- clan_tag (TEXT, NOT NULL)
- player_tag (TEXT, NOT NULL)
- player_name (TEXT)
- reason (TEXT, NOT NULL)
- departure_type (TEXT: 'voluntary' | 'involuntary' | 'inactive')
- recorded_by (TEXT)
- created_at (TIMESTAMPTZ)
- created_by (TEXT)
```

## Implementation Priority

1. **High Priority**: Set up Supabase tables and API endpoints
2. **High Priority**: Migrate existing localStorage data
3. **High Priority**: Update Player Database to use Supabase
4. **Medium Priority**: Update other components
5. **Low Priority**: Remove localStorage fallbacks

## Testing Strategy

1. **Data Migration Testing**: Verify all localStorage data migrates correctly
2. **API Testing**: Test all CRUD operations work properly
3. **UI Testing**: Ensure Player Database functions normally
4. **Performance Testing**: Verify Supabase queries are fast
5. **Backup Testing**: Test data recovery scenarios

## Rollback Plan

If issues arise:
1. Keep localStorage as fallback during transition
2. Add feature flag to switch between localStorage and Supabase
3. Maintain data synchronization between both systems
4. Have migration rollback script ready

## Timeline

- **Day 1**: Set up Supabase tables and API endpoints
- **Day 2**: Create migration script and test data migration
- **Day 3**: Update Player Database to use Supabase APIs
- **Day 4**: Update other components and test integration
- **Day 5**: Remove localStorage dependencies and cleanup

This migration will transform the Player Database from a client-side only solution to a robust, scalable, multi-user system that aligns with the overall Supabase architecture.
