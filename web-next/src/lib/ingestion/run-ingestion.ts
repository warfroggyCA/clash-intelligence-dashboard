import { cfg } from '@/lib/config';
import { detectChanges, saveChangeSummary, getSnapshotBeforeDate } from '@/lib/snapshots';
import { generateChangeSummary, generateGameChatMessages } from '@/lib/ai-summarizer';
import { addDeparture } from '@/lib/departures';
import { resolveUnknownPlayers } from '@/lib/player-resolver';
import { insightsEngine } from '@/lib/smart-insights';
import { saveInsightsBundle, cachePlayerDNAForClan, generateSnapshotSummary } from '@/lib/insights-storage';
import { saveAISummary } from '@/lib/supabase';
import { fetchFullClanSnapshot, persistFullClanSnapshot } from '@/lib/full-snapshot';
import {
  appendJobLog,
  createJobRecord,
  updateJobStatus,
  upsertJobStep,
  IngestionJobLogEntry,
  IngestionStepStatus,
  getJobRecord,
} from './job-store';

interface IngestionResult {
  clanTag: string;
  success: boolean;
  memberCount?: number;
  changesDetected?: number;
  summary?: string;
  gameChatMessages?: string[];
  playersResolved?: number;
  resolutionErrors?: number;
  error?: string;
}

export interface RunIngestionOptions {
  clanTag?: string;
  jobId?: string;
}

function logEntry(level: 'info' | 'warn' | 'error', message: string, details?: Record<string, any>): IngestionJobLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    details,
  };
}

async function markStep(jobId: string | undefined, name: string, status: IngestionStepStatus, metadata?: Record<string, any>) {
  if (!jobId) return;
  const timestamp = new Date().toISOString();
  await upsertJobStep(jobId, {
    name,
    status,
    metadata,
    ...(status === 'running' ? { startedAt: timestamp } : {}),
    ...(status === 'completed' || status === 'failed' ? { finishedAt: timestamp } : {}),
  });
}

async function log(jobId: string | undefined, level: 'info' | 'warn' | 'error', message: string, details?: Record<string, any>) {
  if (jobId) {
    await appendJobLog(jobId, logEntry(level, message, details));
  }
  const tag = jobId ? `[Ingestion ${jobId}]` : '[Ingestion]';
  if (level === 'info') {
    console.log(tag, message, details ?? '');
  } else if (level === 'warn') {
    console.warn(tag, message, details ?? '');
  } else {
    console.error(tag, message, details ?? '');
  }
}

export async function runIngestionJob(options: RunIngestionOptions = {}): Promise<IngestionResult[]> {
  const { clanTag: providedTag, jobId: providedJobId } = options;
  const results: IngestionResult[] = [];

  const clanTag = providedTag || cfg.homeClanTag;
  if (!clanTag) {
    results.push({ clanTag: providedTag ?? 'unknown', success: false, error: 'No clan tag provided' });
    return results;
  }

  const jobId = providedJobId;
  if (jobId) {
    const existing = await getJobRecord(jobId);
    if (!existing) {
      await createJobRecord(jobId, clanTag);
    }
    await updateJobStatus(jobId, 'running');
    await log(jobId, 'info', `Starting ingestion for ${clanTag}`);
  } else {
    console.log(`[Ingestion] Starting ingestion for ${clanTag}`);
  }

  try {
    await markStep(jobId, 'fetch-snapshot', 'running');
    await log(jobId, 'info', 'Fetching full snapshot');
    const fullSnapshot = await fetchFullClanSnapshot(clanTag, {
      warLogLimit: 10,
      capitalSeasonLimit: 3,
    });
    await persistFullClanSnapshot(fullSnapshot);
    await markStep(jobId, 'fetch-snapshot', 'completed', {
      members: fullSnapshot.memberSummaries.length,
      warLogEntries: fullSnapshot.metadata.warLogEntries,
    });
    await log(jobId, 'info', 'Snapshot created', {
      members: fullSnapshot.memberSummaries.length,
      warLogEntries: fullSnapshot.metadata.warLogEntries,
    });

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

    const previousSnapshot = await getSnapshotBeforeDate(clanTag, currentSnapshot.date);

    let changeSummary = null;

    if (previousSnapshot && previousSnapshot.date !== currentSnapshot.date) {
      await markStep(jobId, 'detect-changes', 'running');
      const changes = detectChanges(previousSnapshot, currentSnapshot);
      await log(jobId, 'info', 'Detected changes', { count: changes.length });

      if (changes.length > 0) {
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
          await log(jobId, 'info', 'Recorded departure', { member: departure.member.tag });
        }

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

        await saveChangeSummary(changeSummary);
        await log(jobId, 'info', 'Saved change summary');

        try {
          await saveAISummary({
            clan_tag: clanTag,
            date: currentSnapshot.date,
            summary,
            summary_type: 'automation',
            unread: true,
            actioned: false,
          });
          await log(jobId, 'info', 'Persisted AI summary to Supabase');
        } catch (summaryError) {
          await log(jobId, 'warn', 'Failed to persist AI summary', { error: summaryError });
        }

        await markStep(jobId, 'detect-changes', 'completed', { changeCount: changes.length });
        await markStep(jobId, 'smart-insights', 'running');
        await log(jobId, 'info', 'Running smart insights pipeline');
        try {
          const snapshotSummary = generateSnapshotSummary(
            fullSnapshot.metadata,
            {
              currentWar: fullSnapshot.currentWar,
              warLog: fullSnapshot.warLog,
              capitalRaidSeasons: fullSnapshot.capitalRaidSeasons,
            },
            0
          );

          const insightsBundle = await insightsEngine.processBundle(
            currentSnapshot,
            changes,
            clanTag,
            currentSnapshot.date,
            {
              source: 'nightly_cron',
              snapshotId: currentSnapshot.timestamp,
            }
          );

          insightsBundle.snapshotSummary = snapshotSummary;

          await saveInsightsBundle(insightsBundle);
          await log(jobId, 'info', 'Saved insights bundle');

          await cachePlayerDNAForClan(currentSnapshot, clanTag, currentSnapshot.date);
          await log(jobId, 'info', 'Cached player DNA profiles');
        } catch (aiError) {
          await log(jobId, 'error', 'Smart insights processing failed', { error: aiError });
        } finally {
          await markStep(jobId, 'smart-insights', 'completed');
        }
      } else {
        await markStep(jobId, 'detect-changes', 'completed', { changeCount: 0 });
      }
    }

    await markStep(jobId, 'resolve-players', 'running');
    await log(jobId, 'info', 'Resolving unknown players');
    const resolutionResult = await resolveUnknownPlayers();
    await markStep(jobId, 'resolve-players', 'completed', resolutionResult);
    await log(jobId, 'info', 'Resolve players completed', resolutionResult);

    const result: IngestionResult = {
      clanTag,
      success: true,
      memberCount: currentSnapshot.memberCount,
      changesDetected: changeSummary?.changes.length || 0,
      summary: changeSummary?.summary,
      gameChatMessages: changeSummary?.gameChatMessages || [],
      playersResolved: resolutionResult.resolved,
      resolutionErrors: resolutionResult.errors.length,
    };
    results.push(result);

    if (jobId) {
      await updateJobStatus(jobId, 'completed', result as Record<string, any>);
      await log(jobId, 'info', 'Ingestion completed');
    }
  } catch (error: any) {
    await log(jobId, 'error', 'Ingestion failed', { error });
    if (jobId) {
      await updateJobStatus(jobId, 'failed', { error: error.message || 'Ingestion failed' });
    }
    results.push({ clanTag, success: false, error: error.message || 'Ingestion failed' });
  }

  return results;
}
