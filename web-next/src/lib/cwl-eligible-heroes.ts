import { normalizeTag } from './tags';
import { getLatestRosterSnapshot, resolveRosterMembers } from './roster-resolver';

const HERO_KEYS = ['bk', 'aq', 'gw', 'rc', 'mp'] as const;

export const hasHeroLevels = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return HERO_KEYS.some((key) => {
    const raw = record[key];
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0;
  });
};

export const getHeroLevelsByTag = async (supabase: any, clanTag: string) => {
  const latestSnapshot = await getLatestRosterSnapshot({ clanTag, supabase });
  if (!latestSnapshot) return new Map<string, Record<string, unknown> | null>();
  const { members } = await resolveRosterMembers({
    supabase,
    clanTag: latestSnapshot.clanTag,
    snapshotId: latestSnapshot.snapshotId,
    snapshotDate: latestSnapshot.snapshotDate,
  });
  return new Map(
    members.map((member) => [normalizeTag(member.tag), member.hero_levels ?? null]),
  );
};
