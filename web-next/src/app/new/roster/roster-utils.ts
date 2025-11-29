import type { RosterMember } from '@/app/(dashboard)/simple-roster/roster-transform';
import { calculateRushPercentage, getMemberActivity } from '@/lib/business/calculations';
import type { Member } from '@/types';

export type RoleKey = 'leader' | 'coleader' | 'elder' | 'member';

export const normalizeRole = (role?: string | null): RoleKey => {
  const value = (role || '').toLowerCase();
  if (value.includes('co')) return 'coleader';
  if (value.includes('elder')) return 'elder';
  if (value.includes('leader')) return 'leader';
  return 'member';
};

export const resolveTownHall = (member: RosterMember): number | null =>
  member.townHallLevel ?? (member as any).th ?? null;

export const resolveTrophies = (member: RosterMember): number =>
  member.rankedTrophies ?? member.trophies ?? 0;

export const resolveLeague = (member: RosterMember): { league: string; tier?: string | number } => {
  const raw =
    member.rankedLeagueName ??
    (typeof (member as any).rankedLeague === 'object' ? (member as any).rankedLeague?.name : null) ??
    member.leagueName ??
    '';

  const tierFromObj = (member as any).rankedLeague?.tier ?? (member as any).rankedModifier?.tier;
  const match = raw.match(/^(.*?)(?:\s+([IVX]+|\d+))?$/);
  const base = match?.[1]?.trim() || raw?.trim() || 'No League';
  const tier = tierFromObj ?? match?.[2];

  return { league: base, tier: tier ?? undefined };
};

export const resolveRushPercent = (member: RosterMember): number | null => {
  if (typeof member.rushPercent === 'number') {
    return member.rushPercent;
  }
  const computed = calculateRushPercentage(member as Member);
  return typeof computed === 'number' ? computed : null;
};

export const rushTone = (value?: number | null) => {
  const num = typeof value === 'number' ? value : 0;
  if (num < 10) return 'var(--success)';
  if (num < 20) return 'var(--warning)';
  return 'var(--danger)';
};

export const formatRush = (value?: number | null) =>
  typeof value === 'number' ? `${value.toFixed(1)}%` : '—';

export const resolveActivity = (member: RosterMember) => {
  const evidence = getMemberActivity(member as Member);
  const score = evidence?.score ?? 0;

  let band: 'High' | 'Medium' | 'Low';
  if (score >= 45) band = 'High';
  else if (score >= 28) band = 'Medium';
  else band = 'Low';

  const tone = band === 'High' ? 'var(--success)' : band === 'Medium' ? 'var(--warning)' : 'var(--danger)';

  return { band, tone, score, evidence };
};
