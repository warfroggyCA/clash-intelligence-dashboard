import { FullClanSnapshot } from '@/lib/full-snapshot';
import { normalizeTag } from '@/lib/tags';
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

type SupabaseClient = ReturnType<typeof getSupabaseAdminClient>;

interface ParsedWar {
  source: 'log' | 'current';
  raw: any;
  clanTag: string;
  opponentTag: string | null;
  record: {
    clan_tag: string;
    opponent_tag: string | null;
    opponent_name: string | null;
    opponent_level: number | null;
    war_type: string;
    state: string | null;
    result: string | null;
    preparation_start: string | null;
    battle_start: string | null;
    battle_end: string | null;
    team_size: number | null;
    attacks_per_member: number | null;
    clan_stars: number | null;
    clan_destruction: number | null;
    opponent_stars: number | null;
    opponent_destruction: number | null;
    raw: any;
  };
  sides: Array<{
    isHome: boolean;
    data: any;
  }>;
}

const MAX_BULK_INSERT = 500;

function parseCoCTime(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})\.(\d{3})Z$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, millis] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${millis}Z`;
}

function safeNumber(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function safeString(value: any): string | null {
  if (typeof value === 'string' && value.trim().length) return value;
  return null;
}

function resolveWarType(entry: any): string {
  if (!entry) return 'regular';
  if (entry.isFriendly === true || entry.warType === 'friendly') return 'friendly';
  if (entry.warType === 'league' || entry.leagueGroupId) return 'cwl';
  return 'regular';
}

function buildParsedWars(snapshot: FullClanSnapshot): ParsedWar[] {
  const wars: ParsedWar[] = [];
  const homeClanTag = normalizeTag(snapshot.clanTag);
  const warEntries = Array.isArray(snapshot.warLog) ? snapshot.warLog : [];

  for (const entry of warEntries) {
    if (!entry || !entry.clan) continue;
    const clanTag = normalizeTag(entry.clan.tag || homeClanTag);
    if (clanTag !== homeClanTag) continue; // only keep wars for our clan
    const opponentTag = entry.opponent?.tag ? normalizeTag(entry.opponent.tag) : null;
    wars.push({
      source: 'log',
      raw: entry,
      clanTag,
      opponentTag,
      record: {
        clan_tag: clanTag,
        opponent_tag: opponentTag,
        opponent_name: entry.opponent?.name ?? null,
        opponent_level: safeNumber(entry.opponent?.clanLevel ?? entry.opponent?.level),
        war_type: resolveWarType(entry),
        state: entry.state ?? 'warEnded',
        result: entry.result ?? entry.clan?.result ?? null,
        preparation_start: parseCoCTime(entry.preparationStartTime ?? null),
        battle_start: parseCoCTime(entry.startTime ?? entry.endTime ?? null),
        battle_end: parseCoCTime(entry.endTime ?? null),
        team_size: safeNumber(entry.teamSize),
        attacks_per_member: safeNumber(entry.attacksPerMember),
        clan_stars: safeNumber(entry.clan?.stars),
        clan_destruction: safeNumber(entry.clan?.destructionPercentage),
        opponent_stars: safeNumber(entry.opponent?.stars),
        opponent_destruction: safeNumber(entry.opponent?.destructionPercentage),
        raw: entry,
      },
      sides: [
        { isHome: true, data: entry.clan },
        { isHome: false, data: entry.opponent },
      ],
    });
  }

  if (snapshot.currentWar && snapshot.currentWar.clan) {
    const current = snapshot.currentWar;
    const clanTag = normalizeTag(current.clan.tag || homeClanTag);
    if (clanTag === homeClanTag) {
      const opponentTag = current.opponent?.tag ? normalizeTag(current.opponent.tag) : null;
      wars.push({
        source: 'current',
        raw: current,
        clanTag,
        opponentTag,
        record: {
          clan_tag: clanTag,
          opponent_tag: opponentTag,
          opponent_name: current.opponent?.name ?? null,
          opponent_level: safeNumber(current.opponent?.clanLevel ?? current.opponent?.level),
          war_type: resolveWarType(current),
          state: current.state ?? 'preparation',
          result: current.result ?? null,
          preparation_start: parseCoCTime(current.preparationStartTime ?? null),
          battle_start: parseCoCTime(current.startTime ?? current.endTime ?? null),
          battle_end: parseCoCTime(current.endTime ?? null),
          team_size: safeNumber(current.teamSize),
          attacks_per_member: safeNumber(current.attacksPerMember),
          clan_stars: safeNumber(current.clan?.stars),
          clan_destruction: safeNumber(current.clan?.destructionPercentage),
          opponent_stars: safeNumber(current.opponent?.stars),
          opponent_destruction: safeNumber(current.opponent?.destructionPercentage),
          raw: current,
        },
        sides: [
          { isHome: true, data: current.clan },
          { isHome: false, data: current.opponent },
        ],
      });
    }
  }

  return wars;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildMemberRecords(warId: string, clanTag: string, members: any[], isHome: boolean) {
  if (!Array.isArray(members)) return [];
  return members.map((member: any) => {
    const playerTag = member?.tag ? normalizeTag(member.tag) : null;
    if (!playerTag) return null;
    const attacks = Array.isArray(member.attacks) ? member.attacks.length : safeNumber(member.attacks);
    const defenses = safeNumber(member.defenseCount ?? (Array.isArray(member.defenses) ? member.defenses.length : undefined));
    const bestOpponentAttack = member.bestOpponentAttack ?? (Array.isArray(member.defenses) ? member.defenses[0] : null);
    return {
      war_id: warId,
      clan_tag: clanTag,
      player_tag: playerTag,
      player_name: member.name ?? null,
      town_hall_level: safeNumber(member.townhallLevel ?? member.townHallLevel),
      map_position: safeNumber(member.mapPosition),
      attacks: safeNumber(attacks),
      stars: safeNumber(member.stars),
      destruction: safeNumber(member.destructionPercentage),
      defense_count: defenses,
      defense_destruction: safeNumber(bestOpponentAttack?.destructionPercentage),
      is_home: isHome,
      raw: member,
    };
  }).filter(Boolean) as any[];
}

function buildAttackRecords(
  warId: string,
  attackerClanTag: string,
  defenderClanTag: string | null,
  members: any[],
  opponentMembers: Map<string, any>,
  isHome: boolean
) {
  if (!Array.isArray(members)) return [];
  const attacks: any[] = [];
  for (const member of members) {
    const attackerTag = member?.tag ? normalizeTag(member.tag) : null;
    if (!attackerTag || !Array.isArray(member.attacks)) continue;
    const attackerName = member.name ?? null;
    member.attacks.forEach((attack: any, index: number) => {
      const defenderTag = attack?.defenderTag ? normalizeTag(attack.defenderTag) : null;
      const defender = defenderTag ? opponentMembers.get(defenderTag) : null;
      const orderIndex = safeNumber(attack.order ?? attack.attackOrder ?? index + 1) ?? index + 1;
      let occurredAt: string | null = null;
      if (attack?.timestamp) {
        occurredAt = parseCoCTime(attack.timestamp);
      }
      if (!occurredAt) {
        const base = parseCoCTime(attack?.battleTime) || parseCoCTime(attack?.startTime);
        if (base) {
          const baseDate = new Date(base);
          occurredAt = new Date(baseDate.getTime() + orderIndex * 1000).toISOString();
        }
      }
      if (!occurredAt) {
        occurredAt = new Date(Date.now() + orderIndex * 1000).toISOString();
      }
      attacks.push({
        war_id: warId,
        attacker_tag: attackerTag,
        attacker_name: attackerName,
        defender_tag: defenderTag,
        defender_name: defender?.name ?? attack?.defenderName ?? null,
        attacker_clan_tag: attackerClanTag,
        defender_clan_tag: defenderClanTag,
        order_index: orderIndex,
        stars: safeNumber(attack.stars),
        destruction: safeNumber(attack.destructionPercentage),
        duration: safeNumber(attack.duration),
        is_best_attack: attack.isBestAttack ?? false,
        attack_time: occurredAt,
        raw: attack,
      });
    });
  }
  return attacks;
}

function buildActivityEvents(
  clanTag: string,
  warRecord: ParsedWar['record'],
  attacks: any[],
  source: 'log' | 'current'
) {
  return attacks
    .filter((attack) => attack.attacker_clan_tag === clanTag)
    .map((attack) => ({
      clan_tag: clanTag,
      player_tag: attack.attacker_tag,
      event_type: 'war_attack',
      source: source === 'current' ? 'current-war' : 'war-log',
      occurred_at: attack.attack_time,
      value: safeNumber(attack.stars),
      metadata: {
        opponent: warRecord.opponent_tag,
        war_type: warRecord.war_type,
        order_index: attack.order_index,
        destruction: attack.destruction,
        is_best_attack: attack.is_best_attack ?? false,
      },
    }));
}

async function upsertInChunks(client: SupabaseClient, table: string, records: any[], conflict: string) {
  const batches = chunk(records, MAX_BULK_INSERT);
  for (const batch of batches) {
    if (!batch.length) continue;
    const { error } = await client.from(table).upsert(batch, { onConflict: conflict, ignoreDuplicates: false });
    if (error) {
      throw new Error(`[${table}] upsert failed: ${error.message}`);
    }
  }
}

export async function persistWarData(snapshot: FullClanSnapshot): Promise<void> {
  const wars = buildParsedWars(snapshot);
  if (!wars.length) return;
  const supabase = getSupabaseAdminClient();

  console.log('[persistWarData] persisting wars', {
    clanTag: snapshot.clanTag,
    wars: wars.length,
  });

  for (const war of wars) {
    try {
      const { data: warRows, error: warError } = await supabase
        .from('clan_wars')
        .upsert(war.record, {
          onConflict: 'clan_tag,war_type,battle_start',
          ignoreDuplicates: false,
        })
        .select('id, clan_tag, war_type, battle_start');

      if (warError) {
        console.warn('[persistWarData] Failed to upsert clan_wars', war.record, warError.message);
        continue;
      }
      let warId: string | null = null;
      if (Array.isArray(warRows) && warRows.length) {
        warId = warRows[0]?.id ?? null;
      } else if (warRows && typeof warRows === 'object') {
        warId = (warRows as any).id ?? null;
      }
      if (!warId) {
        let query = supabase
          .from('clan_wars')
          .select('id')
          .eq('clan_tag', war.record.clan_tag)
          .eq('war_type', war.record.war_type)
          .limit(1);
        if (war.record.battle_start) {
          query = query.eq('battle_start', war.record.battle_start);
        } else {
          query = query.is('battle_start', null);
        }
        const { data: lookupRows, error: lookupError } = await query;
        if (lookupError) {
          console.warn('[persistWarData] Failed to lookup war id after upsert', lookupError.message);
          continue;
        }
        warId = lookupRows?.[0]?.id ?? null;
        if (!warId) {
          console.warn('[persistWarData] Upsert clan_wars returned no id and lookup failed', war.record);
          continue;
        }
      }

      const clanRecords = war.sides
        .map((side) => {
          if (!side.data) return null;
          const tag = side.data.tag ? normalizeTag(side.data.tag) : side.isHome ? war.clanTag : war.opponentTag;
          if (!tag) return null;
          return {
            war_id: warId,
            clan_tag: tag,
            clan_name: side.data.name ?? null,
            clan_level: safeNumber(side.data.clanLevel ?? side.data.level),
            badge: side.data.badgeUrls ?? null,
            stars: safeNumber(side.data.stars),
            destruction: safeNumber(side.data.destructionPercentage),
            attacks_used: safeNumber(side.data.attacks ?? side.data.attacksUsed),
            exp_earned: safeNumber(side.data.expEarned),
            is_home: side.isHome,
          };
        })
        .filter(Boolean) as any[];

      if (clanRecords.length) {
        await upsertInChunks(supabase, 'clan_war_clans', clanRecords, 'war_id,clan_tag');
      }

      const opponentMembers = new Map<string, any>();
      const opponentSide = war.sides.find((s) => !s.isHome)?.data;
      if (Array.isArray(opponentSide?.members)) {
        opponentSide.members.forEach((member: any) => {
          if (member?.tag) {
            opponentMembers.set(normalizeTag(member.tag), member);
          }
        });
      }

      const memberRecords: any[] = [];
      const attackRecords: any[] = [];

      for (const side of war.sides) {
        if (!Array.isArray(side.data?.members)) continue;
        const sideClanTag = side.isHome ? war.clanTag : war.opponentTag;
        if (!sideClanTag) continue;
        const members = buildMemberRecords(warId, sideClanTag, side.data.members, side.isHome);
        memberRecords.push(...members);
        const attacks = buildAttackRecords(
          warId,
          sideClanTag,
          side.isHome ? war.opponentTag : war.clanTag,
          side.data.members,
          side.isHome ? opponentMembers : new Map(),
          side.isHome
        );
        attackRecords.push(...attacks);
      }

      if (memberRecords.length) {
        await upsertInChunks(supabase, 'clan_war_members', memberRecords, 'war_id,player_tag');
      }
      if (attackRecords.length) {
        await upsertInChunks(supabase, 'clan_war_attacks', attackRecords, 'war_id,attacker_tag,defender_tag,order_index');
      }

      const activityEvents = buildActivityEvents(war.clanTag, war.record, attackRecords, war.source);
      if (activityEvents.length) {
        await upsertInChunks(supabase, 'player_activity_events', activityEvents, 'clan_tag,player_tag,event_type,source,occurred_at');
      }
    } catch (error: any) {
      console.warn('[persistWarData] Failed to persist war entry', {
        clanTag: war.clanTag,
        opponentTag: war.opponentTag,
        error: error?.message || error,
      });
    }
  }
}
