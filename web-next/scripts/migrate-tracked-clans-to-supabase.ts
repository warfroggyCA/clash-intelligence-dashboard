/**
 * One-time migration script to migrate tracked clans from local JSON file to Supabase
 * Run this once after deploying the migration: npx tsx scripts/migrate-tracked-clans-to-supabase.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local explicitly (dotenv/config may not load .env.local by default)
const envPath = resolve(process.cwd(), '.env.local');
config({ path: envPath });
// Also load regular .env if it exists
config();

import { promises as fs } from 'fs';
import { join } from 'path';
import { getSupabaseAdminClient } from '../src/lib/supabase-admin';
import { normalizeTag } from '../src/lib/tags';

interface TrackedClansConfig {
  clans: string[];
}

const CONFIG_PATH = join(process.cwd(), 'scripts', 'tracked-clans.json');

async function migrate() {
  console.log('🔄 Starting migration of tracked clans to Supabase...');
  
  // Read existing file
  let existingClans: string[] = [];
  try {
    const content = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config: TrackedClansConfig = JSON.parse(content);
    existingClans = config.clans || [];
    console.log(`📋 Found ${existingClans.length} clans in local file:`, existingClans);
  } catch (error) {
    console.log('⚠️  No local file found or error reading it:', error);
    return;
  }

  if (existingClans.length === 0) {
    console.log('✅ No clans to migrate.');
    return;
  }

  const supabase = getSupabaseAdminClient();
  
  // Check what's already in Supabase
  const { data: existingInDb } = await supabase
    .from('tracked_clans')
    .select('clan_tag, is_active')
    .in('clan_tag', existingClans.map(normalizeTag));
  
  const existingTags = new Set((existingInDb || []).map(row => normalizeTag(row.clan_tag)));
  console.log(`📊 Found ${existingTags.size} clans already in database`);

  // Migrate each clan
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const clanTag of existingClans) {
    const normalizedTag = normalizeTag(clanTag);
    if (!normalizedTag) {
      console.warn(`⚠️  Skipping invalid tag: ${clanTag}`);
      skipped++;
      continue;
    }

    // Skip if already exists
    if (existingTags.has(normalizedTag)) {
      // Check if it's inactive and reactivate it
      const existing = existingInDb?.find(row => normalizeTag(row.clan_tag) === normalizedTag);
      if (existing && !existing.is_active) {
        const { error } = await supabase
          .from('tracked_clans')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('clan_tag', normalizedTag);
        
        if (error) {
          console.error(`❌ Failed to reactivate ${normalizedTag}:`, error);
          errors++;
        } else {
          console.log(`✅ Reactivated ${normalizedTag}`);
          migrated++;
        }
      } else {
        console.log(`⏭️  Skipping ${normalizedTag} (already active)`);
        skipped++;
      }
      continue;
    }

    // Insert new clan
    const { error } = await supabase
      .from('tracked_clans')
      .insert({
        clan_tag: normalizedTag,
        added_by: 'Migration Script',
        is_active: true,
      });

    if (error) {
      console.error(`❌ Failed to migrate ${normalizedTag}:`, error);
      errors++;
    } else {
      console.log(`✅ Migrated ${normalizedTag}`);
      migrated++;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log('\n🎉 Migration complete!');
}

// Run migration
migrate().catch(error => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});

