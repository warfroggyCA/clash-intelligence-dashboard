/**
 * Backfill tenure data from Clash of Stats FULL HISTORY
 * 
 * This script calculates CUMULATIVE tenure (sum of all periods in the clan)
 * for members who may have left and rejoined.
 * 
 * Usage:
 * 1. Paste the full history from Clash of Stats below
 * 2. Run: tsx scripts/backfill-tenure-full-history.ts
 */

import { applyTenureAction } from '../src/lib/services/tenure-service';
import { normalizeTag } from '../src/lib/tags';
import { cfg } from '../src/lib/config';

// Paste the full history here - format: Name	Tag	Role	First Seen	Last Seen
// Each line is tab-separated. If a player appears multiple times (left and rejoined),
// they will have multiple entries that will be combined for cumulative tenure.
const historyText = `
BrenBren123	#LCJPY8QJY	Member	July 6, 2020	Still a Member
flame	#299PGYLG	Member	November 16, 2025	Still a Member
God Of LOYINS	#9VCJVUGV	Member	August 9, 2024	Still a Member
Tigress	#G09GGYC2Y	Co-leader	October 19, 2023	Still a Member
Zouboul	#G8GCC8GGC	Elder	January 16, 2024	Still a Member
warfroggy	#G9QVRYC2Y	Leader	August 21, 2023	Still a Member
Isi	#GCQPGVUYP	Member	November 17, 2025	Still a Member
Ghetto	#GLVJJQRJJ	Member	December 20, 2025	Still a Member
Headhuntress	#GPYCPQV8J	Elder	August 14, 2023	Still a Member
STICKS	#L99VQ8GQ0	Member	November 21, 2025	Still a Member
Ozymandias	#L9GJ0PJQ	Member	December 24, 2025	Still a Member
Eren-y173	#Q9UP8YG99	Member	November 27, 2025	Still a Member
Powerful-PB	#QUV0R9080	Member	November 22, 2025	Still a Member
Deter	#QV8R2GGY9	Member	November 28, 2025	Still a Member
War.Frog	#UL0LRJ02	Elder	August 21, 2023	Still a Member
DoubleD	#VGQVRLRL	Co-leader	July 1, 2024	Still a Member
se	#YUGUL9JJ0	Elder	August 16, 2024	Still a Member
CosmicThomas	#YYVUCPQ90	Elder	January 3, 2024	Still a Member
`;

interface MembershipPeriod {
  firstSeen: Date;
  lastSeen: Date | null; // null = "Still a Member"
  days: number;
}

interface PlayerHistory {
  name: string;
  tag: string;
  periods: MembershipPeriod[];
  totalDays: number;
}

function parseDate(dateStr: string): Date {
  // Handle "Still a Member" or date strings like "July 6, 2020"
  if (dateStr.toLowerCase().includes('still')) {
    return new Date(); // Today
  }
  
  // Parse dates like "July 6, 2020" or "December 24, 2025"
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return date;
}

function calculateDays(start: Date, end: Date | null): number {
  const endDate = end || new Date();
  return Math.floor((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function parseHistory(text: string): Map<string, PlayerHistory> {
  const players = new Map<string, PlayerHistory>();
  const lines = text.trim().split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: Name	Tag	Role	First Seen	Last Seen
    const parts = line.split('\t');
    if (parts.length < 5) continue;
    
    const name = parts[0].trim();
    const tag = normalizeTag(parts[1].trim());
    const firstSeenStr = parts[3].trim();
    const lastSeenStr = parts[4].trim();
    
    if (!tag) {
      console.warn(`⚠️  Skipping invalid tag: ${parts[1]}`);
      continue;
    }
    
    try {
      const firstSeen = parseDate(firstSeenStr);
      const lastSeen = lastSeenStr.toLowerCase().includes('still') 
        ? null 
        : parseDate(lastSeenStr);
      
      const days = calculateDays(firstSeen, lastSeen);
      
      if (!players.has(tag)) {
        players.set(tag, {
          name,
          tag,
          periods: [],
          totalDays: 0,
        });
      }
      
      const player = players.get(tag)!;
      player.periods.push({ firstSeen, lastSeen, days });
      player.totalDays += days;
      
      // Update name if this is a more recent entry
      if (!lastSeen || lastSeen > (player.periods[0]?.firstSeen || new Date(0))) {
        player.name = name;
      }
    } catch (error: any) {
      console.warn(`⚠️  Skipping line due to error: ${error.message}`);
      console.warn(`   Line: ${line.substring(0, 100)}...`);
    }
  }
  
  return players;
}

async function main() {
  console.log('🔄 Starting cumulative tenure backfill from full Clash of Stats history...\n');
  
  const players = parseHistory(historyText);
  console.log(`📊 Parsed ${players.size} unique players\n`);
  
  const clanTag = cfg.homeClanTag;
  let successCount = 0;
  let errorCount = 0;
  const today = new Date().toISOString().split('T')[0];
  
  // Sort by total tenure (descending) for better output
  const sortedPlayers = Array.from(players.values()).sort((a, b) => b.totalDays - a.totalDays);
  
  for (const player of sortedPlayers) {
    try {
      console.log(`Processing ${player.name} (${player.tag}):`);
      console.log(`  Periods: ${player.periods.length}`);
      
      if (player.periods.length > 1) {
        console.log(`  ⚠️  Multiple periods detected (left and rejoined):`);
        player.periods.forEach((period, idx) => {
          const start = period.firstSeen.toISOString().split('T')[0];
          const end = period.lastSeen 
            ? period.lastSeen.toISOString().split('T')[0]
            : 'Still a Member';
          console.log(`    ${idx + 1}. ${start} → ${end} (${period.days} days)`);
        });
      } else {
        const period = player.periods[0];
        const start = period.firstSeen.toISOString().split('T')[0];
        const end = period.lastSeen 
          ? period.lastSeen.toISOString().split('T')[0]
          : 'Still a Member';
        console.log(`  Period: ${start} → ${end}`);
      }
      
      console.log(`  Total cumulative tenure: ${player.totalDays} days`);
      
      // Find the earliest "as of" date (first period start)
      const earliestStart = player.periods.reduce((earliest, period) => 
        period.firstSeen < earliest ? period.firstSeen : earliest,
        player.periods[0].firstSeen
      );
      
      // Calculate base days (tenure up to earliest start)
      // Since we're backfilling, baseDays should be 0 and we'll accrue from earliest start
      // But we need to account for gaps...
      
      // Actually, for cumulative tenure, we need to:
      // 1. Set baseDays to the sum of all COMPLETED periods (before earliest start)
      // 2. Set asOf to the earliest start
      // 3. Then accrue from earliest start to today
      
      // But wait - if someone left and rejoined, we can't just use earliest start
      // We need to sum all periods...
      
      // Let me think about this differently:
      // - If they have multiple periods, we need to sum all the days
      // - The tenure ledger tracks: baseDays + days from asOf to today
      // - So baseDays should be sum of all COMPLETED periods
      // - asOf should be the start of the CURRENT period (or earliest if still in clan)
      
      const completedPeriods = player.periods.filter(p => p.lastSeen !== null);
      const currentPeriod = player.periods.find(p => p.lastSeen === null);
      
      let baseDays = 0;
      let asOf: Date;
      
      if (currentPeriod) {
        // They're currently in the clan
        baseDays = completedPeriods.reduce((sum, p) => sum + p.days, 0);
        asOf = currentPeriod.firstSeen;
      } else {
        // They left - use the last period
        const lastPeriod = player.periods[player.periods.length - 1];
        baseDays = completedPeriods.slice(0, -1).reduce((sum, p) => sum + p.days, 0);
        asOf = lastPeriod.firstSeen;
      }
      
      const asOfStr = asOf.toISOString().split('T')[0];
      
      console.log(`  Base days (completed periods): ${baseDays}`);
      console.log(`  Accruing from: ${asOfStr}`);
      
      const result = await applyTenureAction({
        clanTag,
        playerTag: player.tag,
        playerName: player.name,
        baseDays,
        asOf: asOfStr,
        reason: player.periods.length > 1
          ? `Backfilled cumulative tenure from Clash of Stats - ${player.periods.length} periods totaling ${player.totalDays} days`
          : `Backfilled tenure from Clash of Stats - ${player.totalDays} days since ${asOfStr}`,
        action: 'granted',
        grantedBy: 'system',
        createdBy: 'backfill-full-history',
      });
      
      console.log(`  ✅ Applied tenure: ${result.tenureDays} days (expected: ${player.totalDays})\n`);
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}\n`);
      errorCount++;
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📝 Total players: ${players.size}`);
  
  if (successCount > 0) {
    console.log('\n✨ Cumulative tenure data has been backfilled!');
    console.log('   Members will now show accurate cumulative tenure based on full Clash of Stats history.');
  }
}

main()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

