/**
 * Backfill tenure data from Clash of Stats "First Seen" dates
 * 
 * Usage:
 * 1. Go to https://www.clashofstats.com/clans/...heck-yeah...-2PR8R8V8P/history/past-members
 * 2. Copy the player data (tag, name, first seen date)
 * 3. Paste into the `members` array below
 * 4. For members who left and rejoined, add leftDate and rejoinedDate
 * 5. Run: tsx scripts/backfill-tenure-from-clash-of-stats.ts
 * 
 * NOTE: For most members, we assume continuous membership from "First Seen" to today.
 * Only specify leftDate/rejoinedDate for known cases where someone left and came back.
 */

import { applyTenureAction } from '../src/lib/services/tenure-service';
import { normalizeTag } from '../src/lib/tags';
import { cfg } from '../src/lib/config';

interface MemberData {
  tag: string;
  name: string;
  firstSeen: string;
  totalTenureDays: number; // Total cumulative tenure days (calculated from all periods)
  leftDate?: string; // Optional: when they left the clan (for reference)
  rejoinedDate?: string; // Optional: when they rejoined the clan (for reference)
}

// Paste your data here with total cumulative tenure days
// Format: { tag: '#TAG', name: 'Player Name', firstSeen: 'YYYY-MM-DD', totalTenureDays: number }
// 
// totalTenureDays: Total cumulative tenure across all periods in the clan
// This accounts for any leave/rejoin periods - you've already calculated the sum
const members: MemberData[] = [
  // Current members with calculated cumulative tenure
  { tag: '#LCJPY8QJY', name: 'BrenBren123', firstSeen: '2020-07-06', totalTenureDays: 122 },
  { tag: '#YYVUCPQ90', name: 'CosmicThomas', firstSeen: '2024-01-03', totalTenureDays: 655 },
  { tag: '#QV8R2GGY9', name: 'Deter', firstSeen: '2025-11-28', totalTenureDays: 32 },
  { tag: '#VGQVRLRL', name: 'DoubleD', firstSeen: '2024-07-01', totalTenureDays: 545 },
  { tag: '#Q9UP8YG99', name: 'Eren-y173', firstSeen: '2025-11-27', totalTenureDays: 33 },
  { tag: '#299PGYLG', name: 'flame', firstSeen: '2025-11-16', totalTenureDays: 44 },
  { tag: '#GLVJJQRJJ', name: 'Ghetto', firstSeen: '2025-12-20', totalTenureDays: 10 },
  { tag: '#9VCJVUGV', name: 'God Of LOYINS', firstSeen: '2024-08-09', totalTenureDays: 44 },
  { tag: '#GPYCPQV8J', name: 'Headhuntress', firstSeen: '2023-08-14', totalTenureDays: 635 },
  { tag: '#GCQPGVUYP', name: 'Isi', firstSeen: '2025-11-17', totalTenureDays: 43 },
  { tag: '#L9GJ0PJQ', name: 'Ozymandias', firstSeen: '2025-12-24', totalTenureDays: 6 },
  { tag: '#QUV0R9080', name: 'Powerful-PB', firstSeen: '2025-11-22', totalTenureDays: 38 },
  { tag: '#YUGUL9JJ0', name: 'se', firstSeen: '2024-08-16', totalTenureDays: 389 },
  { tag: '#L99VQ8GQ0', name: 'STICKS', firstSeen: '2025-11-21', totalTenureDays: 39 },
  { tag: '#G09GGYC2Y', name: 'Tigress', firstSeen: '2023-10-19', totalTenureDays: 792 },
  { tag: '#UL0LRJ02', name: 'War.Frog', firstSeen: '2023-08-21', totalTenureDays: 852 },
  { tag: '#G9QVRYC2Y', name: 'warfroggy', firstSeen: '2023-08-21', totalTenureDays: 851 },
  { tag: '#G8GCC8GGC', name: 'Zouboul', firstSeen: '2024-01-16', totalTenureDays: 713 },
];

async function main() {
  console.log('🔄 Starting tenure backfill from Clash of Stats data...\n');
  
  const clanTag = cfg.homeClanTag;
  let successCount = 0;
  let errorCount = 0;

  for (const member of members) {
    try {
      const playerTag = normalizeTag(member.tag);
      if (!playerTag) {
        console.error(`❌ Invalid tag: ${member.tag}`);
        errorCount++;
        continue;
      }

      // Use the provided total cumulative tenure days
      // Set baseDays to the total and asOf to today so it displays correctly immediately
      // Tenure will continue to accrue from tomorrow
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const baseDays = member.totalTenureDays;
      const asOf = today;
      const reason = `Backfilled from Clash of Stats - Total cumulative tenure: ${member.totalTenureDays} days (first seen ${member.firstSeen})`;

      console.log(`Processing ${member.name} (${playerTag}):`);
      console.log(`  First seen: ${member.firstSeen}`);
      console.log(`  Total cumulative tenure: ${member.totalTenureDays} days`);

      // Apply tenure
      const result = await applyTenureAction({
        clanTag,
        playerTag,
        playerName: member.name,
        baseDays,
        asOf,
        reason,
        action: 'granted',
        grantedBy: 'system',
        createdBy: 'backfill-script',
      });

      console.log(`  ✅ Applied tenure: ${result.tenureDays} days\n`);
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}\n`);
      errorCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📝 Total: ${members.length}`);
  
  if (successCount > 0) {
    console.log('\n✨ Tenure data has been backfilled!');
    console.log('   Members will now show accurate tenure based on Clash of Stats data.');
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

