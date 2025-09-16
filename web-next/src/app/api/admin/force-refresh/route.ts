import { NextRequest, NextResponse } from 'next/server';
import { normalizeTag, isValidTag } from '@/lib/tags';
import { z } from 'zod';
import { createApiContext } from '@/lib/api/route-helpers';
import { fetchFullClanSnapshot, persistFullClanSnapshot } from '@/lib/full-snapshot';
import { detectChanges, saveChangeSummary, getLatestSnapshot } from '@/lib/snapshots';
import { generateChangeSummary } from '@/lib/ai-summarizer';
import { aiProcessor } from '@/lib/ai-processor';
import { saveBatchAIResults } from '@/lib/ai-storage';
import { generateSnapshotSummary } from '@/lib/ai-storage';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// POST /api/admin/force-refresh
export async function POST(req: NextRequest) {
  const { json, logger } = createApiContext(req, '/api/admin/force-refresh');
  
  try {
    const body = await req.json();
    const Schema = z.object({ 
      clanTag: z.string(),
      includeAI: z.boolean().optional().default(true)
    });
    const parsed = Schema.safeParse(body);
    
    if (!parsed.success) {
      return json({ success: false, error: 'clanTag is required' }, { status: 400 });
    }
    
    const { clanTag: rawClanTag, includeAI } = parsed.data;
    const clanTag = normalizeTag(rawClanTag);
    
    if (!isValidTag(clanTag)) {
      return json({ success: false, error: 'Provide a valid clanTag like #2PR8R8V8P' }, { status: 400 });
    }

    logger.info('Starting force refresh', { clanTag, includeAI });

    // Step 1: Fetch fresh full snapshot
    logger.info('Fetching full clan snapshot...');
    const fullSnapshot = await fetchFullClanSnapshot(clanTag, {
      warLogLimit: 10,
      capitalSeasonLimit: 3,
    });
    
    // Step 2: Persist to database
    logger.info('Persisting snapshot to database...');
    await persistFullClanSnapshot(fullSnapshot);
    
    // Step 3: Convert to DailySnapshot format for change detection
    const members = fullSnapshot.memberSummaries.map((summary: any) => ({
      name: summary.name,
      tag: summary.tag,
      townHallLevel: summary.townHallLevel,
      trophies: summary.trophies,
      donations: summary.donations,
      donationsReceived: summary.donationsReceived,
      lastSeen: summary.lastSeen,
      tenure: summary.tenure,
      rushPercentage: summary.rushPercentage,
      heroes: summary.heroes,
      donationBalance: summary.donationBalance,
      isNetReceiver: summary.isNetReceiver,
      isLowDonator: summary.isLowDonator,
      isVeryRushed: summary.isVeryRushed,
      isRushed: summary.isRushed,
    }));

    const currentSnapshot = {
      date: fullSnapshot.fetchedAt.slice(0, 10),
      clanTag: fullSnapshot.clanTag,
      clanName: fullSnapshot.clan?.name,
      timestamp: fullSnapshot.fetchedAt,
      memberCount: members.length,
      totalTrophies: members.reduce((sum, m) => sum + (m.trophies || 0), 0),
      totalDonations: members.reduce((sum, m) => sum + (m.donations || 0), 0),
      members,
    };

    // Step 4: Detect changes and generate AI summary
    logger.info('Detecting changes and generating AI summary...');
    const previousSnapshot = await getLatestSnapshot(clanTag);
    const changes = previousSnapshot ? await detectChanges(previousSnapshot, currentSnapshot) : [];
    
    if (changes && changes.length > 0) {
      const changeSummaryText = await generateChangeSummary(changes, clanTag, currentSnapshot.date);
      const changeSummary = {
        clanTag,
        date: currentSnapshot.date,
        changes,
        summary: changeSummaryText,
        timestamp: new Date().toISOString(),
        gameChatMessages: [],
        unread: true,
        actioned: false,
        createdAt: new Date().toISOString(),
      };
      await saveChangeSummary(changeSummary);
      logger.info('Change summary generated and saved', { changesCount: changes.length });
    }

    // Step 5: Generate AI analysis (if requested)
    let aiResults = null;
    if (includeAI) {
      logger.info('Generating AI analysis...');
      try {
        // Generate snapshot summary for context
        const snapshotSummary = generateSnapshotSummary(
          fullSnapshot.metadata,
          {
            currentWar: fullSnapshot.currentWar,
            warLog: fullSnapshot.warLog,
            capitalRaidSeasons: fullSnapshot.capitalRaidSeasons,
          },
          0 // Fresh data
        );
        
        const batchAIResults = await aiProcessor.processBatchAI(
          currentSnapshot,
          changes || [],
          clanTag,
          currentSnapshot.date
        );
        
        // Add snapshot summary to batch results
        batchAIResults.snapshotSummary = snapshotSummary;
        
        // Save batch AI results to Supabase
        await saveBatchAIResults(batchAIResults);
        aiResults = batchAIResults;
        
        logger.info('AI analysis completed and saved');
      } catch (aiError) {
        logger.error('AI analysis failed', { error: aiError });
        // Continue even if AI fails
      }
    }

    // Step 6: Return success response
    const response = {
      success: true,
      message: 'Force refresh completed successfully',
      data: {
        clanTag,
        snapshotDate: fullSnapshot.fetchedAt,
        memberCount: fullSnapshot.memberSummaries.length,
        changesDetected: changes?.length || 0,
        aiGenerated: includeAI && aiResults !== null,
        timestamp: new Date().toISOString(),
      }
    };

    logger.info('Force refresh completed', response.data);
    return json(response);

  } catch (error: any) {
    logger.error('Force refresh failed', { error: error.message });
    return json({ 
      success: false, 
      error: error.message || 'Force refresh failed'
    }, { status: 500 });
  }
}
