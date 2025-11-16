import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeTag } from '@/lib/tags';
import {
  generateWarPlanAnalysis,
  normalizeHeroLevels,
  type WarPlanAnalysis,
  type WarPlanProfile,
} from './analysis';
import { getPlayer, extractHeroLevels } from '@/lib/coc';
import { enhanceWarPlanAnalysis } from './ai-briefing';

export const WAR_PLAN_SELECT_FIELDS =
  [
    'id',
    'our_clan_tag',
    'opponent_clan_tag',
    'our_selection',
    'opponent_selection',
    'analysis',
    'analysis_status',
    'analysis_job_id',
    'analysis_started_at',
    'analysis_completed_at',
    'analysis_version',
    'updated_at',
  ].join(', ');

export interface WarPlanRecord {
  id: string;
  our_clan_tag: string;
  opponent_clan_tag: string;
  our_selection: string[];
  opponent_selection: string[];
  analysis: WarPlanAnalysis | null;
  analysis_status: string | null;
  analysis_job_id: string | null;
  analysis_started_at: string | null;
  analysis_completed_at: string | null;
  analysis_version: string | null;
  updated_at: string;
}

export interface GenerateOptions {
  ourFallback?: WarPlanProfile[];
  opponentFallback?: WarPlanProfile[];
  enableAI?: boolean;
}

export interface WarPlanAnalysisResult {
  analysis: WarPlanAnalysis;
  ourProfiles: WarPlanProfile[];
  opponentProfiles: WarPlanProfile[];
}

export async function fetchWarPlanRecord(
  supabase: SupabaseClient,
  ourClanTag: string,
  opponentClanTag?: string | null,
): Promise<WarPlanRecord | null> {
  const query = supabase
    .from('war_plans')
    .select(WAR_PLAN_SELECT_FIELDS)
    .eq('our_clan_tag', ourClanTag)
    .order('updated_at', { ascending: false })
    .limit(1);

  const { data, error } = opponentClanTag
    ? await query.eq('opponent_clan_tag', opponentClanTag).maybeSingle<WarPlanRecord>()
    : await query.maybeSingle<WarPlanRecord>();

  if (error) throw error;
  return data ?? null;
}

export async function fetchWarPlanRecordById(
  supabase: SupabaseClient,
  planId: string,
): Promise<WarPlanRecord | null> {
  if (!planId) return null;
  const { data, error } = await supabase
    .from('war_plans')
    .select(WAR_PLAN_SELECT_FIELDS)
    .eq('id', planId)
    .maybeSingle<WarPlanRecord>();

  if (error) throw error;
  return data ?? null;
}

export async function computeWarPlanAnalysisResult(
  supabase: SupabaseClient,
  plan: WarPlanRecord,
  options: GenerateOptions = {},
): Promise<WarPlanAnalysisResult> {
  const ourProfilesRaw = await loadProfiles(supabase, plan.our_selection, plan.our_clan_tag);
  const opponentProfilesRaw = await loadProfiles(supabase, plan.opponent_selection, plan.opponent_clan_tag);

  const ourProfiles = fillMissingProfiles(ourProfilesRaw, plan.our_selection, options.ourFallback ?? []);
  const opponentProfiles = fillMissingProfiles(
    opponentProfilesRaw,
    plan.opponent_selection,
    options.opponentFallback ?? [],
  );

  const baseAnalysis = generateWarPlanAnalysis({
    ourProfiles,
    opponentProfiles,
    ourSelected: plan.our_selection,
    opponentSelected: plan.opponent_selection,
  });

  const enhancedAnalysis = await enhanceWarPlanAnalysis(
    baseAnalysis,
    {
      ourClanTag: plan.our_clan_tag,
      opponentClanTag: plan.opponent_clan_tag,
      ourProfiles,
      opponentProfiles,
    },
    { enabled: options.enableAI !== false },
  );

  return { analysis: enhancedAnalysis, ourProfiles, opponentProfiles };
}

export interface StoreAnalysisOptions extends GenerateOptions {
  statusOnSuccess?: string;
  jobId?: string | null;
  analysisVersion?: string | null;
  startedAt?: string | null;
  resultMetadata?: Record<string, any>;
}

export async function computeAndStoreWarPlanAnalysis(
  supabase: SupabaseClient,
  plan: WarPlanRecord,
  options: StoreAnalysisOptions = {},
): Promise<WarPlanRecord> {
  const { statusOnSuccess, jobId, analysisVersion, startedAt, resultMetadata, ...analysisOptions } = options;
  const { analysis } = await computeWarPlanAnalysisResult(supabase, plan, analysisOptions);
  const now = new Date().toISOString();

  const updates: Record<string, any> = {
    analysis,
    analysis_status: statusOnSuccess ?? 'ready',
    analysis_completed_at: now,
    updated_at: now,
  };

  if (startedAt !== undefined) {
    updates.analysis_started_at = startedAt;
  }

  if (jobId !== undefined) {
    updates.analysis_job_id = jobId;
  }

  if (analysisVersion !== undefined) {
    updates.analysis_version = analysisVersion;
  }

  if (resultMetadata && typeof resultMetadata === 'object') {
    Object.assign(updates, resultMetadata);
  }

  const { data, error } = await supabase
    .from('war_plans')
    .update(updates)
    .eq('id', plan.id)
    .select(WAR_PLAN_SELECT_FIELDS)
    .single<WarPlanRecord>();

  if (error) throw error;
  return data;
}

async function loadProfiles(
  supabase: SupabaseClient,
  tags: string[],
  optionalClanTag?: string | null,
): Promise<WarPlanProfile[]> {
  if (!tags.length) return [];
  const cleanTags = tags
    .map((tag) => normalizeTag(tag))
    .filter((tag): tag is string => Boolean(tag));
  if (!cleanTags.length) return [];

  const fetchRows = async (applyClanFilter: boolean) => {
    let query = supabase
      .from('canonical_member_snapshots')
      .select('player_tag, clan_tag, snapshot_date, payload')
      .in('player_tag', cleanTags)
      .order('snapshot_date', { ascending: false })
      .limit(cleanTags.length * 3);

    if (applyClanFilter && optionalClanTag) {
      query = query.eq('clan_tag', optionalClanTag);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  };

  let data = await fetchRows(Boolean(optionalClanTag));
  if ((!data || data.length === 0) && optionalClanTag) {
    data = await fetchRows(false);
  }

  const latestByPlayer = new Map<string, (typeof data)[number]>();
  data.forEach((row) => {
    const normalized = normalizeTag(row.player_tag ?? '');
    if (!normalized || latestByPlayer.has(normalized)) return;
    latestByPlayer.set(normalized, row);
  });

  const profileMap = new Map<string, WarPlanProfile>();
  const tagsNeedingLive = new Set<string>();

  cleanTags.forEach((tag) => {
    const row = latestByPlayer.get(tag);
    if (!row) {
      tagsNeedingLive.add(tag);
      return;
    }
    const payload = (row.payload as any) ?? {};
    const member = payload.member ?? {};
    const ranked = member.ranked ?? {};
    const war = member.war ?? {};
    const heroes = member.heroLevels ?? payload.heroLevels ?? {};

    const profile: WarPlanProfile = {
      tag,
      name: member.name ?? tag,
      clanTag: row.clan_tag ?? null,
      thLevel: member.townHallLevel ?? null,
      rankedTrophies: ranked.trophies ?? member.trophies ?? null,
      warStars: war.stars ?? null,
      heroLevels: normalizeHeroLevels(heroes),
    };

    profileMap.set(tag, profile);

    if (profile.thLevel == null) {
      tagsNeedingLive.add(tag);
    }
  });

  for (const tag of tagsNeedingLive) {
    try {
      const liveProfile = await fetchLiveWarProfile(tag);
      if (liveProfile) {
        profileMap.set(tag, liveProfile);
      }
    } catch (error) {
      console.warn('[WarPlanning] Failed to fetch live player profile', tag, error);
    }
  }

  return cleanTags
    .map((tag) => profileMap.get(tag))
    .filter((profile): profile is WarPlanProfile => Boolean(profile));
}

async function fetchLiveWarProfile(tag: string): Promise<WarPlanProfile | null> {
  try {
    const player = await getPlayer(tag);
    if (!player) return null;
    const normalizedTag = normalizeTag(player.tag || tag);
    return {
      tag: normalizedTag,
      name: player.name || normalizedTag,
      clanTag:
        ('clan' in (player as any) && (player as any).clan?.tag)
          ? normalizeTag((player as any).clan.tag)
          : null,
      thLevel: player.townHallLevel ?? null,
      rankedTrophies:
        (('legendStatistics' in (player as any)) ? (player as any).legendStatistics?.currentSeason?.trophies : undefined)
        ?? player.trophies
        ?? null,
      warStars: player.warStars ?? null,
      heroLevels: normalizeHeroLevels(extractHeroLevels(player) as Record<string, number | null>),
    };
  } catch (error) {
    console.warn('[WarPlanning] Live player fetch failed', tag, error);
    return null;
  }
}

function fillMissingProfiles(
  existingProfiles: WarPlanProfile[],
  selectedTags: string[],
  fallbacks: WarPlanProfile[],
): WarPlanProfile[] {
  const normalizedExisting = new Map(
    existingProfiles.map((profile) => [normalizeTag(profile.tag ?? ''), profile] as const),
  );
  const fallbackMap = new Map(
    fallbacks
      .map((fallback) => {
        const normalized = normalizeTag(fallback.tag ?? '');
        if (!normalized) return null;
        return [normalized, fallback] as const;
      })
      .filter((entry): entry is [string, WarPlanProfile] => entry !== null),
  );

  const merged = [...existingProfiles];

  for (const tag of selectedTags) {
    const normalized = normalizeTag(tag);
    if (!normalized) continue;
    if (normalizedExisting.has(normalized)) continue;
    const fallback = fallbackMap.get(normalized);
    if (!fallback) continue;
    merged.push({
      tag: normalized,
      name: fallback.name ?? normalized,
      clanTag: fallback.clanTag ?? null,
      thLevel: fallback.thLevel ?? null,
      rankedTrophies: fallback.rankedTrophies ?? null,
      warStars: fallback.warStars ?? null,
      heroLevels: normalizeHeroLevels(fallback.heroLevels),
    });
  }

  return merged;
}
