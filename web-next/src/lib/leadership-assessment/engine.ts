import { getSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeTag } from '@/lib/tags';
import { resolveRosterMembers } from '@/lib/roster-resolver';
import { calculateWarIntelligence } from '@/lib/war-intelligence/engine';
import { calculateCapitalAnalytics } from '@/lib/capital-analytics/engine';
import { calculatePlayerDNA, classifyPlayerArchetype } from '@/lib/player-dna';
import { evaluateElderCandidate } from '@/lib/elder/evaluator';
import { parseRankedLeagueName } from '@/lib/league-tiers';
import { parseRole } from '@/lib/leadership';
import { calculateActivityScore } from '@/lib/business/calculations';
import { buildTimelineFromPlayerDay, mapTimelinePointsToActivityEvents, DEFAULT_SEASON_START_ISO } from '@/lib/activity/timeline';
import type { Member, PlayerActivityTimelineEvent } from '@/types';
import type { PlayerDayTimelineRow } from '@/lib/activity/timeline';

export type LeadershipBand = 'successor' | 'lieutenant' | 'core' | 'watch' | 'liability';

export interface LeadershipAssessmentWeights {
  war: number;
  social: number;
  reliability: number;
}

export interface LeadershipAssessmentOptions {
  clanTag: string;
  daysBack?: number;
  weeksBack?: number;
  minWars?: number;
  minWeekends?: number;
  runType?: 'auto' | 'manual' | 'on-demand';
  force?: boolean;
  weights?: Partial<LeadershipAssessmentWeights>;
}

export interface LeadershipAssessmentSummary {
  rosterCount: number;
  assessmentCount: number;
  promotionCandidates: number;
  demotionRisks: number;
  bands: Record<LeadershipBand, number>;
}

export interface LeadershipAssessmentCoverage {
  warMetrics: number;
  capitalMetrics: number;
  activityMetrics: number;
  donationMetrics: number;
  capitalContributionMetrics: number;
}

export interface LeadershipAssessmentRun {
  id: string;
  clanTag: string;
  periodStart: string;
  periodEnd: string;
  runType: string;
  createdAt: string;
  rosterSnapshotId: string | null;
  summary: LeadershipAssessmentSummary;
  coverage: LeadershipAssessmentCoverage;
  weights: LeadershipAssessmentWeights;
}

export interface LeadershipAssessmentMember {
  memberId?: string | null;
  playerTag: string;
  playerName: string;
  role: string | null;
  townHall: number | null;
  tenureDays: number | null;
  clvScore: number;
  band: LeadershipBand;
  recommendation: string;
  flags: string[];
  metrics: {
    scores: {
      war: number | null;
      social: number;
      reliability: number;
      activity: number | null;
      baseQuality: number | null;
      donationRatio: number | null;
      donationVolume: number | null;
      capital: number | null;
      trophyPursuit: number | null;
      warParticipation: number | null;
      tenure: number | null;
    };
    raw: {
      donations: number | null;
      donationsReceived: number | null;
      capitalContributions: number | null;
      activityScore: number | null;
      activityIndicators?: string[];
      activityLevel?: string | null;
      activityLastActiveAt?: string | null;
      rushPercent: number | null;
      rankedTrophies: number | null;
      rankedLeagueId: number | null;
      rankedLeagueName: string | null;
      trophies: number | null;
      warOverall: number | null;
      warParticipation: number | null;
      warConsistency: number | null;
      capitalOverall: number | null;
      tenureDays: number | null;
    };
    chatBlurb?: string | null;
    dna: ReturnType<typeof calculatePlayerDNA>;
    archetype: string;
    elderRecommendation: string | null;
  };
}

export interface LeadershipAssessmentResponse {
  assessment: LeadershipAssessmentRun;
  results: LeadershipAssessmentMember[];
}

const DEFAULT_WEIGHTS: LeadershipAssessmentWeights = {
  war: 0.35,
  social: 0.25,
  reliability: 0.40,
};

const normalizeWeights = (weights?: Partial<LeadershipAssessmentWeights>): LeadershipAssessmentWeights => {
  const merged = {
    war: weights?.war ?? DEFAULT_WEIGHTS.war,
    social: weights?.social ?? DEFAULT_WEIGHTS.social,
    reliability: weights?.reliability ?? DEFAULT_WEIGHTS.reliability,
  };
  const total = merged.war + merged.social + merged.reliability;
  if (!Number.isFinite(total) || total <= 0) {
    return DEFAULT_WEIGHTS;
  }
  return {
    war: merged.war / total,
    social: merged.social / total,
    reliability: merged.reliability / total,
  };
};

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
};

const safeNumber = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return value;
};

const normalizeRange = (value: number | null | undefined, min: number, max: number): number | null => {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  if (max === min) return max === 0 ? 0 : 100;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
};

const weightedAverage = (items: Array<{ score: number | null; weight: number }>): number => {
  const valid = items.filter((item) => item.score != null && item.weight > 0);
  if (!valid.length) return 0;
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  const sum = valid.reduce((acc, item) => acc + (item.score as number) * item.weight, 0);
  return totalWeight > 0 ? sum / totalWeight : 0;
};

const buildPromotionBlurb = (params: {
  name: string;
  targetRole: string;
  clvScore: number;
  warScore: number | null;
  reliabilityScore: number | null;
  socialScore: number | null;
  tenureGate?: boolean;
}): string => {
  const reasons = [
    { label: 'War', score: params.warScore },
    { label: 'Reliability', score: params.reliabilityScore },
    { label: 'Support', score: params.socialScore },
  ]
    .filter((item) => item.score != null)
    .sort((a, b) => (b.score as number) - (a.score as number))
    .slice(0, 2);

  const reasonPhrases = reasons.map((item) => {
    if (item.label === 'War') return 'strong war performance';
    if (item.label === 'Reliability') return 'reliable participation';
    if (item.label === 'Support') return 'solid support for the clan';
    return 'steady contributions';
  });
  const reasonsText = reasonPhrases.length
    ? reasonPhrases.join(' and ')
    : 'consistent contributions';

  const tenureNote = params.tenureGate ? ' (tenure gate pending)' : '';
  return `Recommend ${params.name} for ${params.targetRole}${tenureNote} — ${reasonsText}.`;
};

const TENURE_GATE_ELDER_DAYS = 30;
const TENURE_GATE_COLEADER_DAYS = 90;

function buildBand(score: number): LeadershipBand {
  if (score >= 82) return 'successor';
  if (score >= 70) return 'lieutenant';
  if (score >= 50) return 'core';
  if (score >= 40) return 'watch';
  return 'liability';
}

type RoleKey = 'leader' | 'coLeader' | 'elder' | 'member';

const resolveRoleKey = (role?: string | null): RoleKey => {
  if (!role) return 'member';
  return parseRole(role);
};

const formatRoleLabel = (role: RoleKey): string => {
  if (role === 'leader') return 'Leader';
  if (role === 'coLeader') return 'Coleader';
  if (role === 'elder') return 'Elder';
  return 'Member';
};

function formatRecommendation(params: {
  band: LeadershipBand;
  role: RoleKey;
  tenureDays: number | null;
  flags: string[];
  tenureGateDays?: number | null;
}) {
  const isLeader = params.role === 'leader';
  const isCoLeader = params.role === 'coLeader';
  const isElder = params.role === 'elder';
  const tenureDays = params.tenureDays ?? 0;
  const tenureGateDays = params.tenureGateDays ?? TENURE_GATE_COLEADER_DAYS;
  const tenureBlocked = tenureDays > 0 && tenureDays < tenureGateDays;

  if (tenureBlocked && (params.band === 'successor' || params.band === 'lieutenant')) {
    return `Strong candidate (tenure gate: needs ${tenureGateDays} days)`;
  }

  if (isLeader) {
    if (params.band === 'watch' || params.band === 'liability') {
      return 'Leadership risk — review signals';
    }
    return 'Current leader — maintain role';
  }

  if (isCoLeader) {
    if (params.band === 'watch' || params.band === 'liability') {
      return 'Leadership risk — review signals';
    }
    return 'Current Coleader — maintain role';
  }

  if (isElder && params.band !== 'successor') {
    if (params.band === 'watch' || params.band === 'liability') {
      return 'Performance watch — review Elder status';
    }
    return 'Maintain Elder — leadership bench';
  }

  if (params.band === 'successor') {
    if (isElder) return 'Leadership-ready — consider Coleader';
    return 'Recommend promotion to Coleader';
  }

  if (params.band === 'lieutenant') {
    return 'Recommend promotion to Elder';
  }

  if (params.band === 'watch') {
    return 'Monitor — not ready for leadership';
  }

  if (params.band === 'liability') {
    return 'At risk — coaching required';
  }

  return 'Core contributor — maintain';
}

async function fetchRosterSnapshot(clanTag: string) {
  const supabase = getSupabaseAdminClient();

  const { data: clanRow, error: clanError } = await supabase
    .from('clans')
    .select('id, tag')
    .eq('tag', clanTag)
    .single();

  if (clanError || !clanRow) {
    throw new Error(`Clan lookup failed: ${clanError?.message || 'missing clan'}`);
  }

  const { data: snapshotRow, error: snapshotError } = await supabase
    .from('roster_snapshots')
    .select('id, fetched_at')
    .eq('clan_id', clanRow.id)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  if (snapshotError || !snapshotRow) {
    throw new Error(`Roster snapshot lookup failed: ${snapshotError?.message || 'missing snapshot'}`);
  }

  const snapshotDate = snapshotRow.fetched_at
    ? new Date(snapshotRow.fetched_at).toISOString().slice(0, 10)
    : null;
  const { members } = await resolveRosterMembers({
    supabase,
    clanTag,
    snapshotId: snapshotRow.id,
    snapshotDate,
  });

  return {
    snapshotId: snapshotRow.id as string,
    fetchedAt: snapshotRow.fetched_at as string,
    stats: members
      .map((member) => {
        const rankedCandidate =
          typeof member.ranked_trophies === 'number' && member.ranked_trophies > 0
            ? member.ranked_trophies
            : null;
        const rankedPrimary =
          rankedCandidate ??
          (typeof member.trophies === 'number'
            ? member.trophies
            : typeof member.league_trophies === 'number'
              ? member.league_trophies
              : typeof member.battle_mode_trophies === 'number'
                ? member.battle_mode_trophies
                : null);

        return {
          memberId: member.id as string,
          playerTag: member.tag ?? null,
          playerName: member.name ?? null,
          role: member.role ?? null,
          townHall: member.th_level ?? null,
          donations: member.donations ?? 0,
          donationsReceived: member.donations_received ?? 0,
          activityScore: member.activity_score ?? null,
          rushPercent: member.rush_percent ?? null,
          capitalContributions: member.capital_contributions ?? null,
          tenureDays: member.tenure_days ?? null,
          rankedTrophies: rankedPrimary ?? null,
          rankedLeagueId: member.ranked_league_id ?? null,
          rankedLeagueName: member.ranked_league_name ?? member.league_name ?? null,
          trophies: rankedPrimary ?? null,
          leagueId: member.league_id ?? null,
          leagueName: member.league_name ?? null,
        };
      })
      .filter((row) => row.playerTag),
  };
}

export async function runLeadershipAssessment(options: LeadershipAssessmentOptions): Promise<LeadershipAssessmentResponse> {
  const clanTag = normalizeTag(options.clanTag);
  if (!clanTag) {
    throw new Error('Invalid clan tag');
  }

  const supabase = getSupabaseAdminClient();
  const runType = options.runType ?? 'manual';

  if (!options.force && runType === 'auto') {
    const cutoff = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('leadership_assessments')
      .select('id')
      .eq('clan_tag', clanTag)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const cached = await fetchLatestLeadershipAssessment(clanTag);
      if (cached) return cached;
    }
  }

  const roster = await fetchRosterSnapshot(clanTag);
  const rosterStats = roster.stats;
  const rosterCount = rosterStats.length;
  const weights = normalizeWeights(options.weights);

  const activityLookbackDays = 7;
  const activityTimelineByTag = new Map<string, PlayerActivityTimelineEvent[]>();
  const activityEvidenceByTag = new Map<string, ReturnType<typeof calculateActivityScore>>();
  const activityScores: number[] = [];

  try {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - activityLookbackDays);
    const sinceIso = sinceDate.toISOString().slice(0, 10);

    const { data: playerDayRows, error: playerDayError } = await supabase
      .from('player_day')
      .select(
        'player_tag, date, clan_tag, th, league, trophies, donations, donations_rcv, war_stars, attack_wins, defense_wins, capital_contrib, legend_attacks, builder_hall_level, builder_battle_wins, builder_trophies, hero_levels, equipment_levels, pets, super_troops_active, achievements, rush_percent, exp_level, deltas, events, notability',
      )
      .eq('clan_tag', clanTag)
      .gte('date', sinceIso)
      .order('player_tag')
      .order('date');

    if (playerDayError) {
      throw playerDayError;
    }

    if (playerDayRows && playerDayRows.length) {
      const grouped = new Map<string, PlayerDayTimelineRow[]>();
      for (const row of playerDayRows as PlayerDayTimelineRow[]) {
        const normalized = normalizeTag(row.player_tag);
        if (!normalized) continue;
        if (!grouped.has(normalized)) grouped.set(normalized, []);
        grouped.get(normalized)!.push(row);
      }

      for (const [playerTag, rows] of grouped) {
        const timelineStats = buildTimelineFromPlayerDay(rows, DEFAULT_SEASON_START_ISO);
        const activityTimeline = mapTimelinePointsToActivityEvents(timelineStats.timeline);
        activityTimelineByTag.set(playerTag, activityTimeline);
      }
    }
  } catch (error) {
    console.warn('[leadership] Failed to load activity timeline data', error);
  }

  for (const member of rosterStats) {
    const playerTag = normalizeTag(member.playerTag ?? '') ?? member.playerTag ?? '';
    if (!playerTag) continue;

    const timeline = activityTimelineByTag.get(playerTag) ?? [];
    const memberForActivity: Member = {
      name: member.playerName ?? playerTag,
      tag: playerTag,
      role: member.role ?? undefined,
      townHallLevel: member.townHall ?? undefined,
      trophies: member.trophies ?? undefined,
      rankedTrophies: member.rankedTrophies ?? undefined,
      rankedLeagueId: member.rankedLeagueId ?? undefined,
      rankedLeagueName: member.rankedLeagueName ?? undefined,
      leagueId: member.leagueId ?? undefined,
      leagueName: member.leagueName ?? undefined,
      donations: member.donations ?? undefined,
      donationsReceived: member.donationsReceived ?? undefined,
    };

    const evidence = calculateActivityScore(memberForActivity, {
      timeline,
      lookbackDays: activityLookbackDays,
    });
    activityEvidenceByTag.set(playerTag, evidence);
    if (typeof evidence.score === 'number') {
      activityScores.push(evidence.score);
    }
  }

  const [warResult, capitalResult] = await Promise.all([
    calculateWarIntelligence({
      clanTag,
      daysBack: options.daysBack ?? 90,
      minWars: options.minWars ?? 3,
    }),
    calculateCapitalAnalytics({
      clanTag,
      weeksBack: options.weeksBack ?? 12,
      minWeekends: options.minWeekends ?? 3,
    }),
  ]);

  const warMetricsMap = new Map(
    (warResult.metrics || []).map((metric) => [normalizeTag(metric.playerTag) || metric.playerTag, metric])
  );
  const capitalMetricsMap = new Map(
    (capitalResult.metrics || []).map((metric) => [normalizeTag(metric.playerTag) || metric.playerTag, metric])
  );

  const donationValues = rosterStats.map((stat) => safeNumber(stat.donations));
  const capitalContributionValues = rosterStats.map((stat) => safeNumber(stat.capitalContributions));
  const trophyValues = rosterStats.map((stat) => {
    if (stat.rankedTrophies != null && stat.rankedTrophies > 0) {
      return safeNumber(stat.rankedTrophies);
    }
    return safeNumber(stat.trophies);
  });
  const leagueScoreValues = rosterStats
    .map((stat) => {
      const info = parseRankedLeagueName(stat.rankedLeagueName ?? null);
      return info?.score ?? null;
    })
    .filter((value): value is number => value != null);
  const activityValues = activityScores.filter((value): value is number => value != null);
  const donationMin = Math.min(...donationValues, 0);
  const donationMax = Math.max(...donationValues, 0);
  const capitalMin = Math.min(...capitalContributionValues, 0);
  const capitalMax = Math.max(...capitalContributionValues, 0);
  const trophyMin = Math.min(...trophyValues, 0);
  const trophyMax = Math.max(...trophyValues, 0);
  const leagueMin = Math.min(...leagueScoreValues, 0);
  const leagueMax = Math.max(...leagueScoreValues, 0);
  const activityMin = activityValues.length ? Math.min(...activityValues) : 0;
  const activityMax = activityValues.length ? Math.max(...activityValues) : 100;
  const results: LeadershipAssessmentMember[] = [];

  for (const member of rosterStats) {
    const playerTag = normalizeTag(member.playerTag ?? '') ?? member.playerTag ?? '';
    if (!playerTag) continue;

    const warMetrics = warMetricsMap.get(playerTag);
    const capitalMetrics = capitalMetricsMap.get(playerTag);

    const donations = safeNumber(member.donations);
    const donationsReceived = safeNumber(member.donationsReceived);
    const donationRatio = donationsReceived > 0 ? donations / donationsReceived : donations > 0 ? 2 : 0;
    const donationRatioScore = clamp((donationRatio / 2) * 100, 0, 100);
    const donationVolumeScore = normalizeRange(donations, donationMin, donationMax) ?? 0;

    const capitalContribution = member.capitalContributions ?? null;
    const capitalContributionScore = normalizeRange(capitalContribution, capitalMin, capitalMax) ?? 0;

    const activityEvidence = activityEvidenceByTag.get(playerTag);
    const activityScore = activityEvidence?.score ?? member.activityScore ?? null;
    const activityScoreNormalized = normalizeRange(activityScore, activityMin, activityMax) ?? activityScore ?? null;
    const activityIndicators = activityEvidence?.indicators ?? [];
    const activityLevel = activityEvidence?.level ?? null;
    const activityLastActiveAt = activityEvidence?.last_active_at ?? null;

    const trophySource = member.rankedTrophies ?? member.trophies;
    const leagueInfo = parseRankedLeagueName(member.rankedLeagueName ?? null);
    const leagueScore = leagueInfo?.score ?? null;
    const hasLeagueParticipation =
      Boolean(member.rankedLeagueId) ||
      Boolean(member.rankedLeagueName) ||
      (member.rankedTrophies ?? 0) > 0 ||
      (member.trophies ?? 0) > 0;
    const trophyPursuitScore = hasLeagueParticipation
      ? (
          trophySource != null && trophySource > 0
            ? normalizeRange(trophySource, trophyMin, trophyMax)
            : leagueScore != null
              ? normalizeRange(leagueScore, leagueMin, leagueMax)
              : null
        )
      : null;

    const baseQualityScore = member.rushPercent == null
      ? null
      : clamp(100 - safeNumber(member.rushPercent), 0, 100);

    const warScore = warMetrics ? clamp(warMetrics.overallScore, 0, 100) : null;
    const warParticipationScore = warMetrics ? clamp(warMetrics.participationRate * 100, 0, 100) : null;
    const warConsistencyScore = warMetrics ? clamp(warMetrics.consistencyScore, 0, 100) : null;

    const capitalScore = capitalMetrics ? clamp(capitalMetrics.overallScore, 0, 100) : null;

    const socialScore = weightedAverage([
      { score: donationRatioScore, weight: 0.4 },
      { score: donationVolumeScore, weight: 0.3 },
      { score: capitalScore ?? capitalContributionScore, weight: 0.3 },
    ]);

    const tenureDays = member.tenureDays ?? null;
    const tenureScore = tenureDays != null ? clamp((tenureDays / 180) * 100, 0, 100) : null;

    const reliabilityScore = weightedAverage([
      { score: activityScoreNormalized, weight: 0.3 },
      { score: tenureScore, weight: 0.2 },
      { score: warParticipationScore ?? warConsistencyScore, weight: 0.2 },
      { score: baseQualityScore, weight: 0.1 },
      { score: trophyPursuitScore, weight: 0.2 },
    ]);

    const clvScore = weightedAverage([
      { score: warScore, weight: weights.war },
      { score: socialScore, weight: weights.social },
      { score: reliabilityScore, weight: weights.reliability },
    ]);

    const band = buildBand(clvScore);
    const flags: string[] = [];
    const roleKey = resolveRoleKey(member.role);
    const roleLabel = formatRoleLabel(roleKey);
    const roleForDNA = roleKey === 'coLeader' ? 'co-leader' : roleKey;
    const isLeadership = roleKey === 'leader' || roleKey === 'coLeader';
    const tenureGateDays =
      band === 'successor'
        ? TENURE_GATE_COLEADER_DAYS
        : band === 'lieutenant'
          ? TENURE_GATE_ELDER_DAYS
          : null;
    const tenureBlocked = tenureGateDays != null && tenureDays != null && tenureDays < tenureGateDays;

    if (donationRatio > 0 && donationRatio < 0.4) flags.push('leech_risk');
    if (activityScore != null && activityScore < 30) flags.push('inactive_risk');
    if (warParticipationScore != null && warParticipationScore < 60) flags.push('war_participation_low');
    if (baseQualityScore != null && baseQualityScore < 60) flags.push('rushed_base_risk');
    if (!hasLeagueParticipation) flags.push('no_ranked_league');
    if (tenureBlocked) flags.push('tenure_gate');

    const recommendation = formatRecommendation({
      band,
      role: roleKey,
      tenureDays,
      flags,
      tenureGateDays,
    });
    const promotionTarget = band === 'successor' ? 'Coleader' : band === 'lieutenant' ? 'Elder' : null;
    const chatBlurb =
      promotionTarget && !isLeadership
        ? buildPromotionBlurb({
            name: member.playerName ?? playerTag,
            targetRole: promotionTarget,
            clvScore,
            warScore,
            reliabilityScore,
            socialScore,
            tenureGate: flags.includes('tenure_gate'),
          })
        : null;

    const dna = calculatePlayerDNA({
      name: member.playerName ?? playerTag,
      tag: playerTag,
      donations,
      donationsReceived,
      warStars: warMetrics?.totalStars ?? 0,
      clanCapitalContributions: safeNumber(member.capitalContributions),
      trophies: 0,
      tenure: tenureDays ?? 0,
      role: roleForDNA,
      townHallLevel: member.townHall ?? undefined,
      rushPercent: member.rushPercent ?? undefined,
    });

    const archetype = classifyPlayerArchetype(dna, {
      name: member.playerName ?? playerTag,
      tag: playerTag,
      donations,
      donationsReceived,
      warStars: warMetrics?.totalStars ?? 0,
      clanCapitalContributions: safeNumber(member.capitalContributions),
      trophies: 0,
      tenure: tenureDays ?? 0,
      role: roleForDNA,
      townHallLevel: member.townHall ?? undefined,
      rushPercent: member.rushPercent ?? undefined,
    });

    const elderRecommendation = evaluateElderCandidate({
      playerTag,
      name: member.playerName ?? playerTag,
      tenureDays: tenureDays ?? 0,
      role: roleForDNA,
      isElder: roleKey === 'elder',
      consistency: activityScoreNormalized ?? 0,
      generosity: socialScore,
      performance: warScore ?? 0,
    }, { tenureMinimum: TENURE_GATE_ELDER_DAYS });

    results.push({
      memberId: member.memberId,
      playerTag,
      playerName: member.playerName ?? playerTag,
      role: roleLabel,
      townHall: member.townHall ?? null,
      tenureDays,
      clvScore: Math.round(clvScore * 10) / 10,
      band,
      recommendation,
      flags,
      metrics: {
        scores: {
          war: warScore,
          social: Math.round(socialScore * 10) / 10,
          reliability: Math.round(reliabilityScore * 10) / 10,
          activity: activityScoreNormalized,
          baseQuality: baseQualityScore,
          donationRatio: Math.round(donationRatioScore * 10) / 10,
          donationVolume: Math.round(donationVolumeScore * 10) / 10,
          capital: capitalScore ?? capitalContributionScore,
          trophyPursuit: trophyPursuitScore,
          warParticipation: warParticipationScore,
          tenure: tenureScore,
        },
        raw: {
          donations,
          donationsReceived,
          capitalContributions: member.capitalContributions ?? null,
          activityScore,
          activityIndicators,
          activityLevel,
          activityLastActiveAt,
          rushPercent: member.rushPercent ?? null,
          rankedTrophies: member.rankedTrophies ?? null,
          rankedLeagueId: member.rankedLeagueId ?? null,
          rankedLeagueName: member.rankedLeagueName ?? null,
          trophies: member.trophies ?? null,
          warOverall: warScore,
          warParticipation: warParticipationScore,
          warConsistency: warConsistencyScore,
          capitalOverall: capitalScore,
          tenureDays,
        },
        chatBlurb,
        dna,
        archetype,
        elderRecommendation: elderRecommendation.recommendation,
      },
    });
  }

  const bands: LeadershipAssessmentSummary['bands'] = {
    successor: 0,
    lieutenant: 0,
    core: 0,
    watch: 0,
    liability: 0,
  };

  const sorted = results.sort((a, b) => b.clvScore - a.clvScore);
  sorted.forEach((result) => {
    bands[result.band] += 1;
  });

  const promotionCandidates = sorted.filter((result) => {
    const roleKey = resolveRoleKey(result.role);
    const isLeadership = roleKey === 'leader' || roleKey === 'coLeader';
    return (result.band === 'successor' || result.band === 'lieutenant') && !isLeadership;
  }).length;
  const demotionRisks = sorted.filter((result) => result.band === 'watch' || result.band === 'liability').length;

  const summary: LeadershipAssessmentSummary = {
    rosterCount,
    assessmentCount: sorted.length,
    promotionCandidates,
    demotionRisks,
    bands,
  };

  const coverage: LeadershipAssessmentCoverage = {
    warMetrics: sorted.filter((result) => result.metrics.raw.warOverall != null).length,
    capitalMetrics: sorted.filter((result) => result.metrics.raw.capitalOverall != null).length,
    activityMetrics: sorted.filter((result) => result.metrics.raw.activityScore != null).length,
    donationMetrics: sorted.filter((result) => safeNumber(result.metrics.raw.donations) > 0).length,
    capitalContributionMetrics: sorted.filter((result) => safeNumber(result.metrics.raw.capitalContributions) > 0).length,
  };

  const now = new Date();
  const periodStart = new Date(now.getTime() - (options.daysBack ?? 90) * 24 * 60 * 60 * 1000);
  const assessmentRun = await persistLeadershipAssessment({
    clanTag,
    rosterSnapshotId: roster.snapshotId,
    runType,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    summary,
    coverage,
    weights,
    results: sorted,
  });

  return {
    assessment: assessmentRun,
    results: sorted,
  };
}

interface PersistParams {
  clanTag: string;
  rosterSnapshotId: string | null;
  runType: string;
  periodStart: string;
  periodEnd: string;
  summary: LeadershipAssessmentSummary;
  coverage: LeadershipAssessmentCoverage;
  weights: LeadershipAssessmentWeights;
  results: LeadershipAssessmentMember[];
}

async function persistLeadershipAssessment(params: PersistParams): Promise<LeadershipAssessmentRun> {
  const supabase = getSupabaseAdminClient();

  const { data: assessmentRow, error: assessmentError } = await supabase
    .from('leadership_assessments')
    .insert({
      clan_tag: params.clanTag,
      roster_snapshot_id: params.rosterSnapshotId,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      run_type: params.runType,
      data_version: 'v1',
      summary: params.summary,
      config: {
        weights: params.weights,
        coverage: params.coverage,
      },
    })
    .select('id, clan_tag, period_start, period_end, run_type, created_at, roster_snapshot_id, summary, config')
    .single();

  if (assessmentError || !assessmentRow) {
    throw new Error(`Failed to save leadership assessment: ${assessmentError?.message || 'unknown error'}`);
  }

  if (params.results.length) {
    const inserts = params.results.map((result) => ({
      assessment_id: assessmentRow.id,
      clan_tag: params.clanTag,
      member_id: result.memberId ?? null,
      player_tag: result.playerTag,
      player_name: result.playerName,
      role: result.role,
      town_hall: result.townHall,
      tenure_days: result.tenureDays,
      clv_score: result.clvScore,
      band: result.band,
      recommendation: result.recommendation,
      flags: result.flags,
      metrics: result.metrics,
    }));

    const { error: resultError } = await supabase
      .from('leadership_assessment_results')
      .insert(inserts);

    if (resultError) {
      throw new Error(`Failed to save leadership assessment results: ${resultError.message}`);
    }
  }

  return {
    id: assessmentRow.id,
    clanTag: assessmentRow.clan_tag,
    periodStart: assessmentRow.period_start,
    periodEnd: assessmentRow.period_end,
    runType: assessmentRow.run_type,
    createdAt: assessmentRow.created_at,
    rosterSnapshotId: assessmentRow.roster_snapshot_id,
    summary: assessmentRow.summary as LeadershipAssessmentSummary,
    coverage: (assessmentRow.config as any)?.coverage ?? params.coverage,
    weights: normalizeWeights((assessmentRow.config as any)?.weights ?? params.weights),
  };
}

export async function fetchLatestLeadershipAssessment(clanTag: string): Promise<LeadershipAssessmentResponse | null> {
  const supabase = getSupabaseAdminClient();
  const normalized = normalizeTag(clanTag);
  if (!normalized) return null;

  const { data: assessmentRow, error: assessmentError } = await supabase
    .from('leadership_assessments')
    .select('id, clan_tag, period_start, period_end, run_type, created_at, roster_snapshot_id, summary, config')
    .eq('clan_tag', normalized)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessmentError || !assessmentRow) {
    return null;
  }

  const { data: resultsRows, error: resultsError } = await supabase
    .from('leadership_assessment_results')
    .select('player_tag, player_name, role, town_hall, tenure_days, clv_score, band, recommendation, flags, metrics')
    .eq('assessment_id', assessmentRow.id)
    .order('clv_score', { ascending: false });

  if (resultsError) {
    throw new Error(`Failed to load leadership assessment results: ${resultsError.message}`);
  }

  return {
    assessment: {
      id: assessmentRow.id,
      clanTag: assessmentRow.clan_tag,
      periodStart: assessmentRow.period_start,
      periodEnd: assessmentRow.period_end,
      runType: assessmentRow.run_type,
      createdAt: assessmentRow.created_at,
      rosterSnapshotId: assessmentRow.roster_snapshot_id,
      summary: assessmentRow.summary as LeadershipAssessmentSummary,
      coverage: (assessmentRow.config as any)?.coverage ?? {
        warMetrics: 0,
        capitalMetrics: 0,
        activityMetrics: 0,
        donationMetrics: 0,
        capitalContributionMetrics: 0,
      },
      weights: normalizeWeights((assessmentRow.config as any)?.weights),
    },
    results: (resultsRows || []).map((row) => ({
      playerTag: row.player_tag,
      playerName: row.player_name,
      role: row.role,
      townHall: row.town_hall,
      tenureDays: row.tenure_days,
      clvScore: Number(row.clv_score) || 0,
      band: row.band as LeadershipBand,
      recommendation: row.recommendation,
      flags: row.flags ?? [],
      metrics: row.metrics as LeadershipAssessmentMember['metrics'],
    })),
  };
}
