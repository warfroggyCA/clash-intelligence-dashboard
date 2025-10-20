import 'dotenv/config';
import { config } from 'dotenv';
import path from 'path';

// Explicitly load .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });
import { getSupabaseServerClient } from '../src/lib/supabase-server';
import { generatePlayerDayRow, type CanonicalPlayerState } from '../src/lib/player-day';

interface ClanSnapshot {
  snapshot_date: string;
  clan_tag: string;
  member_summaries: any[];
  player_details: any[];
}

async function backfillPlayerDayFromClanSnapshots() {
  const supabase = getSupabaseServerClient();
  
  console.log('Starting player_day backfill from clan snapshots...');
  
  // Get all clan snapshots ordered by date
  const { data: clanSnapshots, error: fetchError } = await supabase
    .from('clan_snapshots')
    .select('snapshot_date, clan_tag, member_summaries, player_details')
    .order('snapshot_date');
    
  if (fetchError) {
    console.error('Failed to fetch clan snapshots:', fetchError);
    return;
  }
  
  if (!clanSnapshots || clanSnapshots.length === 0) {
    console.log('No clan snapshots found to backfill');
    return;
  }
  
  console.log(`Found ${clanSnapshots.length} clan snapshots to process`);
  
  // Process each clan snapshot
  let totalProcessed = 0;
  let totalInserted = 0;
  
  for (const clanSnapshot of clanSnapshots) {
    console.log(`Processing clan snapshot for ${clanSnapshot.clan_tag} on ${clanSnapshot.snapshot_date}`);
    
    // Debug: Check data structure
    console.log('Member summaries type:', typeof clanSnapshot.member_summaries);
    console.log('Player details type:', typeof clanSnapshot.player_details);
    
    // Get member summaries and player details
    const memberSummaries = Array.isArray(clanSnapshot.member_summaries) ? clanSnapshot.member_summaries : [];
    const playerDetails = Array.isArray(clanSnapshot.player_details) ? clanSnapshot.player_details : [];
    
    console.log(`Found ${memberSummaries.length} member summaries and ${playerDetails.length} player details`);
    
    // Process each member
    for (const member of memberSummaries) {
      if (!member.tag) continue;
      
      try {
        // Get previous player_day row for this player
        const { data: prevRow, error: prevError } = await supabase
          .from('player_day')
          .select('*')
          .eq('player_tag', member.tag)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevError && prevError.code !== 'PGRST116') {
          console.warn(`Failed to load previous player_day row for ${member.tag}:`, prevError.message);
        }

        // Create canonical player state from clan snapshot data
        // Note: clan snapshots only have member_summaries, not detailed player data
        const currentState: CanonicalPlayerState = {
          date: clanSnapshot.snapshot_date,
          clanTag: clanSnapshot.clan_tag,
          playerTag: member.tag,
          th: member.townHallLevel || null,
          league: member.leagueTier?.name || null,
          trophies: member.trophies || null,
          donations: member.donations || null,
          donationsReceived: member.donationsReceived || null,
          warStars: member.warStars || null,
          attackWins: member.attackWins || null,
          defenseWins: member.defenseWins || null,
          capitalContrib: member.capitalContributions || null,
          legendAttacks: null, // Not available in member summaries
          builderHallLevel: member.builderHallLevel || null,
          builderWins: member.versusBattleWins || null,
          builderTrophies: member.builderTrophies || member.versusTrophies || null,
          heroLevels: null, // Not available in member summaries
          equipmentLevels: null, // Not available in member summaries
          pets: null, // Not available in member summaries
          superTroopsActive: null, // Not available in member summaries
          achievements: null, // Not available in member summaries
          rushPercent: null, // Not available in member summaries
          expLevel: null, // Not available in member summaries
        };

        // Get previous state if available
        let previousState: CanonicalPlayerState | undefined;
        if (prevRow) {
          previousState = {
            date: prevRow.date,
            clanTag: prevRow.clan_tag,
            playerTag: prevRow.player_tag,
            th: prevRow.th || null,
            league: prevRow.league || null,
            trophies: prevRow.trophies || null,
            donations: prevRow.donations || null,
            donationsReceived: prevRow.donations_rcv || null,
            warStars: prevRow.war_stars || null,
            attackWins: prevRow.attack_wins || null,
            defenseWins: prevRow.defense_wins || null,
            capitalContrib: prevRow.capital_contrib || null,
            legendAttacks: prevRow.legend_attacks || null,
            builderHallLevel: prevRow.builder_hall || null,
            builderWins: prevRow.builder_battle_wins || null,
            builderTrophies: prevRow.builder_trophies || null,
            heroLevels: (prevRow.hero_levels as any) || null,
            equipmentLevels: (prevRow.equipment_levels as any) || null,
            pets: (prevRow.pets as any) || null,
            superTroopsActive: prevRow.super_troops_active || null,
            achievements: (prevRow.achievements as any) || null,
            rushPercent: prevRow.rush_percent || null,
            expLevel: prevRow.exp_level || null,
          };
        }

        // Generate player day row
        const dayRow = generatePlayerDayRow(previousState, currentState);

        // Check if this row already exists
        const { data: existingRow, error: checkError } = await supabase
          .from('player_day')
          .select('snapshot_hash, notability')
          .eq('player_tag', dayRow.playerTag)
          .eq('date', dayRow.date)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          console.warn(`Failed to check existing row for ${member.tag}:`, checkError.message);
          continue;
        }

        // Skip if duplicate
        if (existingRow?.snapshot_hash === dayRow.snapshotHash) {
          console.log(`Skipping duplicate snapshot for ${member.tag} on ${clanSnapshot.snapshot_date}`);
          continue;
        }

        // Insert or update player day row
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
            attack_wins: dayRow.attackWins,
            defense_wins: dayRow.defenseWins,
            capital_contrib: dayRow.capitalContrib,
            legend_attacks: dayRow.legendAttacks,
            builder_hall_level: dayRow.builderHallLevel,
            builder_battle_wins: dayRow.builderBattleWins,
            builder_trophies: dayRow.builderTrophies,
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
          console.warn(`Failed to upsert player_day row for ${member.tag}:`, insertError.message);
        } else {
          totalInserted++;
        }
        
        totalProcessed++;
        
      } catch (error) {
        console.warn(`Unexpected error processing ${member.tag}:`, error);
      }
    }
  }
  
  console.log(`Backfill completed: ${totalProcessed} player snapshots processed, ${totalInserted} rows inserted`);
}

backfillPlayerDayFromClanSnapshots().catch(console.error);
