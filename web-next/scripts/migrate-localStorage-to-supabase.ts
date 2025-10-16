#!/usr/bin/env tsx

/**
 * Migration script to move player data from localStorage to Supabase
 * Run this script to migrate existing player notes, warnings, and actions
 */

import { getSupabaseAdminClient } from '../src/lib/supabase-admin';
import { cfg } from '../src/lib/config';

interface LocalStorageNote {
  timestamp: string;
  note: string;
  customFields: Record<string, string>;
}

interface LocalStorageWarning {
  timestamp: string;
  warningNote: string;
  isActive: boolean;
}

interface LocalStorageTenureAction {
  timestamp: string;
  action: 'granted' | 'revoked';
  reason?: string;
  grantedBy?: string;
}

interface LocalStorageDepartureAction {
  timestamp: string;
  reason: string;
  type: 'voluntary' | 'involuntary' | 'inactive';
  recordedBy?: string;
}

async function migratePlayerData() {
  console.log('🚀 Starting migration of player data from localStorage to Supabase...');
  
  const supabase = getSupabaseAdminClient();
  const clanTag = cfg.homeClanTag;
  
  if (!clanTag) {
    console.error('❌ No clan tag configured');
    return;
  }
  
  console.log(`📋 Migrating data for clan: ${clanTag}`);
  
  // Get all localStorage keys
  const allKeys = Object.keys(localStorage);
  const noteKeys = allKeys.filter(key => key.startsWith('player_notes_'));
  const warningKeys = allKeys.filter(key => key.startsWith('player_warning_'));
  const tenureKeys = allKeys.filter(key => key.startsWith('player_tenure_'));
  const departureKeys = allKeys.filter(key => key.startsWith('player_departure_'));
  
  console.log(`📝 Found ${noteKeys.length} note entries`);
  console.log(`⚠️  Found ${warningKeys.length} warning entries`);
  console.log(`🏆 Found ${tenureKeys.length} tenure action entries`);
  console.log(`👋 Found ${departureKeys.length} departure action entries`);
  
  let migratedNotes = 0;
  let migratedWarnings = 0;
  let migratedTenureActions = 0;
  let migratedDepartureActions = 0;
  
  // Migrate notes
  for (const key of noteKeys) {
    try {
      const playerTag = key.replace('player_notes_', '');
      const notesData = localStorage.getItem(key);
      
      if (!notesData) continue;
      
      const notes: LocalStorageNote[] = JSON.parse(notesData);
      const playerName = localStorage.getItem(`player_name_${playerTag}`) || 'Unknown Player';
      
      for (const note of notes) {
        const { data, error } = await supabase
          .from('player_notes')
          .insert({
            clan_tag: clanTag,
            player_tag: playerTag,
            player_name: playerName,
            note: note.note,
            custom_fields: note.customFields || {},
            created_at: note.timestamp,
            created_by: 'Migration Script'
          });
        
        if (error) {
          console.error(`❌ Error migrating note for ${playerTag}:`, error);
        } else {
          migratedNotes++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing notes for ${key}:`, error);
    }
  }
  
  // Migrate warnings
  for (const key of warningKeys) {
    try {
      const playerTag = key.replace('player_warning_', '');
      const warningData = localStorage.getItem(key);
      
      if (!warningData) continue;
      
      const warning: LocalStorageWarning = JSON.parse(warningData);
      const playerName = localStorage.getItem(`player_name_${playerTag}`) || 'Unknown Player';
      
      if (warning.isActive) {
        const { data, error } = await supabase
          .from('player_warnings')
          .insert({
            clan_tag: clanTag,
            player_tag: playerTag,
            player_name: playerName,
            warning_note: warning.warningNote,
            is_active: true,
            created_at: warning.timestamp,
            created_by: 'Migration Script'
          });
        
        if (error) {
          console.error(`❌ Error migrating warning for ${playerTag}:`, error);
        } else {
          migratedWarnings++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing warning for ${key}:`, error);
    }
  }
  
  // Migrate tenure actions
  for (const key of tenureKeys) {
    try {
      const playerTag = key.replace('player_tenure_', '');
      const tenureData = localStorage.getItem(key);
      
      if (!tenureData) continue;
      
      const tenureActions: LocalStorageTenureAction[] = JSON.parse(tenureData);
      const playerName = localStorage.getItem(`player_name_${playerTag}`) || 'Unknown Player';
      
      for (const action of tenureActions) {
        const { data, error } = await supabase
          .from('player_tenure_actions')
          .insert({
            clan_tag: clanTag,
            player_tag: playerTag,
            player_name: playerName,
            action: action.action,
            reason: action.reason,
            granted_by: action.grantedBy,
            created_at: action.timestamp,
            created_by: 'Migration Script'
          });
        
        if (error) {
          console.error(`❌ Error migrating tenure action for ${playerTag}:`, error);
        } else {
          migratedTenureActions++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing tenure actions for ${key}:`, error);
    }
  }
  
  // Migrate departure actions
  for (const key of departureKeys) {
    try {
      const playerTag = key.replace('player_departure_', '');
      const departureData = localStorage.getItem(key);
      
      if (!departureData) continue;
      
      const departureActions: LocalStorageDepartureAction[] = JSON.parse(departureData);
      const playerName = localStorage.getItem(`player_name_${playerTag}`) || 'Unknown Player';
      
      for (const action of departureActions) {
        const { data, error } = await supabase
          .from('player_departure_actions')
          .insert({
            clan_tag: clanTag,
            player_tag: playerTag,
            player_name: playerName,
            reason: action.reason,
            departure_type: action.type,
            recorded_by: action.recordedBy,
            created_at: action.timestamp,
            created_by: 'Migration Script'
          });
        
        if (error) {
          console.error(`❌ Error migrating departure action for ${playerTag}:`, error);
        } else {
          migratedDepartureActions++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing departure actions for ${key}:`, error);
    }
  }
  
  console.log('\n✅ Migration completed!');
  console.log(`📝 Migrated ${migratedNotes} notes`);
  console.log(`⚠️  Migrated ${migratedWarnings} warnings`);
  console.log(`🏆 Migrated ${migratedTenureActions} tenure actions`);
  console.log(`👋 Migrated ${migratedDepartureActions} departure actions`);
  
  console.log('\n🔄 Next steps:');
  console.log('1. Update Player Database to use Supabase APIs instead of localStorage');
  console.log('2. Test the new functionality');
  console.log('3. Consider backing up localStorage data before removing it');
}

// Run the migration
if (typeof window !== 'undefined') {
  // Browser environment
  migratePlayerData().catch(console.error);
} else {
  // Node environment
  migratePlayerData().catch(console.error);
}
