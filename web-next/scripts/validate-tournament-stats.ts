#!/usr/bin/env tsx
/**
 * Validation Script: Check if tournament stats are available from the API
 * 
 * This script:
 * 1. Fetches a recent player detail from the API
 * 2. Checks if tournamentStats field exists
 * 3. Reports what fields are available
 * 
 * Usage:
 *   tsx scripts/validate-tournament-stats.ts [playerTag]
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local explicitly
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getPlayer } from '../src/lib/coc';
import { normalizeTag } from '../src/lib/tags';

async function main() {
  // Use a known player tag from the clan, or use the first argument
  const playerTagArg = process.argv[2];
  
  if (!playerTagArg) {
    console.error('Usage: tsx scripts/validate-tournament-stats.ts <playerTag>\n');
    console.error('Example: tsx scripts/validate-tournament-stats.ts #VGQVRLRL');
    process.exit(1);
  }

  const normalizedTag = normalizeTag(playerTagArg);
  if (!normalizedTag) {
    console.error(`Invalid player tag format: ${playerTagArg}`);
    process.exit(1);
  }

  console.log(`Fetching player details for: ${normalizedTag}\n`);

  try {
    const playerDetail = await getPlayer(normalizedTag);
    
    console.log('✅ Player detail fetched successfully\n');
    console.log('Checking for tournament-related fields...\n');
    
    // Check for tournamentStats
    const hasTournamentStats = playerDetail?.tournamentStats != null;
    console.log(`tournamentStats: ${hasTournamentStats ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (hasTournamentStats) {
      console.log('  Structure:', JSON.stringify(playerDetail.tournamentStats, null, 2));
    }
    
    // Check for leagueTier (related to ranked mode)
    const hasLeagueTier = playerDetail?.leagueTier != null;
    console.log(`\nleagueTier: ${hasLeagueTier ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (hasLeagueTier) {
      console.log('  Structure:', JSON.stringify(playerDetail.leagueTier, null, 2));
    }
    
    // Check for league (traditional league)
    const hasLeague = playerDetail?.league != null;
    console.log(`\nleague: ${hasLeague ? '✅ FOUND' : '❌ NOT FOUND'}`);
    if (hasLeague) {
      console.log('  Structure:', JSON.stringify(playerDetail.league, null, 2));
    }
    
    // Check for trophies
    const trophies = playerDetail?.trophies;
    console.log(`\ntrophies: ${trophies != null ? `✅ ${trophies}` : '❌ NOT FOUND'}`);
    
    // List all top-level keys
    console.log('\n\nAll top-level keys in player detail:');
    const keys = Object.keys(playerDetail || {});
    keys.sort().forEach(key => {
      const value = playerDetail[key];
      const type = Array.isArray(value) ? 'array' : typeof value;
      const preview = typeof value === 'object' && value !== null 
        ? `{${Object.keys(value).length} keys}` 
        : String(value).substring(0, 50);
      console.log(`  - ${key}: ${type} ${preview}`);
    });
    
    // Check if tournamentStats might be nested elsewhere
    console.log('\n\nSearching for "tournament" or "ranked" in nested objects...');
    function searchForTournament(obj: any, path: string = ''): void {
      if (!obj || typeof obj !== 'object') return;
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (key.toLowerCase().includes('tournament') || key.toLowerCase().includes('ranked')) {
          console.log(`  ✅ Found at: ${currentPath}`);
          console.log(`     Value:`, JSON.stringify(value, null, 2).substring(0, 200));
        }
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          searchForTournament(value, currentPath);
        }
      }
    }
    
    searchForTournament(playerDetail);
    
  } catch (error: any) {
    console.error(`❌ Error fetching player detail:`, error?.message || error);
    process.exit(1);
  }
}

main();

