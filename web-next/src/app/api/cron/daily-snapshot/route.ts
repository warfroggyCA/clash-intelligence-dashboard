// web-next/src/app/api/cron/daily-snapshot/route.ts
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { detectChanges, saveChangeSummary, getSnapshotBeforeDate, getLatestSnapshot } from "@/lib/snapshots";
import { generateChangeSummary, generateGameChatMessages } from "@/lib/ai-summarizer";
import { cfg } from "@/lib/config";
import { addDeparture } from "@/lib/departures";
import { resolveUnknownPlayers } from "@/lib/player-resolver";
import { insightsEngine } from "@/lib/smart-insights";
import { saveInsightsBundle, cachePlayerDNAForClan, generateSnapshotSummary } from "@/lib/insights-storage";
import { createApiContext } from "@/lib/api/route-helpers";
import { fetchFullClanSnapshot, persistFullClanSnapshot } from "@/lib/full-snapshot";

export async function GET(req: Request) {
  const { json } = createApiContext(req, '/api/cron/daily-snapshot');
  try {
    if (!cfg.isDevelopment) {
      return json({ success: false, error: 'This endpoint has been retired. Use the ingestion worker.' }, { status: 410 });
    }

    // Verify this is a legitimate cron request (you might want to add authentication)
    const authHeader = req.headers.get('authorization');
    const expectedAuth = process.env.CRON_SECRET;
    
    if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
      return json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const results = [];
    
    // Get the home clan tag from config
    const clanTag = cfg.homeClanTag;
    
    if (!clanTag) {
      return json({ success: false, error: "No home clan configured" }, { status: 400 });
    }

    console.log(`[CRON] Starting daily snapshot for ${clanTag} at ${new Date().toISOString()}`);

    try {
      // Create today's full snapshot
      console.log(`[CRON] Creating full snapshot for ${clanTag}...`);
      const fullSnapshot = await fetchFullClanSnapshot(clanTag, {
        warLogLimit: 10,
        capitalSeasonLimit: 3,
      });
      await persistFullClanSnapshot(fullSnapshot);
      console.log(`[CRON] Created full snapshot: ${fullSnapshot.memberSummaries.length} members, ${fullSnapshot.metadata.warLogEntries} war log entries, ${fullSnapshot.metadata.capitalSeasons} capital seasons`);
      
      // Convert to DailySnapshot format for change detection
      const currentSnapshot = {
        date: fullSnapshot.fetchedAt.slice(0, 10),
        clanTag: fullSnapshot.clanTag,
        clanName: fullSnapshot.clan?.name,
        timestamp: fullSnapshot.fetchedAt,
        members: fullSnapshot.memberSummaries.map((summary: any) => ({
          name: summary.name,
          tag: summary.tag,
          townHallLevel: summary.townHallLevel,
          trophies: summary.trophies,
          donations: summary.donations,
          donationsReceived: summary.donationsReceived,
          role: summary.role,
          tenure_days: 0,
          attackWins: 0,
          versusBattleWins: 0,
          versusTrophies: summary.builderTrophies || 0,
          clanCapitalContributions: 0,
        })),
        memberCount: fullSnapshot.memberSummaries.length,
        totalTrophies: fullSnapshot.memberSummaries.reduce((sum: number, m: any) => sum + (m.trophies || 0), 0),
        totalDonations: fullSnapshot.memberSummaries.reduce((sum: number, m: any) => sum + (m.donations || 0), 0),
      };
      
      // Get previous snapshot for comparison
      const previousSnapshot = await getSnapshotBeforeDate(clanTag, currentSnapshot.date);
      
      let changeSummary = null;
      
      if (previousSnapshot && previousSnapshot.date !== currentSnapshot.date) {
        // Detect changes
        const changes = detectChanges(previousSnapshot, currentSnapshot);
        console.log(`[CRON] Detected ${changes.length} changes for ${clanTag}`);
        
        if (changes.length > 0) {
          // Record departures automatically
          const departures = changes.filter(c => c.type === 'left_member');
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
            console.log(`[CRON] Recorded departure for ${departure.member.name}`);
          }
          
          // Generate legacy change summary and game chat messages
          const summary = await generateChangeSummary(changes, clanTag, currentSnapshot.date);
          const gameChatMessages = generateGameChatMessages(changes);
          
          changeSummary = {
            date: currentSnapshot.date,
            clanTag,
            changes,
            summary,
            gameChatMessages,
            unread: true,
            actioned: false,
            createdAt: new Date().toISOString(),
          };
          
          // Save change summary (legacy)
          await saveChangeSummary(changeSummary);
          console.log(`[CRON] Saved change summary for ${clanTag}`);

          // Generate comprehensive insights bundle
          console.log(`[CRON] Starting automated insights processing for ${clanTag}`);
          try {
            // Generate snapshot summary for context
            const snapshotSummary = generateSnapshotSummary(
              fullSnapshot.metadata,
              {
                currentWar: fullSnapshot.currentWar,
                warLog: fullSnapshot.warLog,
                capitalRaidSeasons: fullSnapshot.capitalRaidSeasons,
              },
              0 // Fresh data from cron
            );
            
            const insightsBundle = await insightsEngine.processBundle(
              currentSnapshot,
              changes,
              clanTag,
              currentSnapshot.date
            );
            
            // Add snapshot summary to batch results
            insightsBundle.snapshotSummary = snapshotSummary;
            
            // Save insights bundle to Supabase
            await saveInsightsBundle(insightsBundle);
            console.log(`[CRON] Saved insights bundle with snapshot summary for ${clanTag}`);
            
            // Cache player DNA profiles for instant access
            await cachePlayerDNAForClan(currentSnapshot, clanTag, currentSnapshot.date);
            console.log(`[CRON] Cached player DNA profiles for ${clanTag}`);
            
          } catch (aiError) {
            console.error(`[CRON] Automated insights processing failed for ${clanTag}:`, aiError);
            // Continue with normal processing even if insights fail
          }
        }
      }

      // Resolve unknown players
      console.log(`[CRON] Resolving unknown players for ${clanTag}...`);
      const resolutionResult = await resolveUnknownPlayers();
      console.log(`[CRON] Resolved ${resolutionResult.resolved} unknown players`);

      results.push({
        clanTag,
        success: true,
        memberCount: currentSnapshot.memberCount,
        changesDetected: changeSummary?.changes.length || 0,
        summary: changeSummary?.summary,
        gameChatMessages: changeSummary?.gameChatMessages || [],
        playersResolved: resolutionResult.resolved,
        resolutionErrors: resolutionResult.errors,
      });

    } catch (error: any) {
      console.error(`[CRON] Error processing ${clanTag}:`, error);
      results.push({
        clanTag,
        success: false,
        error: error.message,
      });
    }

    console.log(`[CRON] Daily snapshot completed at ${new Date().toISOString()}`);

    return json({ success: true, data: { timestamp: new Date().toISOString(), results } });
  } catch (error: any) {
    console.error('[CRON] Daily snapshot error:', error);
    return json({ success: false, error: error.message || "Failed to create daily snapshot" }, { status: 500 });
  }
}
