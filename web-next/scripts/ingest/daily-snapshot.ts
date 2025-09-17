// Load environment variables from .env.local FIRST, before any other imports
import { config } from 'dotenv';
config({ path: '.env.local' });

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.VERCEL_ENV = process.env.VERCEL_ENV || 'production';

// Now import other modules that depend on environment variables
import { cfg } from '../../src/lib/config';
import { convertFullSnapshotToDailySnapshot, detectChanges, getSnapshotBeforeDate, saveChangeSummary } from '../../src/lib/snapshots';
import { generateChangeSummary, generateGameChatMessages } from '../../src/lib/ai-summarizer';
import { addDeparture } from '../../src/lib/departures';
import { resolveUnknownPlayers } from '../../src/lib/player-resolver';
import { insightsEngine } from '../../src/lib/smart-insights';
import { saveInsightsBundle, cachePlayerDNAForClan } from '../../src/lib/insights-storage';
import { fetchFullClanSnapshot, persistFullClanSnapshot } from '../../src/lib/full-snapshot';
import { mockFullClanSnapshot } from '../mock-data';

async function run() {
  // Parse CLI args: daily-snapshot.ts <clanTag> [--no-mock]
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const noMock = flags.has('--no-mock') || flags.has('--real') || flags.has('--real-only');
  const clanTagArg = args.find((a) => !a.startsWith('--')) || null;

  const clanTag = clanTagArg || cfg.homeClanTag;
  if (!clanTag) {
    throw new Error('No clan tag provided (pass as argument or set cfg.homeClanTag)');
  }

  console.log(`[Ingest] Starting daily snapshot for ${clanTag}`);
  console.log(`[Ingest] Mode: ${noMock ? 'real-only (no mock fallback)' : 'real-with-mock-fallback'}`);

  // If forcing real run, ensure required env vars are present (masked check)
  if (noMock) {
    const required = [
      'COC_API_TOKEN',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];
    const missing = required.filter((k) => !process.env[k]);
    for (const k of required) {
      // Do not print secrets; just indicate presence
      console.log(`[EnvCheck] ${k}: ${process.env[k] ? 'present' : 'missing'}`);
    }
    if (missing.length > 0) {
      throw new Error(`Missing required env vars for real run: ${missing.join(', ')}`);
    }
  }

  let fullSnapshot;
  try {
    fullSnapshot = await fetchFullClanSnapshot(clanTag, {
      warLogLimit: 10,
      capitalSeasonLimit: 3,
    });
    await persistFullClanSnapshot(fullSnapshot);
    console.log(
      `[Ingest] Captured full snapshot: ${fullSnapshot.memberSummaries.length} members, ` +
        `${fullSnapshot.metadata.warLogEntries} war log entries, ${fullSnapshot.metadata.capitalSeasons} capital seasons`
    );
  } catch (error) {
    if (noMock) {
      console.error('[Ingest] Failed to capture full snapshot and --no-mock is set', error);
      throw error;
    }
    console.error('[Ingest] Failed to capture full snapshot, using mock data for testing', error);
    // Use mock data for local testing when API fails
    fullSnapshot = {
      ...mockFullClanSnapshot,
      clanTag: clanTag,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0]
    };
    console.log(
      `[Ingest] Using mock data: ${fullSnapshot.memberSummaries.length} members, ` +
        `${fullSnapshot.metadata.warLogEntries} war log entries, ${fullSnapshot.metadata.capitalSeasons} capital seasons`
    );
  }

  // Create daily snapshot from the full snapshot we fetched earlier
  const currentSnapshot = convertFullSnapshotToDailySnapshot(fullSnapshot);
  console.log(`[Ingest] Snapshot created at ${currentSnapshot.timestamp} with ${currentSnapshot.memberCount} members`);

  const previousSnapshot = await getSnapshotBeforeDate(clanTag, currentSnapshot.date);

  if (previousSnapshot && previousSnapshot.date !== currentSnapshot.date) {
    const changes = detectChanges(previousSnapshot, currentSnapshot);
    console.log(`[Ingest] Detected ${changes.length} changes compared to ${previousSnapshot.date}`);

    if (changes.length > 0) {
      const departures = changes.filter((c) => c.type === 'left_member');
      for (const departure of departures) {
        await addDeparture(clanTag, {
          memberTag: departure.member.tag,
          memberName: departure.member.name,
          departureDate: currentSnapshot.date,
          lastSeen: new Date().toISOString(),
          lastRole: departure.member.role,
          lastTownHall: departure.member.townHallLevel,
          lastTrophies: (departure.member as any).trophies,
        });
        console.log(`[Ingest] Recorded departure for ${departure.member.name}`);
      }

      const summary = await generateChangeSummary(changes, clanTag, currentSnapshot.date);
      const gameChatMessages = generateGameChatMessages(changes);

      const payload = {
        date: currentSnapshot.date,
        clanTag,
        changes,
        summary,
        gameChatMessages,
        unread: true,
        actioned: false,
        createdAt: new Date().toISOString(),
      };

      await saveChangeSummary(payload);
      console.log('[Ingest] Change summary saved');

      try {
        const insightsBundle = await insightsEngine.processBundle(
          currentSnapshot,
          changes,
          clanTag,
          currentSnapshot.date
        );
        await saveInsightsBundle(insightsBundle);
        await cachePlayerDNAForClan(currentSnapshot, clanTag, currentSnapshot.date);
        console.log('[Ingest] Insights bundle stored and DNA cached');
      } catch (error) {
        console.error('[Ingest] Insights bundle processing failed:', error);
      }
    }
  }

  console.log('[Ingest] Resolving unknown players...');
  const resolution = await resolveUnknownPlayers();
  console.log(`[Ingest] Resolved ${resolution.resolved} player names`);

  console.log('[Ingest] Daily snapshot complete');
}

run()
  .then(() => {
    console.log('[Ingest] Success');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Ingest] Failed:', error);
    process.exit(1);
  });
