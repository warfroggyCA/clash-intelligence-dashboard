import { cfg } from '@/lib/config';
import { fetchFullClanSnapshot } from '@/lib/full-snapshot';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { extractHeroLevels } from '@/lib/coc';
import { calculateRushPercentage } from '@/lib/business/calculations';
import { CURRENT_PIPELINE_SCHEMA_VERSION } from '@/lib/pipeline-constants';
import { Member, HeroCaps } from '@/types';
import { FullClanSnapshot, MemberSummary } from '@/lib/full-snapshot';
import { appendJobLog, createJobRecord, updateJobStatus, IngestionJobLogEntry } from './job-store';
import { readTenureDetails } from '@/lib/tenure';
import { daysSinceToDate } from '@/lib/date';
import { extractEnrichedFields } from './field-extractors';
import { createInitialTenureForJoiners } from '@/lib/services/tenure-service';
import { calculateAndStoreVIP } from './calculate-vip';

export interface StagedIngestionResult {
  success: boolean;
  clanTag: string;
    phases: {
      fetch: PhaseResult;
      transform: PhaseResult;
      upsertMembers: PhaseResult;
      writeSnapshot: PhaseResult;
      writeStats: PhaseResult;
      calculateVIP?: PhaseResult;
    };
  error?: string;
}

export interface PhaseResult {
  success: boolean;
  duration_ms: number;
  row_delta?: number;
  error_message?: string;
  metadata?: Record<string, any>;
}

export interface StagedIngestionOptions {
  clanTag?: string;
  jobId?: string;
  skipPhases?: string[];
}

/**
 * New staged ingestion pipeline following the roadmap phases:
 * 1. fetch - Get data from CoC API
 * 2. transform - Process and normalize data
 * 3. upsertMembers - Update member registry
 * 4. writeSnapshot - Store snapshot metadata
 * 5. writeStats - Calculate and store derived metrics
 */
export async function runStagedIngestion(options: StagedIngestionOptions = {}): Promise<StagedIngestionResult> {
  const { clanTag: providedTag, jobId: providedJobId, skipPhases = [] } = options;
  
  let clanTag = providedTag || cfg.homeClanTag;
  
  // CRITICAL SAFEGUARD: Prevent accidental use of wrong clan tag
  if (!clanTag || clanTag === '#G9QVRYC2Y') {
    console.error(`[StagedPipeline] INVALID CLAN TAG DETECTED: ${clanTag}. Forcing to #2PR8R8V8P`);
    clanTag = '#2PR8R8V8P';
  }
  
  if (!clanTag) {
    throw new Error('No clan tag provided');
  }
  
  console.log(`[StagedPipeline] Running ingestion for clan tag: ${clanTag}`);

  const jobId = providedJobId || crypto.randomUUID();
  
  // Initialize job record
  if (!providedJobId) {
    await createJobRecord(jobId, clanTag);
  }
  await updateJobStatus(jobId, 'running');
  await logPhase(jobId, 'pipeline', 'info', `Starting staged ingestion for ${clanTag}`);

  const result: StagedIngestionResult = {
    success: false,
    clanTag,
    phases: {
      fetch: { success: false, duration_ms: 0 },
      transform: { success: false, duration_ms: 0 },
      upsertMembers: { success: false, duration_ms: 0 },
      writeSnapshot: { success: false, duration_ms: 0 },
      writeStats: { success: false, duration_ms: 0 },
      calculateVIP: { success: false, duration_ms: 0 },
    },
  };

  let snapshot: FullClanSnapshot | null = null;
  let transformedData: TransformedData | null = null;

  try {
    // Phase 1: Fetch
    if (!skipPhases.includes('fetch')) {
      result.phases.fetch = await runFetchPhase(jobId, clanTag);
      if (!result.phases.fetch.success) {
        throw new Error(`Fetch phase failed: ${result.phases.fetch.error_message}`);
      }
      snapshot = result.phases.fetch.metadata?.snapshot as FullClanSnapshot;
    }

    // Phase 2: Transform
    if (!skipPhases.includes('transform') && snapshot) {
      result.phases.transform = await runTransformPhase(jobId, snapshot);
      if (!result.phases.transform.success) {
        throw new Error(`Transform phase failed: ${result.phases.transform.error_message}`);
      }
      transformedData = result.phases.transform.metadata?.transformedData as TransformedData;
    }

    // Phase 3: Upsert Members
    if (!skipPhases.includes('upsertMembers') && transformedData) {
      const snapshotDate = snapshot?.fetchedAt ? snapshot.fetchedAt.slice(0, 10) : undefined;
      result.phases.upsertMembers = await runUpsertMembersPhase(jobId, transformedData, snapshotDate);
      if (!result.phases.upsertMembers.success) {
        throw new Error(`Upsert members phase failed: ${result.phases.upsertMembers.error_message}`);
      }
    }

    // Phase 4: Write Snapshot
    if (!skipPhases.includes('writeSnapshot') && snapshot && transformedData) {
      result.phases.writeSnapshot = await runWriteSnapshotPhase(jobId, snapshot, transformedData);
      if (!result.phases.writeSnapshot.success) {
        throw new Error(`Write snapshot phase failed: ${result.phases.writeSnapshot.error_message}`);
      }
    }

    // Phase 5: Write Stats
    if (!skipPhases.includes('writeStats') && transformedData && snapshot) {
      result.phases.writeStats = await runWriteStatsPhase(jobId, transformedData, snapshot);
      if (!result.phases.writeStats.success) {
        throw new Error(`Write stats phase failed: ${result.phases.writeStats.error_message}`);
      }
    }

    // Phase 6: Calculate VIP (only on Mondays after stats are written)
    if (!skipPhases.includes('calculateVIP') && snapshot) {
      const snapshotDate = snapshot.fetchedAt ? new Date(snapshot.fetchedAt) : null;
      if (snapshotDate) {
        const vipResult = await calculateAndStoreVIP(jobId, snapshotDate);
        result.phases.calculateVIP = {
          success: vipResult.success,
          duration_ms: 0, // Will be tracked inside calculateAndStoreVIP if needed
          row_delta: vipResult.scoresCalculated,
          error_message: vipResult.error,
        };
        if (!vipResult.success && vipResult.error) {
          // Log but don't fail pipeline - VIP calculation is optional
          await logPhase(jobId, 'calculateVIP', 'warn', `VIP calculation had issues: ${vipResult.error}`);
        } else if (vipResult.scoresCalculated > 0) {
          await logPhase(jobId, 'calculateVIP', 'info', `VIP calculated for ${vipResult.scoresCalculated} members`);
        }
      }
    }

    result.success = true;
    const writeSnapshotMetadata = result.phases.writeSnapshot?.metadata ?? {};
    const totalDurationMs = Object.values(result.phases).reduce((sum, phase) => sum + (phase?.duration_ms ?? 0), 0);
    const anomalies = Object.entries(result.phases)
      .filter(([name, phase]) => {
        if (!phase) return false;
        if (!phase.success) return true;
        if ((name === 'upsertMembers' || name === 'writeStats') && typeof phase.row_delta === 'number' && phase.row_delta === 0) {
          return true;
        }
        return false;
      })
      .map(([name, phase]) => ({ phase: name, message: phase?.error_message ?? 'row_delta 0' }));

    (result as any).anomalies = anomalies;

    await updateJobStatus(jobId, 'completed', {
      totalDurationMs,
      anomalies,
      payloadVersion: writeSnapshotMetadata?.payloadVersion ?? null,
      ingestionVersion: writeSnapshotMetadata?.ingestionVersion ?? 'staged-pipeline-v1',
      schemaVersion: CURRENT_PIPELINE_SCHEMA_VERSION,
      fetchedAt: writeSnapshotMetadata?.fetchedAt ?? snapshot?.fetchedAt ?? null,
      computedAt: writeSnapshotMetadata?.computedAt ?? null,
    });
    await logPhase(jobId, 'pipeline', 'info', 'Staged ingestion completed successfully');

  } catch (error: any) {
    result.success = false;
    result.error = error.message;
    await updateJobStatus(jobId, 'failed', {
      totalDurationMs: Object.values(result.phases).reduce((sum, phase) => sum + (phase?.duration_ms ?? 0), 0),
      anomalies: [{ phase: 'pipeline', message: error.message }],
    });
    await logPhase(jobId, 'pipeline', 'error', `Staged ingestion failed: ${error.message}`);
  }

  return result;
}

type HeroLevels = Partial<Record<keyof HeroCaps, number | null>>;

interface TransformedData {
  clanData: ClanData;
  memberData: MemberData[];
  snapshotStats: SnapshotStats[];
}

interface ClanData {
  tag: string;
  name: string;
  logo_url: string;
}

interface MemberData {
  tag: string;
  name: string;
  townHallLevel: number;
  role: string;
  league: any;
  builderBaseLeague: any;
  // New typed fields
  league_id?: number;
  league_name?: string;
  league_trophies?: number;
  league_icon_small?: string;
  league_icon_medium?: string;
  battle_mode_trophies?: number;
  ranked_trophies?: number;
  ranked_league_id?: number;
  ranked_league_name?: string;
  ranked_modifier?: any;
  equipment_flags?: any;
  trophies?: number | null;
  donations?: number | null;
  donations_received?: number | null;
  hero_levels?: HeroLevels | null;
  rush_percent?: number | null;
  extras?: any;
  tenure_days?: number | null;
  tenure_as_of?: string | null;
  tournamentStats?: Member['tournamentStats'] | null;
  tournamentFinalTrophies?: number | null;
}

interface SnapshotStats {
  member_id: string;
  th_level: number;
  role: string;
  trophies: number;
  donations: number;
  donations_received: number;
  hero_levels: HeroLevels | null;
  activity_score: number | null;
  rush_percent: number | null;
  extras: any;
  // New typed fields
  league_id?: number;
  league_name?: string;
  league_trophies?: number;
  battle_mode_trophies?: number;
  ranked_trophies?: number;
  ranked_league_id?: number;
  ranked_modifier?: any;
  equipment_flags?: any;
  tenure_days?: number | null;
  tenure_as_of?: string | null;
  // Enriched fields (October 2025 data enrichment)
  pet_levels?: Record<string, number> | null;
  builder_hall_level?: number | null;
  versus_trophies?: number | null;
  versus_battle_wins?: number | null;
  builder_league_id?: number | null;
  war_stars?: number | null;
  attack_wins?: number | null;
  defense_wins?: number | null;
  capital_contributions?: number | null;
  max_troop_count?: number | null;
  max_spell_count?: number | null;
  super_troops_active?: string[] | null;
  achievement_count?: number | null;
  achievement_score?: number | null;
  exp_level?: number | null;
  best_trophies?: number | null;
  best_versus_trophies?: number | null;
}

function getAchievementValue(detail: any, name: string): number | null {
  if (!detail?.achievements) return null;
  const entry = detail.achievements.find((achievement: any) => achievement?.name === name);
  return typeof entry?.value === 'number' ? entry.value : null;
}

function deriveDonations(summary: MemberSummary, detail: any) {
  const donations = summary.donations ?? detail?.donations ?? getAchievementValue(detail, 'Friend in Need');
  // Some snapshots expose donationsReceived as `donationsReceived`, others via achievements
  const donationsReceived = summary.donationsReceived
    ?? detail?.donationsReceived
    ?? getAchievementValue(detail, 'Sharing is Caring');

  return {
    donations: typeof donations === 'number' ? donations : null,
    donationsReceived: typeof donationsReceived === 'number' ? donationsReceived : null,
  };
}

function buildHeroLevels(detail: any): HeroLevels | null {
  if (!detail) return null;
  try {
    const levels = extractHeroLevels(detail);
    return {
      bk: levels.bk ?? null,
      aq: levels.aq ?? null,
      gw: levels.gw ?? null,
      rc: levels.rc ?? null,
      mp: levels.mp ?? null,
    };
  } catch (error) {
    console.warn('[staged-ingestion] Failed to extract hero levels', error);
    return null;
  }
}

function computeRushPercent(thLevel: number | undefined, heroLevels: HeroLevels | null): number | null {
  if (!thLevel || !heroLevels) return null;
  const syntheticMember: Partial<Member> = {
    townHallLevel: thLevel,
    bk: heroLevels.bk ?? 0,
    aq: heroLevels.aq ?? 0,
    gw: heroLevels.gw ?? 0,
    rc: heroLevels.rc ?? 0,
    mp: heroLevels.mp ?? 0,
  };
  try {
    return calculateRushPercentage(syntheticMember as Member);
  } catch (error) {
    console.warn('[staged-ingestion] Failed to compute rush percent', error);
    return null;
  }
}

function buildExtras(summary: MemberSummary, detail: any) {
  return {
    builderHallLevel: summary.builderHallLevel ?? detail?.builderHallLevel ?? null,
    townHallWeaponLevel: summary.townHallWeaponLevel ?? detail?.townHallWeaponLevel ?? null,
    builderTrophies: summary.builderTrophies ?? detail?.versusTrophies ?? null,
    clanRank: summary.clanRank ?? null,
    previousClanRank: summary.previousClanRank ?? null,
  };
}

const DERIVED_METRIC_NAMES = ['rush_percent', 'donation_balance', 'donations_given', 'donations_received'] as const;
type DerivedMetricName = (typeof DERIVED_METRIC_NAMES)[number];

async function writeDerivedMetrics(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  clanId: string,
  snapshotId: string,
  stats: SnapshotStats[],
): Promise<number> {
  if (!stats.length) return 0;

  const deleteResponse = await supabase
    .from('metrics')
    .delete()
    .eq('clan_id', clanId)
    .eq('metric_window', 'latest')
    .in('metric_name', DERIVED_METRIC_NAMES as unknown as string[]);

  if (deleteResponse.error) {
    console.warn('[staged-ingestion] Failed to prune existing derived metrics', deleteResponse.error);
  }

  const now = new Date().toISOString();
  const inserts: Array<{
    clan_id: string;
    member_id: string;
    metric_name: DerivedMetricName;
    metric_window: string;
    value: number;
    metadata: Record<string, any> | null;
    computed_at: string;
  }> = [];

  for (const stat of stats) {
    if (!stat?.member_id) continue;

    const donations = typeof stat.donations === 'number' ? stat.donations : 0;
    const donationsReceived = typeof stat.donations_received === 'number' ? stat.donations_received : 0;
    const donationBalance = donations - donationsReceived;

    const baseMetadata = {
      snapshotId,
      leagueId: stat.league_id ?? null,
      trophies: stat.trophies ?? null,
      donations,
      donationsReceived,
    };

    if (typeof stat.rush_percent === 'number') {
      inserts.push({
        clan_id: clanId,
        member_id: stat.member_id,
        metric_name: 'rush_percent',
        metric_window: 'latest',
        value: stat.rush_percent,
        metadata: baseMetadata,
        computed_at: now,
      });
    }

    inserts.push({
      clan_id: clanId,
      member_id: stat.member_id,
      metric_name: 'donation_balance',
      metric_window: 'latest',
      value: donationBalance,
      metadata: baseMetadata,
      computed_at: now,
    });

    inserts.push({
      clan_id: clanId,
      member_id: stat.member_id,
      metric_name: 'donations_given',
      metric_window: 'latest',
      value: donations,
      metadata: baseMetadata,
      computed_at: now,
    });

    inserts.push({
      clan_id: clanId,
      member_id: stat.member_id,
      metric_name: 'donations_received',
      metric_window: 'latest',
      value: donationsReceived,
      metadata: baseMetadata,
      computed_at: now,
    });
  }

  if (!inserts.length) {
    return 0;
  }

  const { error } = await supabase
    .from('metrics')
    .insert(inserts);

  if (error) {
    console.warn('[staged-ingestion] Failed to insert derived metrics', error);
    return 0;
  }

  return inserts.length;
}

async function runFetchPhase(jobId: string, clanTag: string): Promise<PhaseResult> {
  const startTime = Date.now();
  
  try {
    await logPhase(jobId, 'fetch', 'info', 'Fetching full clan snapshot from CoC API');
    
    const snapshot = await fetchFullClanSnapshot(clanTag, {
      warLogLimit: 10,
      capitalSeasonLimit: 3,
      includePlayerDetails: true,
    });

    const duration_ms = Date.now() - startTime;
    
    await logPhase(jobId, 'fetch', 'info', 'Fetch phase completed', {
      memberCount: snapshot.memberSummaries.length,
      warLogEntries: snapshot.metadata.warLogEntries,
      playerDetailSuccessCount: snapshot.metadata.playerDetailSuccessCount ?? 0,
      playerDetailFailureCount: snapshot.metadata.playerDetailFailureCount ?? 0,
      playerDetailFailures: snapshot.metadata.playerDetailFailures ?? [],
    });

    return {
      success: true,
      duration_ms,
      metadata: { snapshot },
    };
  } catch (error: any) {
    const duration_ms = Date.now() - startTime;
    await logPhase(jobId, 'fetch', 'error', `Fetch phase failed: ${error.message}`);
    
    return {
      success: false,
      duration_ms,
      error_message: error.message,
    };
  }
}

async function runTransformPhase(jobId: string, snapshot: FullClanSnapshot): Promise<PhaseResult> {
  const startTime = Date.now();
  
  try {
    await logPhase(jobId, 'transform', 'info', 'Transforming and normalizing data');
    
    const clanData: ClanData = {
      tag: normalizeTag(snapshot.clanTag),
      name: snapshot.clan?.name || '',
      logo_url: pickLargestBadge(snapshot.clan),
    };

    const snapshotDate = snapshot.fetchedAt ? snapshot.fetchedAt.slice(0, 10) : undefined;
    const tenureDetails = await readTenureDetails(snapshotDate);

    const memberData: MemberData[] = snapshot.memberSummaries.map((summary) => {
      const normalized = normalizeTag(summary.tag);
      const detail = snapshot.playerDetails?.[normalized];
      const league = summary.league || detail?.league;
      const leagueTier = detail?.leagueTier; // NEW: Extract ranked league tier
      const { donations, donationsReceived } = deriveDonations(summary, detail);
      const heroLevels = buildHeroLevels(detail);
      const rushPercent = computeRushPercent(summary.townHallLevel ?? detail?.townHallLevel, heroLevels);
      const trophies = summary.trophies ?? detail?.trophies ?? null;
      const extras = buildExtras(summary, detail);
      const tournamentStats = detail?.tournamentStats ?? null;
      let tournamentFinalTrophies: number | null = null;
      if (tournamentStats && typeof tournamentStats === 'object') {
        const offensive = Number((tournamentStats as any).offTrophies ?? 0);
        const defensive = Number((tournamentStats as any).defTrophies ?? 0);
        const combined = offensive + defensive;
        if (Number.isFinite(combined) && combined > 0) {
          tournamentFinalTrophies = combined;
        }
      }
      const tenureEntry = tenureDetails[normalized];
      const tenureDays = typeof tenureEntry?.days === 'number' ? tenureEntry.days : null;
      const tenureAsOf = tenureEntry?.as_of ?? snapshotDate ?? null;
      
      return {
        tag: normalized,
        name: summary.name || '',
        townHallLevel: summary.townHallLevel ?? detail?.townHallLevel ?? 1,
        role: summary.role || '',
        league,
        builderBaseLeague: detail?.builderBaseLeague,
        // Extract typed league fields
        league_id: league?.id,
        league_name: league?.name,
        league_trophies: league?.trophies,
        league_icon_small: league?.iconUrls?.small,
        league_icon_medium: league?.iconUrls?.medium,
        battle_mode_trophies: league?.trophies, // TODO: Split when battle mode data is available
        ranked_trophies: league?.trophies, // TODO: Split when ranked data is available
        ranked_league_id: leagueTier?.id ?? null, // FIXED: Use leagueTier instead of league
        ranked_league_name: leagueTier?.name ?? null, // FIXED: Use leagueTier instead of league
        ranked_modifier: league?.modifier,
        equipment_flags: detail?.equipment,
        trophies,
        donations,
        donations_received: donationsReceived,
        hero_levels: heroLevels,
        rush_percent: rushPercent,
        extras,
        tenure_days: tenureDays,
        tenure_as_of: tenureAsOf,
        tournamentStats: tournamentStats ?? null,
        tournamentFinalTrophies,
      };
    });

    const transformedData: TransformedData = {
      clanData,
      memberData,
      snapshotStats: [], // Will be populated in writeStats phase
    };

    const duration_ms = Date.now() - startTime;
    
    await logPhase(jobId, 'transform', 'info', 'Transform phase completed', {
      memberCount: memberData.length,
      clansProcessed: 1,
    });

    return {
      success: true,
      duration_ms,
      metadata: { transformedData },
    };
  } catch (error: any) {
    const duration_ms = Date.now() - startTime;
    await logPhase(jobId, 'transform', 'error', `Transform phase failed: ${error.message}`);
    
    return {
      success: false,
      duration_ms,
      error_message: error.message,
    };
  }
}

async function runUpsertMembersPhase(jobId: string, transformedData: TransformedData, snapshotDate?: string): Promise<PhaseResult> {
  const startTime = Date.now();
  
  try {
    await logPhase(jobId, 'upsertMembers', 'info', 'Upserting clan and member data');
    
    const supabase = getSupabaseAdminClient();
    
    // Upsert clan
    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .upsert({
        tag: transformedData.clanData.tag,
        name: transformedData.clanData.name,
        logo_url: transformedData.clanData.logo_url,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tag' })
      .select('id, tag')
      .single();

    if (clanError) {
      throw new Error(`Failed to upsert clan: ${clanError.message}`);
    }

    const { data: existingMemberRows, error: existingMembersError } = await supabase
      .from('members')
      .select('tag')
      .eq('clan_id', clanRow.id);

    if (existingMembersError) {
      throw new Error(`Failed to read existing members: ${existingMembersError.message}`);
    }

    const existingTags = new Set(
      (existingMemberRows ?? [])
        .map((row) => normalizeTag(row.tag))
        .filter((tag): tag is string => Boolean(tag))
    );

    const memberMapByTag = new Map(
      transformedData.memberData
        .map((member) => {
          const normalized = normalizeTag(member.tag);
          return normalized ? [normalized, member] as const : null;
        })
        .filter((entry): entry is readonly [string, MemberData] => entry !== null)
    );

    const newlyJoinedTags = Array.from(memberMapByTag.keys()).filter((tag) => !existingTags.has(tag));

    // Upsert members with new typed fields
    const memberUpserts = transformedData.memberData.map((member) => ({
      clan_id: clanRow.id,
      tag: member.tag,
      name: member.name,
      th_level: member.townHallLevel,
      role: member.role,
      league: member.league, // Keep legacy field for compatibility
      builder_league: member.builderBaseLeague,
      // New typed fields
      league_id: member.league_id,
      league_name: member.league_name,
      league_trophies: member.league_trophies,
      league_icon_small: member.league_icon_small,
      league_icon_medium: member.league_icon_medium,
      battle_mode_trophies: member.battle_mode_trophies,
      ranked_trophies: member.ranked_trophies,
      ranked_league_id: member.ranked_league_id,
      ranked_league_name: member.ranked_league_name,
      ranked_modifier: member.ranked_modifier,
      equipment_flags: member.equipment_flags,
      tenure_days: member.tenure_days ?? null,
      tenure_as_of: member.tenure_as_of ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { data: memberRows, error: memberError } = await supabase
      .from('members')
      .upsert(memberUpserts, { onConflict: 'clan_id,tag' })
      .select('id, tag');

    if (memberError) {
      throw new Error(`Failed to upsert members: ${memberError.message}`);
    }

    if (newlyJoinedTags.length > 0) {
      await recordJoinerEvents({
        supabase,
        clanTag: transformedData.clanData.tag,
        joinerTags: newlyJoinedTags,
        memberLookup: memberMapByTag,
      });

      // Create initial tenure entries for new joiners
      await createInitialTenureForJoiners({
        supabase,
        clanTag: transformedData.clanData.tag,
        joinerTags: newlyJoinedTags,
        joinDate: snapshotDate || new Date().toISOString().slice(0, 10),
        memberLookup: memberMapByTag,
      });
    }

    const duration_ms = Date.now() - startTime;
    
    await logPhase(jobId, 'upsertMembers', 'info', 'Upsert members phase completed', {
      membersUpserted: memberRows?.length || 0,
    });

    return {
      success: true,
      duration_ms,
      row_delta: memberRows?.length || 0,
      metadata: { memberRows },
    };
  } catch (error: any) {
    const duration_ms = Date.now() - startTime;
    await logPhase(jobId, 'upsertMembers', 'error', `Upsert members phase failed: ${error.message}`);
    
    return {
      success: false,
      duration_ms,
      error_message: error.message,
    };
  }
}

async function recordJoinerEvents(params: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  clanTag: string;
  joinerTags: string[];
  memberLookup: Map<string, MemberData>;
}) {
  const { supabase, clanTag, joinerTags, memberLookup } = params;
  if (!joinerTags.length) return;

  const detectedAt = new Date().toISOString();

  const { data: existingHistoryRows, error: historyError } = await supabase
    .from('player_history')
    .select('*')
    .eq('clan_tag', clanTag)
    .in('player_tag', joinerTags);

  if (historyError) {
    throw new Error(`Failed to load player history for joiners: ${historyError.message}`);
  }

  const historyMap = new Map(
    (existingHistoryRows ?? []).map((row) => [row.player_tag, row])
  );

  const joinMovement = {
    type: 'joined',
    date: detectedAt,
    notes: 'Detected by nightly roster ingestion',
  };

  const historyUpserts = joinerTags.map((tag) => {
    const existing = historyMap.get(tag);
    const member = memberLookup.get(tag);
    const movements = Array.isArray(existing?.movements) ? [...existing.movements] : [];
    const alreadyLogged = movements.some(
      (movement: any) => movement?.type === 'joined' && movement?.date === detectedAt
    );
    if (!alreadyLogged) {
      movements.push(joinMovement);
    }

    const aliases = Array.isArray(existing?.aliases) ? existing.aliases : [];
    const notes = Array.isArray(existing?.notes) ? existing.notes : [];

    return {
      clan_tag: clanTag,
      player_tag: tag,
      primary_name: member?.name || existing?.primary_name || tag,
      status: 'active' as const,
      total_tenure: existing?.total_tenure ?? 0,
      current_stint: { startDate: detectedAt, isActive: true },
      movements,
      aliases,
      notes,
    };
  });

  const { error: upsertHistoryError } = await supabase
    .from('player_history')
    .upsert(historyUpserts, { onConflict: 'clan_tag,player_tag' });

  if (upsertHistoryError) {
    throw new Error(`Failed to upsert player history for joiners: ${upsertHistoryError.message}`);
  }

  const joinerInserts = joinerTags.map((tag) => {
    const member = memberLookup.get(tag);
    return {
      clan_tag: clanTag,
      player_tag: tag,
      detected_at: detectedAt,
      source_snapshot_id: null,
      metadata: {
        name: member?.name ?? null,
        role: member?.role ?? null,
        townHallLevel: member?.townHallLevel ?? null,
        trophies: member?.trophies ?? null,
      },
    };
  });

  const { error: joinerError } = await supabase
    .from('joiner_events')
    .upsert(joinerInserts, { onConflict: 'clan_tag,player_tag,detected_at' });

  if (joinerError) {
    throw new Error(`Failed to record joiner events: ${joinerError.message}`);
  }
}

async function runWriteSnapshotPhase(jobId: string, snapshot: FullClanSnapshot, transformedData: TransformedData): Promise<PhaseResult> {
  const startTime = Date.now();
  
  try {
    await logPhase(jobId, 'writeSnapshot', 'info', 'Writing roster snapshot');
    
    const supabase = getSupabaseAdminClient();
    
    // Get clan ID
    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id')
      .eq('tag', transformedData.clanData.tag)
      .single();

    if (clanError) {
      throw new Error(`Failed to get clan ID: ${clanError.message}`);
    }

    const totalTrophies = transformedData.memberData.reduce((sum, m) => sum + (m.trophies || 0), 0);
    const totalDonations = transformedData.memberData.reduce((sum, m) => sum + (m.donations || 0), 0);
    
    // Generate payload version for cache governance
    const payloadVersion = generatePayloadVersion(snapshot, transformedData);
    
    const seasonInfo = calculateSeasonInfo(snapshot.fetchedAt);
    const metadata = {
      ...(snapshot.metadata ?? {}),
      schemaVersion: CURRENT_PIPELINE_SCHEMA_VERSION,
      ingestionVersion: 'staged-pipeline-v1',
      seasonId: seasonInfo.seasonId,
      seasonStart: seasonInfo.seasonStart,
      seasonEnd: seasonInfo.seasonEnd,
    };

    const snapshotData = {
      clan_id: clanRow.id,
      fetched_at: snapshot.fetchedAt,
      member_count: transformedData.memberData.length,
      total_trophies: totalTrophies,
      total_donations: totalDonations,
      payload: snapshot,
      metadata,
      // New versioning fields
      payload_version: payloadVersion,
      ingestion_version: 'staged-pipeline-v1',
      schema_version: CURRENT_PIPELINE_SCHEMA_VERSION,
      computed_at: new Date().toISOString(),
    };

    const { data: insertedSnapshot, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .insert(snapshotData)
      .select('id')
      .single();

    if (snapshotError) {
      throw new Error(`Failed to write snapshot: ${snapshotError.message}`);
    }

    const duration_ms = Date.now() - startTime;
    
    const computedAt = snapshotData.computed_at;
    const phaseMetadata = {
      snapshotId: insertedSnapshot.id,
      payloadVersion,
      fetchedAt: snapshot.fetchedAt,
      computedAt,
      seasonId: metadata?.seasonId ?? null,
      ingestionVersion: snapshotData.ingestion_version,
      schemaVersion: snapshotData.schema_version,
    };

    await logPhase(jobId, 'writeSnapshot', 'info', 'Write snapshot phase completed', phaseMetadata);

    return {
      success: true,
      duration_ms,
      metadata: {
        ...phaseMetadata,
        snapshotDate: snapshot.fetchedAt ?? null,
      },
    };
  } catch (error: any) {
    const duration_ms = Date.now() - startTime;
    await logPhase(jobId, 'writeSnapshot', 'error', `Write snapshot phase failed: ${error.message}`);
    
    return {
      success: false,
      duration_ms,
      error_message: error.message,
    };
  }
}

async function runWriteStatsPhase(jobId: string, transformedData: TransformedData, snapshot: FullClanSnapshot): Promise<PhaseResult> {
  const startTime = Date.now();
  
  try {
    await logPhase(jobId, 'writeStats', 'info', 'Writing member snapshot stats');
    
    const supabase = getSupabaseAdminClient();
    
    const { data: clanRow, error: clanError } = await supabase
      .from('clans')
      .select('id')
      .eq('tag', transformedData.clanData.tag)
      .single();

    if (clanError) {
      throw new Error(`Failed to resolve clan: ${clanError.message}`);
    }

    // Get latest snapshot ID
    const { data: latestSnapshot, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .select('id, clan_id')
      .eq('clan_id', clanRow.id)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    if (snapshotError) {
      throw new Error(`Failed to get latest snapshot: ${snapshotError.message}`);
    }

    // Get member IDs
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('id, tag')
      .eq('clan_id', latestSnapshot.clan_id);

    if (membersError) {
      throw new Error(`Failed to get members: ${membersError.message}`);
    }

    const memberIdByTag = new Map<string, string>();
    for (const member of members || []) {
      memberIdByTag.set(member.tag, member.id);
    }

    // Remove existing stats for this snapshot to avoid duplicates on reruns
    await supabase.from('member_snapshot_stats').delete().eq('snapshot_id', latestSnapshot.id);

    // Build snapshot stats with new typed fields
    const snapshotDate = snapshot.fetchedAt ? snapshot.fetchedAt.slice(0, 10) : undefined;
    const tenureDetails = await readTenureDetails(snapshotDate);

    const snapshotStats = transformedData.memberData.map((member) => {
      const memberId = memberIdByTag.get(member.tag);
      if (!memberId) return null;

       const tenureEntry = tenureDetails[member.tag];
       const tenureAsOf = member.tenure_as_of ?? tenureEntry?.as_of ?? snapshotDate ?? null;
       const tenureFromEntry = typeof tenureEntry?.days === 'number' ? tenureEntry.days : null;
       let tenureDays = typeof member.tenure_days === 'number' ? member.tenure_days : tenureFromEntry;
       if (tenureDays == null && tenureAsOf) {
         const targetDate = snapshotDate ?? new Date().toISOString().slice(0, 10);
         const delta = daysSinceToDate(tenureAsOf, targetDate);
         tenureDays = delta >= 0 ? delta + 1 : null;
       }
       const normalizedTenure = tenureDays != null ? Math.max(1, Math.round(tenureDays)) : null;

      // Extract enriched fields from player detail
      const normalized = normalizeTag(member.tag);
      const detail = snapshot.playerDetails?.[normalized];
      const enriched = extractEnrichedFields(detail);

      const tournamentStats = member.tournamentStats ?? null;
      let tournamentFinal = member.tournamentFinalTrophies ?? null;
      if ((tournamentFinal == null || tournamentFinal <= 0) && tournamentStats && typeof tournamentStats === 'object') {
        const offensive = Number((tournamentStats as any).offTrophies ?? 0);
        const defensive = Number((tournamentStats as any).defTrophies ?? 0);
        const combined = offensive + defensive;
        if (Number.isFinite(combined) && combined > 0) {
          tournamentFinal = combined;
        }
      }
      const currentRanked =
        typeof member.ranked_trophies === 'number'
          ? member.ranked_trophies
          : typeof member.battle_mode_trophies === 'number'
            ? member.battle_mode_trophies
            : typeof member.trophies === 'number'
              ? member.trophies
              : 0;
      const rankedSnapshotValue = tournamentFinal != null && tournamentFinal > 0 ? tournamentFinal : currentRanked;
      const extrasPayload = {
        ...(member.extras ?? {}),
        tournamentStats: tournamentStats ?? null,
        tournamentFinalTrophies: tournamentFinal,
        currentRankedTrophies: currentRanked,
      };

      return {
        snapshot_id: latestSnapshot.id,
        member_id: memberId,
        snapshot_date: snapshot.fetchedAt, // Add snapshot_date for weekly tracking
        th_level: member.townHallLevel,
        role: member.role,
        trophies: member.trophies ?? 0,
        donations: member.donations ?? 0,
        donations_received: member.donations_received ?? 0,
        hero_levels: member.hero_levels ?? null,
        activity_score: null,
        rush_percent: member.rush_percent ?? null,
        extras: extrasPayload,
        // New typed fields
        league_id: member.league_id,
        league_name: member.league_name,
        league_trophies: member.league_trophies,
        battle_mode_trophies: currentRanked,
        ranked_trophies: rankedSnapshotValue,
        ranked_league_id: member.ranked_league_id,
        ranked_modifier: member.ranked_modifier,
        equipment_flags: enriched.equipmentLevels ?? member.equipment_flags, // Use enriched equipment levels
        tenure_days: normalizedTenure,
        tenure_as_of: tenureAsOf,
        // Enriched fields (October 2025 data enrichment)
        pet_levels: enriched.petLevels,
        builder_hall_level: enriched.builderHallLevel,
        versus_trophies: enriched.versusTrophies,
        versus_battle_wins: enriched.versusBattleWins,
        builder_league_id: enriched.builderLeagueId,
        war_stars: enriched.warStars,
        attack_wins: enriched.attackWins,
        defense_wins: enriched.defenseWins,
        capital_contributions: enriched.capitalContributions,
        max_troop_count: enriched.maxTroopCount,
        max_spell_count: enriched.maxSpellCount,
        super_troops_active: enriched.superTroopsActive,
        achievement_count: enriched.achievementCount,
        achievement_score: enriched.achievementScore,
        exp_level: enriched.expLevel,
        best_trophies: enriched.bestTrophies,
        best_versus_trophies: enriched.bestVersusTrophies,
      };
    }).filter(Boolean) as SnapshotStats[];

    if (snapshotStats.length) {
      const { error: statsError } = await supabase
        .from('member_snapshot_stats')
        .insert(snapshotStats);

      if (statsError) {
        throw new Error(`Failed to insert snapshot stats: ${statsError.message}`);
      }
    }

    const metricsInserted = await writeDerivedMetrics(
      supabase,
      latestSnapshot.clan_id,
      latestSnapshot.id,
      snapshotStats,
    );

    // Write canonical_member_snapshots for API consumption
    await logPhase(jobId, 'writeStats', 'info', 'Writing canonical member snapshots');
    const { buildCanonicalMemberSnapshot } = await import('@/lib/canonical-member');
    const snapshotDate = snapshot.fetchedAt ? snapshot.fetchedAt.slice(0, 10) : null;
    const totalTrophies = transformedData.memberData.reduce((sum, m) => sum + (m.trophies || 0), 0);
    const totalDonations = transformedData.memberData.reduce((sum, m) => sum + (m.donations || 0), 0);
    
    const canonicalRows = transformedData.memberData.map((member) => {
      const normalized = normalizeTag(member.tag);
      const detail = snapshot.playerDetails?.[normalized];
      const enriched = extractEnrichedFields(detail);
      
      // Get league icons - use extracted fields if available, otherwise fall back to detail
      const leagueIconSmall = member.league_icon_small ?? detail?.league?.iconUrls?.small ?? detail?.league?.badgeUrls?.small ?? null;
      const leagueIconMedium = member.league_icon_medium ?? detail?.league?.iconUrls?.medium ?? detail?.league?.badgeUrls?.medium ?? null;
      const rankedIconSmall = detail?.leagueTier?.iconUrls?.small ?? detail?.leagueTier?.badgeUrls?.small ?? null;
      const rankedIconMedium = detail?.leagueTier?.iconUrls?.medium ?? detail?.leagueTier?.badgeUrls?.medium ?? null;
      
      const tournamentStats = member.tournamentStats ?? null;
      let tournamentFinalTrophies: number | null = null;
      if (tournamentStats && typeof tournamentStats === 'object') {
        const offensive = Number((tournamentStats as any).offTrophies ?? 0);
        const defensive = Number((tournamentStats as any).defTrophies ?? 0);
        const combined = offensive + defensive;
        if (Number.isFinite(combined) && combined > 0) {
          tournamentFinalTrophies = combined;
        }
      }
      const currentRanked = member.ranked_trophies ?? member.battle_mode_trophies ?? member.trophies ?? 0;
      const rankedSnapshotValue = tournamentFinalTrophies != null && tournamentFinalTrophies > 0 
        ? tournamentFinalTrophies 
        : currentRanked;
      
      const canonicalSnapshot = buildCanonicalMemberSnapshot({
        clanTag: transformedData.clanData.tag,
        clanName: transformedData.clanData.name,
        snapshotId: latestSnapshot.id,
        fetchedAt: snapshot.fetchedAt,
        computedAt: snapshot.metadata?.computedAt ?? null,
        memberCount: transformedData.memberData.length,
        totalTrophies,
        totalDonations,
        member: {
          tag: normalized,
          name: member.name ?? null,
          role: member.role ?? null,
          townHallLevel: member.townHallLevel ?? null,
          trophies: member.trophies ?? null,
          battleModeTrophies: currentRanked ?? null,
          league: member.league_id != null || member.league_name != null ? {
            id: member.league_id ?? null,
            name: member.league_name ?? null,
            trophies: member.league_trophies ?? null,
            iconSmall: leagueIconSmall,
            iconMedium: leagueIconMedium,
          } : null,
          ranked: {
            trophies: rankedSnapshotValue ?? null,
            leagueId: member.ranked_league_id ?? null,
            leagueName: member.ranked_league_name ?? null,
            iconSmall: rankedIconSmall,
            iconMedium: rankedIconMedium,
          },
          donations: {
            given: member.donations ?? null,
            received: member.donations_received ?? null,
          },
          activityScore: null, // Will be calculated on read if needed
          heroLevels: member.hero_levels ?? null,
          rushPercent: member.rush_percent ?? null,
          war: {
            stars: enriched.warStars ?? null,
            attackWins: enriched.attackWins ?? null,
            defenseWins: enriched.defenseWins ?? null,
          },
          builderBase: {
            hallLevel: enriched.builderHallLevel ?? null,
            trophies: enriched.versusTrophies ?? null,
            battleWins: enriched.versusBattleWins ?? null,
            leagueId: enriched.builderLeagueId ?? null,
          },
          capitalContributions: enriched.capitalContributions ?? null,
          pets: enriched.petLevels ?? null,
          equipmentLevels: enriched.equipmentLevels ?? null,
          achievements: {
            count: enriched.achievementCount ?? null,
            score: enriched.achievementScore ?? null,
          },
          expLevel: enriched.expLevel ?? null,
          bestTrophies: enriched.bestTrophies ?? null,
          bestVersusTrophies: enriched.bestVersusTrophies ?? null,
          superTroopsActive: enriched.superTroopsActive ?? null,
          tenure: {
            days: snapshotStats.find(s => s.member_id === memberIdByTag.get(normalized))?.tenure_days ?? null,
            asOf: snapshotStats.find(s => s.member_id === memberIdByTag.get(normalized))?.tenure_as_of ?? null,
          },
          extras: member.extras ?? null,
        },
      });
      
      return {
        clan_tag: transformedData.clanData.tag,
        player_tag: normalized,
        snapshot_id: latestSnapshot.id,
        snapshot_date: canonicalSnapshot.snapshotDate,
        schema_version: canonicalSnapshot.schemaVersion,
        payload: canonicalSnapshot,
      };
    }).filter(Boolean);
    
    if (canonicalRows.length > 0) {
      const { error: canonicalError } = await supabase
        .from('canonical_member_snapshots')
        .upsert(canonicalRows, { onConflict: 'snapshot_id,player_tag', ignoreDuplicates: false });
      
      if (canonicalError) {
        await logPhase(jobId, 'writeStats', 'warn', `Failed to upsert canonical snapshots: ${canonicalError.message}`);
      } else {
        await logPhase(jobId, 'writeStats', 'info', `Wrote ${canonicalRows.length} canonical snapshots`);
      }
    }

    const duration_ms = Date.now() - startTime;
    
    await logPhase(jobId, 'writeStats', 'info', 'Write stats phase completed', {
      statsInserted: snapshotStats.length,
      metricsInserted,
      canonicalSnapshotsInserted: canonicalRows.length,
    });

    return {
      success: true,
      duration_ms,
      row_delta: snapshotStats.length,
    };
  } catch (error: any) {
    const duration_ms = Date.now() - startTime;
    await logPhase(jobId, 'writeStats', 'error', `Write stats phase failed: ${error.message}`);
    
    return {
      success: false,
      duration_ms,
      error_message: error.message,
    };
  }
}

function pickLargestBadge(clan: any): string {
  if (!clan?.badgeUrls) return '';
  const { medium, large, small } = clan.badgeUrls;
  return large || medium || small || '';
}

function generatePayloadVersion(snapshot: FullClanSnapshot, transformedData: TransformedData): string {
  const data = {
    fetchedAt: snapshot.fetchedAt,
    memberCount: transformedData.memberData.length,
    clanTag: transformedData.clanData.tag,
    schemaVersion: CURRENT_PIPELINE_SCHEMA_VERSION,
  };
  return Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 16);
}

function calculateSeasonInfo(timestampIso: string) {
  const date = new Date(timestampIso);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    const seasonId = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 5, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 4, 59, 59));
    return {
      seasonId,
      seasonStart: start.toISOString(),
      seasonEnd: end.toISOString(),
    };
  }

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-based (0=Jan, 1=Feb, etc.)
  
  // Handle October 2025 special case first
  if (year === 2025 && month === 9) { // October is month 9 in 0-based
    return {
      seasonId: '2025-10',
      seasonStart: new Date(Date.UTC(2025, 9, 1, 5, 0, 0)).toISOString(),
      seasonEnd: new Date(Date.UTC(2025, 9, 6, 5, 0, 0)).toISOString(),
      isSpecialSeason: true,
      note: 'Extended season - final Legend League before ranked system'
    };
  }
  
  // Season starts first of current month at 5:00 UTC
  const seasonStart = new Date(Date.UTC(year, month, 1, 5, 0, 0));
  
  // Find LAST Monday of CURRENT month at 5:00 UTC
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)); // Gets last day of current month
  const lastDay = lastDayOfMonth.getUTCDate();
  const lastDayWeekday = lastDayOfMonth.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, etc.
  
  // Calculate how many days to go back to reach the last Monday
  let daysBack;
  if (lastDayWeekday === 1) {
    // Last day is already Monday
    daysBack = 0;
  } else if (lastDayWeekday === 0) {
    // Last day is Sunday, so last Monday was 6 days ago
    daysBack = 6;
  } else {
    // For Tuesday(2) through Saturday(6), calculate days back to Monday
    daysBack = lastDayWeekday - 1;
  }
  
  const lastMondayDate = lastDay - daysBack;
  const seasonEnd = new Date(Date.UTC(year, month, lastMondayDate, 5, 0, 0));
  
  return {
    seasonId: `${year}-${String(month + 1).padStart(2, '0')}`,
    seasonStart: seasonStart.toISOString(),
    seasonEnd: seasonEnd.toISOString(),
    isSpecialSeason: false
  };
}

async function logPhase(jobId: string, phase: string, level: 'info' | 'warn' | 'error', message: string, details?: Record<string, any>) {
  await appendJobLog(jobId, {
    level,
    message: `[${phase}] ${message}`,
    details,
    timestamp: new Date().toISOString(),
  });
}
