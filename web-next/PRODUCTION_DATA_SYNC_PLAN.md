# Production Data Sync Plan

## 🚨 **Issue Identified**

**Problem:** Production Player Database shows incorrect names (e.g., "Oleschak" instead of "OLESCHAK") while localhost shows correct names.

**Root Cause:** 
- **Localhost:** Uses localStorage data (correct names)
- **Production:** Uses Supabase data (incorrect names from migration)

## 🔍 **Diagnosis Results**

### Localhost (Working Correctly):
- ✅ **22 player names** in localStorage
- ✅ **OLESCHAK** name is correct
- ✅ **OLESCHAK notes are present**
- ✅ **Warning notes working**

### Production (Issues):
- ❌ **Supabase tables may not exist** or have incorrect data
- ❌ **Names are sentence case** instead of proper case
- ❌ **Warning notes not working**

## 🛠️ **Solution Steps**

### Step 1: Create Supabase Tables in Production
Run this SQL in your Supabase SQL editor:

```sql
-- Migration script to set up Supabase tables for player data
-- Run this in your Supabase SQL editor

-- 1. Create player_notes table (if not exists)
CREATE TABLE IF NOT EXISTS public.player_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  note TEXT NOT NULL,
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT, -- user identifier
  UNIQUE(clan_tag, player_tag, created_at) -- Prevent exact duplicates
);

-- 2. Create player_warnings table
CREATE TABLE IF NOT EXISTS public.player_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  warning_note TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT, -- user identifier
  UNIQUE(clan_tag, player_tag) -- One active warning per player
);

-- 3. Create player_tenure_actions table
CREATE TABLE IF NOT EXISTS public.player_tenure_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
  reason TEXT,
  granted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT -- user identifier
);

-- 4. Create player_departure_actions table
CREATE TABLE IF NOT EXISTS public.player_departure_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_tag TEXT NOT NULL,
  player_tag TEXT NOT NULL,
  player_name TEXT,
  departure_type TEXT NOT NULL CHECK (departure_type IN ('voluntary', 'involuntary', 'inactive')),
  reason TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT -- user identifier
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_player_notes_clan_tag ON public.player_notes(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_notes_player_tag ON public.player_notes(player_tag);
CREATE INDEX IF NOT EXISTS idx_player_notes_created_at ON public.player_notes(created_at);

CREATE INDEX IF NOT EXISTS idx_player_warnings_clan_tag ON public.player_warnings(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_warnings_player_tag ON public.player_warnings(player_tag);
CREATE INDEX IF NOT EXISTS idx_player_warnings_is_active ON public.player_warnings(is_active);

CREATE INDEX IF NOT EXISTS idx_player_tenure_actions_clan_tag ON public.player_tenure_actions(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_tenure_actions_player_tag ON public.player_tenure_actions(player_tag);

CREATE INDEX IF NOT EXISTS idx_player_departure_actions_clan_tag ON public.player_departure_actions(clan_tag);
CREATE INDEX IF NOT EXISTS idx_player_departure_actions_player_tag ON public.player_departure_actions(player_tag);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.player_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_tenure_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_departure_actions ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies (allow all operations for now - adjust as needed)
CREATE POLICY "Allow all operations on player_notes" ON public.player_notes FOR ALL USING (true);
CREATE POLICY "Allow all operations on player_warnings" ON public.player_warnings FOR ALL USING (true);
CREATE POLICY "Allow all operations on player_tenure_actions" ON public.player_tenure_actions FOR ALL USING (true);
CREATE POLICY "Allow all operations on player_departure_actions" ON public.player_departure_actions FOR ALL USING (true);
```

### Step 2: Migrate Correct Data from Localhost to Supabase

Run this script in your browser console on localhost:

```javascript
// Migration script to move localStorage data to Supabase
(async () => {
  console.log('🚀 Starting localStorage to Supabase migration...');
  
  const clanTag = '#2PR8R8V8P';
  let successCount = 0;
  let errorCount = 0;
  
  // Get all localStorage keys
  const keys = Object.keys(localStorage);
  
  // Migrate player names
  console.log('\n📝 Migrating player names...');
  const nameKeys = keys.filter(key => key.startsWith('player_name_'));
  for (const key of nameKeys) {
    const playerTag = key.replace('player_name_', '');
    const playerName = localStorage.getItem(key);
    
    try {
      // Create a note with the player name to establish the player record
      const response = await fetch('/api/player-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clanTag,
          playerTag,
          playerName,
          note: `Player record created - Name: ${playerName}`,
          createdBy: 'Migration Script'
        })
      });
      
      if (response.ok) {
        console.log(`✅ Migrated name: ${playerTag} → ${playerName}`);
        successCount++;
      } else {
        console.error(`❌ Failed to migrate name: ${playerTag}`, await response.text());
        errorCount++;
      }
    } catch (error) {
      console.error(`❌ Error migrating name: ${playerTag}`, error);
      errorCount++;
    }
  }
  
  // Migrate player notes
  console.log('\n📝 Migrating player notes...');
  const noteKeys = keys.filter(key => key.startsWith('player_notes_'));
  for (const key of noteKeys) {
    const playerTag = key.replace('player_notes_', '');
    const playerName = localStorage.getItem(`player_name_${playerTag}`) || 'Unknown Player';
    
    try {
      const notesData = JSON.parse(localStorage.getItem(key) || '[]');
      
      for (const note of notesData) {
        const response = await fetch('/api/player-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clanTag,
            playerTag,
            playerName,
            note: note.note,
            customFields: note.customFields || {},
            createdBy: 'Migration Script'
          })
        });
        
        if (response.ok) {
          console.log(`✅ Migrated note: ${playerTag} - ${note.note.substring(0, 50)}...`);
          successCount++;
        } else {
          console.error(`❌ Failed to migrate note: ${playerTag}`, await response.text());
          errorCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error migrating notes: ${playerTag}`, error);
      errorCount++;
    }
  }
  
  // Migrate player warnings
  console.log('\n⚠️ Migrating player warnings...');
  const warningKeys = keys.filter(key => key.startsWith('player_warning_'));
  for (const key of warningKeys) {
    const playerTag = key.replace('player_warning_', '');
    const playerName = localStorage.getItem(`player_name_${playerTag}`) || 'Unknown Player';
    
    try {
      const warningData = JSON.parse(localStorage.getItem(key) || '{}');
      
      if (warningData.timestamp && warningData.warningNote) {
        const response = await fetch('/api/player-warnings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clanTag,
            playerTag,
            playerName,
            warningNote: warningData.warningNote,
            createdBy: 'Migration Script'
          })
        });
        
        if (response.ok) {
          console.log(`✅ Migrated warning: ${playerTag} - ${warningData.warningNote.substring(0, 50)}...`);
          successCount++;
        } else {
          console.error(`❌ Failed to migrate warning: ${playerTag}`, await response.text());
          errorCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error migrating warning: ${playerTag}`, error);
      errorCount++;
    }
  }
  
  console.log(`\n🏁 Migration complete!`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
})();
```

### Step 3: Verify Production Data

After migration, check production Player Database:
1. Names should show correctly (e.g., "OLESCHAK" not "Oleschak")
2. Warning notes should work
3. All historical data should be present

### Step 4: Test Warning Notes

Try adding a warning note in production - it should now work correctly.

## 🎯 **Expected Results**

After completing these steps:
- ✅ **Production and localhost should show identical data**
- ✅ **Player names should be correct** (proper case)
- ✅ **Warning notes should work** in production
- ✅ **All historical data preserved**

## 🔧 **Troubleshooting**

If issues persist:
1. Check Supabase environment variables in production
2. Verify tables were created successfully
3. Check browser console for API errors
4. Run the diagnostic script in production browser console
