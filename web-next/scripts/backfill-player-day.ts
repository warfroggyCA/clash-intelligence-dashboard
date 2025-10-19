import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';

// Explicitly load .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });
import { getSupabaseServerClient } from '../src/lib/supabase-server';
import { generatePlayerDayRow, type CanonicalPlayerState } from '../src/lib/player-day';

interface CanonicalSnapshot {
  player_tag: string;
  clan_tag: string;
  snapshot_date: string;
  payload: any;
}

async function backfillPlayerDayData() {
  const supabase = getSupabaseServerClient();
  
  console.log('Starting player_day backfill...');
  
  // Get all canonical snapshots ordered by player and date
  const { data: snapshots, error: fetchError } = await supabase
    .from('canonical_member_snapshots')
    .select('player_tag, clan_tag, snapshot_date, payload')
    .order('player_tag')
    .order('snapshot_date');
    
  if (fetchError) {
    console.error('Failed to fetch canonical snapshots:', fetchError);
    return;
  }
  
  if (!snapshots || snapshots.length === 0) {
    console.log('No canonical snapshots found to backfill');
    return;
  }
  
  console.log(`Found ${snapshots.length} canonical snapshots to process`);
  
  // Group snapshots by player
  const playerSnapshots = new Map<string, CanonicalSnapshot[]>();
  for (const snapshot of snapshots) {
    const key = snapshot.player_tag;
    if (!playerSnapshots.has(key)) {
      playerSnapshots.set(key, []);
    }
    playerSnapshots.get(key)!.push(snapshot);
  }
  
  let processedPlayers = 0;
  let totalRowsInserted = 0;
  
  for (const [playerTag, playerSnaps] of playerSnapshots) {
    console.log(`Processing player ${playerTag} (${playerSnaps.length} snapshots)`);
    
    // Sort by date to ensure proper chronological order
    playerSnaps.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    
    let previousState: CanonicalPlayerState | null = null;
    
    for (const snapshot of playerSnaps) {
      try {
        // Extract canonical state from payload
        const member = snapshot.payload?.member;
        if (!member) {
          console.warn(`Skipping snapshot ${snapshot.snapshot_date} for ${playerTag} - no member data`);
          continue;
        }
        
        const currentState: CanonicalPlayerState = {
          date: snapshot.snapshot_date,
          clanTag: snapshot.clan_tag,
          playerTag: snapshot.player_tag,
          th: member.townHallLevel ?? null,
          league: member.ranked?.leagueName ?? member.league?.name ?? null,
          trophies: member.ranked?.trophies ?? member.trophies ?? null,
          donations: member.donations?.given ?? null,
          donationsReceived: member.donations?.received ?? null,
          warStars: member.war?.stars ?? null,
          capitalContrib: member.capitalContributions ?? null,
          legendAttacks: null, // Not available in current schema
          heroLevels: member.heroLevels ?? null,
          equipmentLevels: member.equipmentLevels ?? null,
          pets: member.pets ?? null,
          superTroopsActive: member.superTroopsActive ?? null,
          achievements: member.achievements ?? null,
          rushPercent: member.rushPercent ?? null,
          expLevel: member.expLevel ?? null,
        };
        
        // Generate player day row
        const dayRow = generatePlayerDayRow(previousState, currentState);
        
        // Check if this exact snapshot already exists
        const { data: existing } = await supabase
          .from('player_day')
          .select('snapshot_hash')
          .eq('player_tag', playerTag)
          .eq('date', snapshot.snapshot_date)
          .maybeSingle();
          
        if (existing?.snapshot_hash === dayRow.snapshotHash) {
          console.log(`Skipping duplicate snapshot for ${playerTag} on ${snapshot.snapshot_date}`);
          previousState = currentState;
          continue;
        }
        
        // Insert player day row
        const { error: insertError } = await supabase
          .from('player_day')
          .upsert({
            player_tag: dayRow.playerTag,
            clan_tag: dayRow.clanTag,
            date: dayRow.date,
            th: dayRow.th,
            league: dayRow.league,
            trophies: dayRow.trophies,
            donations: dayRow.donations,
            donations_rcv: dayRow.donationsReceived,
            war_stars: dayRow.warStars,
            capital_contrib: dayRow.capitalContrib,
            legend_attacks: dayRow.legendAttacks,
            hero_levels: dayRow.heroLevels,
            equipment_levels: dayRow.equipmentLevels,
            pets: dayRow.pets,
            super_troops_active: dayRow.superTroopsActive,
            achievements: dayRow.achievements,
            rush_percent: dayRow.rushPercent,
            exp_level: dayRow.expLevel,
            deltas: dayRow.deltas,
            events: dayRow.events,
            notability: dayRow.notability,
            snapshot_hash: dayRow.snapshotHash,
          }, { onConflict: 'player_tag,date', ignoreDuplicates: false });
          
        if (insertError) {
          console.error(`Failed to insert player_day row for ${playerTag} on ${snapshot.snapshot_date}:`, insertError);
        } else {
          totalRowsInserted++;
        }
        
        previousState = currentState;
        
      } catch (error) {
        console.error(`Error processing snapshot for ${playerTag} on ${snapshot.snapshot_date}:`, error);
      }
    }
    
    processedPlayers++;
    
    // Progress update every 10 players
    if (processedPlayers % 10 === 0) {
      console.log(`Processed ${processedPlayers}/${playerSnapshots.size} players, inserted ${totalRowsInserted} rows`);
    }
  }
  
  console.log(`Backfill completed: ${processedPlayers} players processed, ${totalRowsInserted} rows inserted`);
}

async function main() {
  try {
    await backfillPlayerDayData();
    process.exit(0);
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  }
}

main();
