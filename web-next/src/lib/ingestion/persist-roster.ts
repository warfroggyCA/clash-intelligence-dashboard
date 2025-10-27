import { getSupabaseServerClient } from '@/lib/supabase-server';
import { normalizeTag } from '@/lib/tags';
import type { FullClanSnapshot, MemberSummary } from '@/lib/full-snapshot';
import { extractHeroLevels } from '@/lib/coc';
import { extractEnrichedFields } from '@/lib/ingestion/field-extractors';
import { buildCanonicalMemberSnapshot } from '@/lib/canonical-member';
import { calculateRushPercentage, calculateActivityScore } from '@/lib/business/calculations';
import type { HeroCaps, Member } from '@/types';
import { generatePlayerDayRow, type CanonicalPlayerState } from '@/lib/player-day';
import type { ClanRoleName } from '@/lib/auth/roles';

type HeroLevels = Partial<Record<keyof HeroCaps, number | null>>;

type CanonicalSnapshotRow = {
  clan_tag: string;
  player_tag: string;
  snapshot_id: string;
  snapshot_date: string;
  schema_version: string;
  payload: ReturnType<typeof buildCanonicalMemberSnapshot>;
};

function getLeagueIcon(value: any, size: 'small' | 'medium'): string | null {
  if (!value || typeof value !== 'object') return null;
  const iconUrls = value.iconUrls ?? value.icon_urls ?? null;
  if (iconUrls && typeof iconUrls === 'object') {
    const candidate = iconUrls[size] ?? iconUrls[size.toUpperCase()];
    if (typeof candidate === 'string') return candidate;
  }
  const fallbackKey = size === 'small' ? 'iconSmall' : 'iconMedium';
  return typeof value[fallbackKey] === 'string' ? value[fallbackKey] : null;
}

function normalizeClanRole(role?: string | null): ClanRoleName {
  const value = (role || '').toLowerCase();
  if (value === 'leader') return 'leader';
  if (value === 'coleader' || value === 'co-leader' || value === 'co_leader') return 'coleader';
  if (value === 'elder' || value === 'admin') return 'elder';
  if (value === 'member') return 'member';
  return 'viewer';
}

async function syncUserRolesForClan(clanId: string, tagRoleMap: Map<string, ClanRoleName>) {
  const supabase = getSupabaseServerClient();
  const { data: existing, error } = await supabase
    .from('user_roles')
    .select('id, clan_id, user_id, player_tag, role')
    .eq('clan_id', clanId);

  if (error) {
    console.warn('[persist-roster] Failed to load user roles for sync', error);
    return;
  }

  const updates: Array<{
    id: string;
    clan_id: string | null;
    user_id: string | null;
    player_tag: string | null;
    role: ClanRoleName;
  }> = [];

  for (const row of existing ?? []) {
    const tag = normalizeTag(row.player_tag || '');
    const role = tag ? tagRoleMap.get(tag) ?? 'viewer' : 'viewer';
    if (role === (row.role as ClanRoleName | null)) {
      continue;
    }
    updates.push({
      id: row.id,
      clan_id: row.clan_id ?? null,
      user_id: row.user_id ?? null,
      player_tag: row.player_tag ?? null,
      role,
    });
  }

  if (!updates.length) return;

  const { error: updateError } = await supabase
    .from('user_roles')
    .upsert(updates, { onConflict: 'id', ignoreDuplicates: false });

  if (updateError) {
    console.warn('[persist-roster] Failed to sync user roles', updateError);
  }
}

function pickLargestBadge(clan: any): string | null {
  const badgeUrls = clan?.badgeUrls ?? {};
  return badgeUrls?.large || badgeUrls?.medium || badgeUrls?.small || null;
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
    console.warn('[persist-roster] Failed to extract hero levels', error);
    return null;
  }
}

function toNumeric(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function computeRushPercent(thLevel: number | undefined, heroLevels: HeroLevels | null): number | null {
  if (!thLevel || !heroLevels) return null;
  const syntheticMember = {
    townHallLevel: thLevel,
    bk: heroLevels.bk ?? 0,
    aq: heroLevels.aq ?? 0,
    gw: heroLevels.gw ?? 0,
    rc: heroLevels.rc ?? 0,
    mp: heroLevels.mp ?? 0,
  } as any;
  try {
    return calculateRushPercentage(syntheticMember);
  } catch (error) {
    console.warn('[persist-roster] Failed to compute rush percent', error);
    return null;
  }
}

function buildExtras(summary: MemberSummary, detail: any, currentRankedTrophies?: number | null) {
  return {
    builderHallLevel: summary.builderHallLevel ?? detail?.builderHallLevel ?? null,
    townHallWeaponLevel: summary.townHallWeaponLevel ?? detail?.townHallWeaponLevel ?? null,
    builderTrophies: summary.builderTrophies ?? detail?.versusTrophies ?? null,
    clanRank: summary.clanRank ?? null,
    previousClanRank: summary.previousClanRank ?? null,
    bestTrophies: detail?.bestTrophies ?? null,
    bestVersusTrophies: detail?.bestVersusTrophies ?? null,
    warStars: detail?.warStars ?? null,
    attackWins: detail?.attackWins ?? null,
    defenseWins: detail?.defenseWins ?? null,
    currentRankedTrophies: currentRankedTrophies ?? null,
  };
}

export async function persistRosterSnapshotToDataSpine(snapshot: FullClanSnapshot) {
  const supabase = getSupabaseServerClient();
  const clanTag = normalizeTag(snapshot.clanTag);

  const { data: clanRow, error: clanError } = await supabase
    .from('clans')
    .upsert({
      tag: clanTag,
      name: snapshot.clan?.name ?? null,
      logo_url: pickLargestBadge(snapshot.clan),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tag' })
    .select('id, tag')
    .single();

  if (clanError) {
    throw new Error(`[persist-roster] Failed to upsert clan: ${clanError.message}`);
  }

  const memberUpserts = snapshot.memberSummaries.map((summary) => {
    const normalized = normalizeTag(summary.tag);
    const detail = snapshot.playerDetails?.[normalized];
    return {
      clan_id: clanRow.id,
      tag: normalized,
      name: summary.name,
      th_level: summary.townHallLevel ?? detail?.townHallLevel ?? null,
      role: summary.role ?? null,
      league: summary.league ?? detail?.league ?? null,
      builder_league: detail?.builderBaseLeague ?? null,
      updated_at: new Date().toISOString(),
    };
  });

  const { data: memberRows, error: memberError } = await supabase
    .from('members')
    .upsert(memberUpserts, { onConflict: 'clan_id,tag' })
    .select('id, tag');

  if (memberError) {
    throw new Error(`[persist-roster] Failed to upsert members: ${memberError.message}`);
  }

  const memberIdByTag = new Map<string, string>();
  for (const row of memberRows ?? []) {
    memberIdByTag.set(normalizeTag(row.tag), row.id);
  }

  const totalTrophies = snapshot.memberSummaries.reduce((sum, m) => sum + (m.trophies ?? 0), 0);
  const totalDonations = snapshot.memberSummaries.reduce((sum, m) => sum + (m.donations ?? 0), 0);

  const { data: existingSnapshot } = await supabase
    .from('roster_snapshots')
    .select('id')
    .eq('clan_id', clanRow.id)
    .eq('fetched_at', snapshot.fetchedAt)
    .maybeSingle();

  let snapshotId: string;

  if (existingSnapshot) {
    snapshotId = existingSnapshot.id;
    await supabase.from('member_snapshot_stats').delete().eq('snapshot_id', snapshotId);
  } else {
    const { data: insertedSnapshot, error: snapshotError } = await supabase
      .from('roster_snapshots')
      .insert({
        clan_id: clanRow.id,
        fetched_at: snapshot.fetchedAt,
        member_count: snapshot.metadata.memberCount,
        total_trophies: totalTrophies,
        total_donations: totalDonations,
        payload: snapshot,
        metadata: snapshot.metadata,
      })
      .select('id')
      .single();

    if (snapshotError) {
      throw new Error(`[persist-roster] Failed to insert roster snapshot: ${snapshotError.message}`);
    }

    snapshotId = insertedSnapshot.id;
  }

  const canonicalRows: CanonicalSnapshotRow[] = [];
  const playerDayStates: CanonicalPlayerState[] = [];
  const computedAt = (snapshot.metadata as any)?.computedAt ?? null;
  const clanName = snapshot.clan?.name ?? null;

  const snapshotStats = snapshot.memberSummaries.map((summary) => {
    const tag = normalizeTag(summary.tag);
    const memberId = memberIdByTag.get(tag);
    if (!memberId) return null;
    const detail = snapshot.playerDetails?.[tag];
    const memberName = summary.name ?? detail?.name ?? tag;
    const enrichedFields = extractEnrichedFields(detail);
    const heroLevels = buildHeroLevels(detail);
    const rushPercent = computeRushPercent(summary.townHallLevel ?? detail?.townHallLevel, heroLevels);
    const leagueId = summary.league?.id ?? detail?.league?.id ?? null;
    const leagueName = summary.league?.name ?? detail?.league?.name ?? null;
    const leagueTrophies =
      toNumeric(summary.league?.trophies) ??
      toNumeric(detail?.league?.trophies);
    const rankedLeagueId = summary.leagueTier?.id ?? detail?.leagueTier?.id ?? leagueId ?? null;
    const rankedLeagueName = summary.leagueTier?.name ?? detail?.leagueTier?.name ?? leagueName ?? null;
    const rankedTrophies =
      toNumeric(detail?.leagueTier?.trophies) ??
      leagueTrophies ??
      toNumeric(summary.trophies) ??
      null;
    const donationsGiven = toNumeric(summary.donations);
    const donationsReceived = toNumeric(summary.donationsReceived);
    const currentTrophies =
      toNumeric(detail?.trophies) ??
      toNumeric(summary.trophies) ??
      null;
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
    const currentRankedValue = rankedTrophies ?? currentTrophies ?? 0;
    const rankedSnapshotValue =
      tournamentFinalTrophies != null && tournamentFinalTrophies > 0
        ? tournamentFinalTrophies
        : currentRankedValue;
    const extras = buildExtras(summary, detail, currentRankedValue);
    const leagueSource = (summary.league && typeof summary.league === 'object') ? summary.league : detail?.league;
    const leagueIconSmall = getLeagueIcon(leagueSource, 'small');
    const leagueIconMedium = getLeagueIcon(leagueSource, 'medium');
    const rankedLeagueSource = detail?.leagueTier ?? null;
    const rankedIconSmall = getLeagueIcon(rankedLeagueSource, 'small');
    const rankedIconMedium = getLeagueIcon(rankedLeagueSource, 'medium');

    const memberEnriched = {
      petLevels: enrichedFields.petLevels,
      builderHallLevel: enrichedFields.builderHallLevel,
      versusTrophies: enrichedFields.versusTrophies ?? toNumeric(summary.builderTrophies) ?? null,
      versusBattleWins: enrichedFields.versusBattleWins ?? null,
      builderLeagueId: enrichedFields.builderLeagueId ?? null,
      warStars: enrichedFields.warStars,
      attackWins: enrichedFields.attackWins,
      defenseWins: enrichedFields.defenseWins,
      capitalContributions: enrichedFields.capitalContributions,
      maxTroopCount: enrichedFields.maxTroopCount,
      maxSpellCount: enrichedFields.maxSpellCount,
      superTroopsActive: enrichedFields.superTroopsActive,
      achievementCount: enrichedFields.achievementCount,
      achievementScore: enrichedFields.achievementScore,
      expLevel: enrichedFields.expLevel ?? detail?.expLevel ?? null,
      bestTrophies: enrichedFields.bestTrophies ?? null,
      bestVersusTrophies: enrichedFields.bestVersusTrophies ?? null,
      equipmentLevels: enrichedFields.equipmentLevels ?? null,
    };

    const memberForActivity: Member = {
      name: memberName,
      tag,
      role: summary.role ?? undefined,
      townHallLevel: summary.townHallLevel ?? detail?.townHallLevel ?? undefined,
      trophies: currentTrophies ?? undefined,
      rankedTrophies: rankedTrophies ?? undefined,
      rankedLeagueId: rankedLeagueId ?? undefined,
      rankedLeagueName: rankedLeagueName ?? undefined,
      donations: donationsGiven ?? undefined,
      donationsReceived: donationsReceived ?? undefined,
      seasonTotalTrophies: currentTrophies ?? undefined,
      enriched: memberEnriched,
    } as Member;

    const activityEvidence = calculateActivityScore(memberForActivity);

    const canonicalSnapshot = buildCanonicalMemberSnapshot({
      clanTag,
      clanName,
      snapshotId,
      fetchedAt: snapshot.fetchedAt,
      computedAt,
      memberCount: snapshot.metadata.memberCount,
      totalTrophies,
      totalDonations,
        member: {
          tag,
          name: memberName ?? null,
          role: summary.role ?? null,
          townHallLevel: summary.townHallLevel ?? detail?.townHallLevel ?? null,
          trophies: currentTrophies ?? null,
          battleModeTrophies: currentRankedValue ?? null,
          league: leagueSource
            ? {
                id: leagueId,
                name: leagueName,
                trophies: leagueTrophies,
                iconSmall: leagueIconSmall,
                iconMedium: leagueIconMedium,
              }
            : null,
          ranked: {
            trophies: rankedSnapshotValue ?? null,
            leagueId: rankedLeagueId ?? null,
            leagueName: rankedLeagueName ?? null,
            iconSmall: rankedIconSmall,
            iconMedium: rankedIconMedium,
          },
        donations: {
          given: donationsGiven ?? null,
          received: donationsReceived ?? null,
        },
        activityScore: activityEvidence?.score ?? null,
        heroLevels,
        rushPercent,
        war: {
          stars: memberEnriched.warStars ?? null,
          attackWins: memberEnriched.attackWins ?? null,
          defenseWins: memberEnriched.defenseWins ?? null,
        },
        builderBase: {
          hallLevel: memberEnriched.builderHallLevel ?? null,
          trophies: memberEnriched.versusTrophies ?? null,
          battleWins: memberEnriched.versusBattleWins ?? null,
          leagueId: memberEnriched.builderLeagueId ?? null,
        },
        capitalContributions: memberEnriched.capitalContributions ?? null,
        pets: memberEnriched.petLevels ?? null,
        equipmentLevels: memberEnriched.equipmentLevels ?? null,
        achievements: {
          count: memberEnriched.achievementCount ?? null,
          score: memberEnriched.achievementScore ?? null,
        },
        expLevel: memberEnriched.expLevel ?? null,
        bestTrophies: memberEnriched.bestTrophies ?? null,
        bestVersusTrophies: memberEnriched.bestVersusTrophies ?? null,
        superTroopsActive: memberEnriched.superTroopsActive ?? null,
        tenure: {
          days: null,
          asOf: null,
        },
        extras,
      },
    });

    canonicalRows.push({
      clan_tag: clanTag,
      player_tag: tag,
      snapshot_id: snapshotId,
      snapshot_date: canonicalSnapshot.snapshotDate,
      schema_version: canonicalSnapshot.schemaVersion,
      payload: canonicalSnapshot,
    });

    const canonicalState: CanonicalPlayerState = {
      date: canonicalSnapshot.snapshotDate,
      clanTag,
      playerTag: tag,
      th: canonicalSnapshot.member.townHallLevel ?? null,
      league: canonicalSnapshot.member.ranked.leagueName
        ?? canonicalSnapshot.member.league?.name
        ?? null,
      trophies: rankedSnapshotValue ?? canonicalSnapshot.member.trophies ?? null,
      donations: canonicalSnapshot.member.donations.given ?? null,
      donationsReceived: canonicalSnapshot.member.donations.received ?? null,
      warStars: canonicalSnapshot.member.war.stars ?? null,
      attackWins: memberEnriched.attackWins ?? detail?.attackWins ?? null,
      defenseWins: memberEnriched.defenseWins ?? detail?.defenseWins ?? null,
      capitalContrib: canonicalSnapshot.member.capitalContributions ?? null,
      legendAttacks: null,
      builderHallLevel: memberEnriched.builderHallLevel ?? summary.builderHallLevel ?? null,
      builderWins: memberEnriched.versusBattleWins ?? null,
      builderTrophies: memberEnriched.versusTrophies ?? toNumeric(summary.builderTrophies) ?? null,
      heroLevels: heroLevels ?? null,
      equipmentLevels: memberEnriched.equipmentLevels ?? null,
      pets: memberEnriched.petLevels ?? null,
      superTroopsActive: memberEnriched.superTroopsActive ?? null,
      achievements:
        memberEnriched.achievementCount != null || memberEnriched.achievementScore != null
          ? {
              count: memberEnriched.achievementCount ?? null,
              score: memberEnriched.achievementScore ?? null,
            }
          : null,
      rushPercent: rushPercent ?? null,
      expLevel: memberEnriched.expLevel ?? null,
    };

    playerDayStates.push(canonicalState);

    const statsExtras = {
      ...extras,
      tournamentStats,
      tournamentFinalTrophies,
      currentRankedTrophies: currentRankedValue,
    };

    // Handle Monday reset: After 00:00 UTC Monday, ranked trophies should be 0
    const fetchedAtIso = snapshot.fetchedAt ?? null;
    const fetchedDate = fetchedAtIso ? new Date(fetchedAtIso) : null;
    const isMonday = fetchedDate ? fetchedDate.getUTCDay() === 1 : false;
    const isAfterReset = fetchedDate ? fetchedDate.getUTCHours() >= 0 : false; // After 00:00 UTC
    
    // On Monday after reset, force trophies to 0 (new week started)
    // On Monday before reset, use tournament final if available
    const finalWithinBounds = (v: number | null) => v != null && Number.isFinite(v) && v > 0 && v <= 600;
    const mondayFinal = isMonday && isAfterReset ? 0 : (isMonday && finalWithinBounds(tournamentFinalTrophies) ? tournamentFinalTrophies : 0);

    return {
      snapshot_id: snapshotId,
      member_id: memberId,
      snapshot_date: snapshot.fetchedAt ? snapshot.fetchedAt.slice(0, 10) : null,
      th_level: summary.townHallLevel ?? detail?.townHallLevel ?? null,
      role: summary.role ?? null,
      trophies: isMonday ? mondayFinal : (detail?.trophies ?? summary.trophies ?? null),  // Use mondayFinal on Monday, otherwise current ranked trophies
      donations: summary.donations ?? null,
      donations_received: summary.donationsReceived ?? null,
      hero_levels: heroLevels,
      activity_score: activityEvidence?.score ?? null,
      rush_percent: rushPercent,
      extras: statsExtras,
      league_id: leagueId,
      league_name: leagueName,
      league_trophies: leagueTrophies,
      ranked_trophies: mondayFinal,
      ranked_league_id: rankedLeagueId,
      ranked_league_name: rankedLeagueName,
      battle_mode_trophies: currentRankedValue,
      equipment_flags: memberEnriched.equipmentLevels ?? detail?.equipment ?? null,
      // War stats & enriched fields
      war_stars: memberEnriched.warStars ?? detail?.warStars ?? null,
      attack_wins: memberEnriched.attackWins ?? detail?.attackWins ?? null,
      defense_wins: memberEnriched.defenseWins ?? detail?.defenseWins ?? null,
      capital_contributions: memberEnriched.capitalContributions ?? detail?.clanCapitalContributions ?? null,
      pet_levels: memberEnriched.petLevels ?? null,
      builder_hall_level: memberEnriched.builderHallLevel ?? summary.builderHallLevel ?? null,
      versus_trophies: memberEnriched.versusTrophies ?? toNumeric(summary.builderTrophies) ?? null,
      versus_battle_wins: memberEnriched.versusBattleWins ?? null,
      builder_league_id: memberEnriched.builderLeagueId ?? null,
      max_troop_count: memberEnriched.maxTroopCount ?? null,
      max_spell_count: memberEnriched.maxSpellCount ?? null,
      super_troops_active: memberEnriched.superTroopsActive ?? null,
      achievement_count: memberEnriched.achievementCount ?? null,
      achievement_score: memberEnriched.achievementScore ?? null,
      exp_level: memberEnriched.expLevel ?? detail?.expLevel ?? null,
      best_trophies: memberEnriched.bestTrophies ?? detail?.bestTrophies ?? null,
      best_versus_trophies: memberEnriched.bestVersusTrophies ?? detail?.bestVersusTrophies ?? null,
    };
  }).filter(Boolean) as any[];

  if (snapshotStats.length) {
    const { error: statsError } = await supabase
      .from('member_snapshot_stats')
      .insert(snapshotStats);

    if (statsError) {
      throw new Error(`[persist-roster] Failed to insert member snapshot stats: ${statsError.message}`);
    }
  }

  if (canonicalRows.length) {
    const { error: canonicalError } = await supabase
      .from('canonical_member_snapshots')
      .upsert(canonicalRows, { onConflict: 'snapshot_id,player_tag', ignoreDuplicates: false });

    if (canonicalError) {
      console.warn('[persist-roster] Failed to upsert canonical member snapshots', canonicalError);
    }
  }

  if (playerDayStates.length) {
    for (const state of playerDayStates) {
      try {
        let previousState: CanonicalPlayerState | undefined;
        const { data: prevRow, error: prevError } = await supabase
          .from('player_day')
          .select(
            'date, th, league, trophies, donations, donations_rcv, war_stars, attack_wins, defense_wins, capital_contrib, legend_attacks, builder_hall_level, builder_battle_wins, builder_trophies, hero_levels, equipment_levels, pets, super_troops_active, achievements, rush_percent, exp_level, snapshot_hash',
          )
          .eq('player_tag', state.playerTag)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevError && prevError.code !== 'PGRST116') {
          console.warn('[persist-roster] Failed to load previous player_day row', { tag: state.playerTag, error: prevError.message });
        }

        if (prevRow) {
          previousState = {
            date: prevRow.date,
            clanTag: state.clanTag,
            playerTag: state.playerTag,
            th: prevRow.th ?? null,
            league: prevRow.league ?? null,
            trophies: prevRow.trophies ?? null,
            donations: prevRow.donations ?? null,
            donationsReceived: prevRow.donations_rcv ?? null,
            warStars: prevRow.war_stars ?? null,
            attackWins: prevRow.attack_wins ?? null,
            defenseWins: prevRow.defense_wins ?? null,
            capitalContrib: prevRow.capital_contrib ?? null,
            legendAttacks: prevRow.legend_attacks ?? null,
            builderHallLevel: prevRow.builder_hall_level ?? null,
            builderWins: prevRow.builder_battle_wins ?? null,
            builderTrophies: prevRow.builder_trophies ?? null,
            heroLevels: (prevRow.hero_levels as any) ?? null,
            equipmentLevels: (prevRow.equipment_levels as any) ?? null,
            pets: (prevRow.pets as any) ?? null,
            superTroopsActive: prevRow.super_troops_active ?? null,
            achievements: (prevRow.achievements as any) ?? null,
            rushPercent: prevRow.rush_percent ?? null,
            expLevel: prevRow.exp_level ?? null,
          };
        }

        const dayRow = generatePlayerDayRow(previousState, state);

        if (prevRow?.date === dayRow.date && prevRow.snapshot_hash === dayRow.snapshotHash) {
          continue;
        }

        const { error: playerDayError } = await supabase
          .from('player_day')
          .upsert({
            player_tag: dayRow.playerTag,
            clan_tag: dayRow.clanTag,
            date: dayRow.date,
            th: dayRow.th,
            league: dayRow.league,
            trophies: dayRow.trophies,
            donations: dayRow.donations,
            donations_rcv: dayRow.donationsReceived,
            war_stars: dayRow.warStars,
            attack_wins: dayRow.attackWins,
            defense_wins: dayRow.defenseWins,
            capital_contrib: dayRow.capitalContrib,
            legend_attacks: dayRow.legendAttacks,
            builder_hall_level: dayRow.builderHallLevel,
            builder_battle_wins: dayRow.builderBattleWins,
            builder_trophies: dayRow.builderTrophies,
            hero_levels: dayRow.heroLevels,
            equipment_levels: dayRow.equipmentLevels,
            pets: dayRow.pets,
            super_troops_active: dayRow.superTroopsActive,
            achievements: dayRow.achievements,
            rush_percent: dayRow.rushPercent,
            exp_level: dayRow.expLevel,
            deltas: dayRow.deltas,
            events: dayRow.events,
            notability: dayRow.notability,
            snapshot_hash: dayRow.snapshotHash,
          }, { onConflict: 'player_tag,date', ignoreDuplicates: false });

        if (playerDayError) {
          console.warn('[persist-roster] Failed to upsert player_day row', { tag: state.playerTag, error: playerDayError.message });
        }
      } catch (error) {
        console.warn('[persist-roster] Unexpected error writing player_day row', state.playerTag, error);
      }
    }
  }

  const tagRoleMap = new Map<string, ClanRoleName>();
  snapshot.memberSummaries.forEach((summary) => {
    const tag = normalizeTag(summary.tag);
    if (tag) {
      tagRoleMap.set(tag, normalizeClanRole(summary.role));
    }
  });
  await syncUserRolesForClan(clanRow.id, tagRoleMap);
}
