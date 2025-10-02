import { cfg } from '@/lib/config';
import { runStagedIngestion, StagedIngestionOptions } from './staged-pipeline';
import { generateChangeSummary, generateGameChatMessages } from '@/lib/ai-summarizer';
import { addDeparture } from '@/lib/departures';
import { resolveUnknownPlayers } from '@/lib/player-resolver';
import { insightsEngine } from '@/lib/smart-insights';
import { saveInsightsBundle, cachePlayerDNAForClan, generateSnapshotSummary } from '@/lib/insights-storage';
import { saveAISummary } from '@/lib/supabase';
import { sendIngestionFailure, sendIngestionWarning } from './alerting';
import { detectChanges, saveChangeSummary, getSnapshotBeforeDate, type MemberChange } from '@/lib/snapshots';

export interface StagedIngestionJobResult {
  clanTag: string;
  success: boolean;
  ingestionResult?: any;
  changeSummary?: string;
  gameChatMessages?: string[];
  playersResolved?: number;
  resolutionErrors?: string[];
  insightsGenerated?: boolean;
  error?: string;
}

export interface RunStagedIngestionJobOptions extends StagedIngestionOptions {
  runPostProcessing?: boolean;
}

/**
 * Main entry point for the new staged ingestion pipeline.
 * This replaces the old runIngestionJob with a more robust, phase-based approach.
 */
export async function runStagedIngestionJob(options: RunStagedIngestionJobOptions = {}): Promise<StagedIngestionJobResult> {
  const { runPostProcessing = true, ...stagedOptions } = options;
  const clanTag = stagedOptions.clanTag || cfg.homeClanTag;
  
  if (!clanTag) {
    return {
      clanTag: 'unknown',
      success: false,
      error: 'No clan tag provided',
    };
  }

  const result: StagedIngestionJobResult = {
    clanTag,
    success: false,
  };

  try {
    // Run the core staged ingestion pipeline
    console.log(`[StagedIngestion] Starting ingestion for ${clanTag}`);
    const ingestionResult = await runStagedIngestion(stagedOptions);
    
    if (!ingestionResult.success) {
      result.error = ingestionResult.error;
      return result;
    }

    result.ingestionResult = ingestionResult;
    result.success = true;

    const phases = ingestionResult.phases ?? {};
    const anomalies = (ingestionResult as any).anomalies as Array<{ phase: string; message: string }> | undefined;
    const problematicPhases = anomalies?.length
      ? anomalies
      : Object.entries(phases)
          .filter(([name, phase]) => {
            if (!phase) return false;
            if (!phase.success) return true;
            if ((name === 'upsertMembers' || name === 'writeStats') && typeof phase.row_delta === 'number' && phase.row_delta === 0) {
              return true;
            }
            return false;
          })
          .map(([name, phase]) => ({ phase: name, message: phase?.error_message ?? 'row_delta 0' }));

    if (problematicPhases?.length) {
      await sendIngestionWarning(clanTag, 'Ingestion completed with anomalies', {
        jobId: stagedOptions.jobId,
        phases: problematicPhases,
      });
    }

    // Run post-processing if requested
    if (runPostProcessing && ingestionResult.success) {
      console.log(`[StagedIngestion] Running post-processing for ${clanTag}`);
      
      try {
        const postProcessingResult = await runPostProcessingSteps(clanTag, stagedOptions.jobId);
        result.changeSummary = postProcessingResult.changeSummary;
        result.gameChatMessages = postProcessingResult.gameChatMessages;
        result.playersResolved = postProcessingResult.playersResolved;
        result.resolutionErrors = postProcessingResult.resolutionErrors;
        result.insightsGenerated = postProcessingResult.insightsGenerated;
      } catch (postError: any) {
        console.warn(`[StagedIngestion] Post-processing failed: ${postError.message}`);
        // Don't fail the entire job for post-processing errors
      }
    }

    console.log(`[StagedIngestion] Completed successfully for ${clanTag}`);
    return result;

  } catch (error: any) {
    console.error(`[StagedIngestion] Failed for ${clanTag}:`, error);
    result.success = false;
    result.error = error.message;
    await sendIngestionFailure(clanTag, {
      jobId: stagedOptions.jobId,
      error: error?.message ?? 'Unknown error',
    });
    return result;
  }
}

interface PostProcessingResult {
  changeSummary?: string;
  gameChatMessages?: string[];
  playersResolved?: number;
  resolutionErrors?: string[];
  insightsGenerated?: boolean;
}

async function runPostProcessingSteps(clanTag: string, jobId?: string): Promise<PostProcessingResult> {
  const result: PostProcessingResult = {};

  try {
    // Change detection and summary generation
    console.log(`[PostProcessing] Detecting changes for ${clanTag}`);
    
    // Get current and previous snapshots for change detection
    const currentSnapshot = await getSnapshotBeforeDate(clanTag, new Date().toISOString().split('T')[0]);
    const previousSnapshot = await getSnapshotBeforeDate(clanTag, currentSnapshot?.date || '');
    
    let changes: MemberChange[] = [];
    if (previousSnapshot && currentSnapshot && previousSnapshot.date !== currentSnapshot.date) {
      changes = detectChanges(previousSnapshot, currentSnapshot);
    }
    
    if (changes.length > 0) {
      console.log(`[PostProcessing] Found ${changes.length} changes`);
      
      // Generate change summary
      const summary = await generateChangeSummary(changes, clanTag, currentSnapshot?.date || new Date().toISOString().split('T')[0]);
      const changeSummary = {
        date: currentSnapshot?.date || new Date().toISOString().split('T')[0],
        clanTag,
        changes,
        summary,
        gameChatMessages: [], // Will be populated below
        unread: true,
        actioned: false,
        createdAt: new Date().toISOString(),
      };
      await saveChangeSummary(changeSummary);
      result.changeSummary = summary;

      // Generate game chat messages
      const messages = await generateGameChatMessages(changes);
      result.gameChatMessages = messages;

      // Process departures
      const departures = changes.filter(c => c.type === 'left_member');
      for (const departure of departures) {
        await addDeparture(clanTag, {
          memberTag: departure.member.tag,
          memberName: departure.member.name,
          departureDate: currentSnapshot?.date || new Date().toISOString().split('T')[0],
          lastSeen: new Date().toISOString(),
          lastRole: departure.member.role,
          lastTownHall: departure.member.townHallLevel,
          lastTrophies: (departure.member as any).trophies,
        });
      }
    }

    // Player resolution
    console.log(`[PostProcessing] Resolving unknown players for ${clanTag}`);
    const resolutionResult = await resolveUnknownPlayers();
    result.playersResolved = resolutionResult.resolved;
    result.resolutionErrors = resolutionResult.errors;

    // Smart insights generation
    console.log(`[PostProcessing] Generating insights for ${clanTag}`);
    try {
        // Get clan data for insights generation
        const clanData = await getSnapshotBeforeDate(clanTag, new Date().toISOString().split('T')[0]);
        if (!clanData) {
          throw new Error('No clan data available for insights generation');
        }
        
        const insightsBundle = await insightsEngine.processBundle(
          clanData,
          changes,
          clanTag,
          currentSnapshot?.date || new Date().toISOString().split('T')[0]
        );
        
        await saveInsightsBundle(insightsBundle);
        await cachePlayerDNAForClan(clanData, clanTag, currentSnapshot?.date || new Date().toISOString().split('T')[0]);
        result.insightsGenerated = true;
    } catch (insightsError: any) {
      console.warn(`[PostProcessing] Insights generation failed: ${insightsError.message}`);
    }

    console.log(`[PostProcessing] Completed for ${clanTag}`);
    return result;

  } catch (error: any) {
    console.error(`[PostProcessing] Failed for ${clanTag}:`, error);
    throw error;
  }
}

/**
 * Convenience function to run ingestion with just a clan tag
 */
export async function runIngestionForClan(clanTag: string, options: Omit<RunStagedIngestionJobOptions, 'clanTag'> = {}) {
  return runStagedIngestionJob({
    ...options,
    clanTag,
  });
}

/**
 * Convenience function to run ingestion for the default clan
 */
export async function runDefaultClanIngestion(options: Omit<RunStagedIngestionJobOptions, 'clanTag'> = {}) {
  const clanTag = cfg.homeClanTag;
  if (!clanTag) {
    throw new Error('No default clan tag configured');
  }
  return runStagedIngestionJob({
    ...options,
    clanTag,
  });
}
