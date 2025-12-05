"use client";

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import Card from '@/components/new-ui/Card';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import LeagueIcon from '@/components/new-ui/icons/LeagueIcon';
import RoleIcon from '@/components/new-ui/icons/RoleIcon';
import HeroIcon from '@/components/new-ui/icons/HeroIcon';
import { heroIconMap } from '@/components/new-ui/icons/maps';
import { playerProfileFetcher } from '@/lib/api/swr-fetcher';
import { playerProfileSWRConfig } from '@/lib/api/swr-config';
import type { SupabasePlayerProfilePayload } from '@/types/player-profile-supabase';
import { formatNumber } from '@/lib/format';
import {
  getEquipmentByName,
  getHeroForEquipment,
  heroEquipmentData,
  getPetByName,
  heroPetsData,
  PET_MAX_LEVEL,
  type HeroEquipment,
} from '@/lib/hero-equipment';
import { Button } from '@/components/new-ui/Button';
import { useRosterData } from '../../roster/useRosterData';
import { normalizeTag } from '@/lib/tags';
import { resolveLeague, resolveTownHall } from '../../roster/roster-utils';
import { HERO_MAX_LEVELS } from '@/types';
import { rushTone } from '../../roster/roster-utils';
import Link from 'next/link';

const heroOrder: Array<'bk' | 'aq' | 'gw' | 'rc' | 'mp'> = ['bk', 'aq', 'gw', 'rc', 'mp'];
const heroLabels: Record<typeof heroOrder[number], string> = {
  bk: 'Barbarian King',
  aq: 'Archer Queen',
  gw: 'Grand Warden',
  rc: 'Royal Champion',
  mp: 'Minion Prince',
};

const parseAssociatedHeroes = (value?: string): Array<typeof heroOrder[number]> => {
  if (!value) return [];
  const parts = value
    .toLowerCase()
    .split(/,|\/| or | and /g)
    .map((p) => p.trim())
    .filter(Boolean);
  const keys = new Set<typeof heroOrder[number]>();
  parts.forEach((p) => {
    if (p.includes('barbarian')) keys.add('bk');
    if (p.includes('king') && !p.includes('minion')) keys.add('bk');
    if (p.includes('archer')) keys.add('aq');
    if (p.includes('queen')) keys.add('aq');
    if (p.includes('warden')) keys.add('gw');
    if (p.includes('champion')) keys.add('rc');
    if (p.includes('rc')) keys.add('rc');
    if (p.includes('minion')) keys.add('mp');
  });
  return Array.from(keys);
};

const heroKeyFromName = (hero: string): typeof heroOrder[number] | null => {
  const lower = hero.toLowerCase();
  if (lower.includes('barbarian')) return 'bk';
  if (lower.includes('archer')) return 'aq';
  if (lower.includes('warden')) return 'gw';
  if (lower.includes('champion')) return 'rc';
  if (lower.includes('minion')) return 'mp';
  return null;
};

const cleanEquipmentName = (value: string) =>
  value
    ?.replace(/\blevel\s*\d+/i, '')
    ?.replace(/\blv\.?\s*\d+/i, '')
    ?.replace(/\d+$/i, '')
    ?.replace(/\s{2,}/g, ' ')
    ?.trim();

const normalizeEquip = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizePet = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const equipmentIconMap: Record<string, string> = {
  // Archer Queen
  archerpuppet: '/assets/equipment/Hero_Equipment_AQ_Archer_Puppet.png',
  frozenarrow: '/assets/equipment/Hero_Equipment_AQ_Frozen_Arrow.png',
  giantarrow: '/assets/equipment/Hero_Equipment_AQ_Giant_Arrow.png',
  healerpuppet: '/assets/equipment/Hero_Equipment_AQ_Healer_Puppet.png',
  invisibilityvial: '/assets/equipment/Hero_Equipment_AQ_Invisibility_Vial.png',
  magicmirror: '/assets/equipment/Hero_Equipment_AQ_Magic_Mirror.png',
  actionfigure: '/assets/equipment/Hero_Equipment_AQ_WWEActionFigure.png',
  wweactionfigure: '/assets/equipment/Hero_Equipment_AQ_WWEActionFigure.png',
  // Barbarian King
  barbarianpuppet: '/assets/equipment/Hero_Equipment_BK_Barbarian_Puppet.png',
  earthquakeboots: '/assets/equipment/Hero_Equipment_BK_Earthquake_Boots.png',
  ragevial: '/assets/equipment/Hero_Equipment_BK_Rage_Vial.png',
  snakebracelet: '/assets/equipment/Hero_Equipment_BK_SnakeBracelet.png',
  vampstache: '/assets/equipment/Hero_Equipment_BK_Vampstache.png',
  giantgauntlet: '/assets/equipment/Hero_Equipment_BQ_Giant_Gauntlet.png',
  spikyball: '/assets/equipment/Hero_Equipment_BK_Spiky_Ball.png',
  // Grand Warden
  eternaltome: '/assets/equipment/Hero_Equipment_GW_Eternal_Tome.png',
  fireball: '/assets/equipment/Hero_Equipment_GW_Fireball.png',
  healingtome: '/assets/equipment/Hero_Equipment_GW_Healing_Tome.png',
  lifegem: '/assets/equipment/Hero_Equipment_GW_Life_Gem.png',
  ragegem: '/assets/equipment/Hero_Equipment_GW_Rage_Gem.png',
  heroictorch: '/assets/equipment/HeroGear_GW_Olympic_Torch_hh0000.png',
  torch: '/assets/equipment/HeroGear_GW_Olympic_Torch_hh0000.png',
  lavaloonpuppet: '/assets/equipment/icon_gear_GW_LavaloonPuppet.png',
  // Royal Champion
  electroboots: '/assets/equipment/Hero_Equipment_RC_ElectroBoots.png',
  hastevial: '/assets/equipment/Hero_Equipment_RC_Haste_Vial.png',
  hogriderdoll: '/assets/equipment/Hero_Equipment_RC_Hog_Rider_Doll.png',
  hogriderpuppet: '/assets/equipment/Hero_Equipment_RC_Hog_Rider_Doll.png',
  royalgem: '/assets/equipment/Hero_Equipment_RC_Royal_Gem.png',
  seekingshield: '/assets/equipment/Hero_Equipment_RC_Seeking_Shield.png',
  rocketspear: '/assets/equipment/HeroGear_RoyalChampion_RocketSpear_Equipment_03.png',
  // Minion Prince
  darkcrown: '/assets/equipment/HeroGear_MP_DarkCrown_2k.png',
  darkorb: '/assets/equipment/Hero_Equipment_MP_DarkOrb.png',
  henchman: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  henchmanpuppet: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  henchmenpuppet: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  henchmen: '/assets/equipment/Hero_Equipment_MP_Henchman.png',
  powerpump: '/assets/equipment/Hero_Equipment_MP_PowerPump.png',
  nobleiron: '/assets/equipment/Hero_Equipment_MP_PowerPump.png',
  ironpants: '/assets/equipment/HeroEquipment_MP_IronPants.png',
  metalpants: '/assets/equipment/HeroEquipment_MP_IronPants.png',
  meteorstaff: '/assets/equipment/HeroGear_MP_MeteoriteSceptre.png',
  meteoritesceptre: '/assets/equipment/HeroGear_MP_MeteoriteSceptre.png',
  meteorsceptre: '/assets/equipment/HeroGear_MP_MeteoriteSceptre.png',
  // Misc (extra assets)
  geardarkcrown: '/assets/equipment/HeroGear_MP_DarkCrown_2k.png',
};

const petIconMap: Record<string, string> = {
  lassi: '/assets/pets/Hero_Pet_HV_L.A.S.S.I_1.png',
  electroowl: '/assets/pets/Hero_Pet_HV_Electro_Owl.png',
  mightyyak: '/assets/pets/Hero_Pet_HV_Mighty_Yak_1.png',
  unicorn: '/assets/pets/Hero_Pet_HV_Unicorn_2.png',
  frosty: '/assets/pets/Hero_Pet_HV_Frosty_2.png',
  diggy: '/assets/pets/Hero_Pet_HV_Diggy_2.png',
  poisonlizard: '/assets/pets/Hero_Pet_HV_Poison_Lizard_1.png',
  phoenix: '/assets/pets/Hero_Pet_HV_Phoenix_1_shadow.png',
  spiritfox: '/assets/pets/Hero_Pet_HV_Spirit_Fox.png',
  angryjelly: '/assets/pets/Hero_Pet_HV_Angry_Jelly_05.png',
  sneezy: '/assets/pets/Icon_HV_Hero_Pets_Sneezy.png',
};

const getEquipmentIcon = (name: string): string | undefined => {
  const cleanName = cleanEquipmentName(name) || name;
  const key = normalizeEquip(cleanName);
  if (equipmentIconMap[key]) return equipmentIconMap[key];
  // Heuristic fallbacks
  if (key.includes('henchman') || key.includes('henchmen')) return equipmentIconMap.henchman;
  if (key.includes('hogrider')) return equipmentIconMap.hogriderdoll;
  if (key.includes('ironpant') || key.includes('metalpant')) return equipmentIconMap.ironpants;
  if (key.includes('darkcrown')) return equipmentIconMap.darkcrown;
  if (key.includes('darkorb')) return equipmentIconMap.darkorb;
  if (key.includes('meteor')) return equipmentIconMap.meteorstaff;
  if (key.includes('torch')) return equipmentIconMap.heroictorch;
  return undefined;
};

const getPetIcon = (name: string): string | undefined => {
  const key = normalizePet(name);
  if (petIconMap[key]) return petIconMap[key];
  if (key.includes('lassi')) return petIconMap.lassi;
  return undefined;
};

const classifyEquipmentHero = (name: string): 'King' | 'Queen' | 'Warden' | 'Royal Champion' | 'Minion Prince' | 'Other' => {
  const lower = (cleanEquipmentName(name) || name).toLowerCase();
  if (
    lower.includes('king') ||
    lower.includes('barbarian') ||
    lower.includes('gauntlet') ||
    lower.includes('earthquake') ||
    lower.includes('rage vial') ||
    lower.includes('snake') ||
    lower.includes('vamp')
  ) return 'King';

  if (
    lower.includes('queen') ||
    lower.includes('archer') ||
    lower.includes('arrow') ||
    lower.includes('healer') ||
    lower.includes('mirror') ||
    lower.includes('invisibility')
  ) return 'Queen';

  if (
    lower.includes('warden') ||
    lower.includes('tome') ||
    lower.includes('gem') ||
    lower.includes('life') ||
    lower.includes('lava') ||
    lower.includes('heroic torch') ||
    lower.includes('torch') ||
    lower.includes('fireball')
  ) return 'Warden';

  if (
    lower.includes('champion') ||
    lower.includes('royal') ||
    lower.includes('shield') ||
    lower.includes('spear') ||
    lower.includes('rocket') ||
    lower.includes('hog') ||
    lower.includes('electro') ||
    lower.includes('boot') ||
    lower.includes('haste')
  ) return 'Royal Champion';

  if (
    lower.includes('minion') ||
    lower.includes('henchman') ||
    lower.includes('mp') ||
    lower.includes('iron') ||
    lower.includes('metal') ||
    lower.includes('meteor') ||
    lower.includes('noble') ||
    lower.includes('powerpump') ||
    lower.includes('pump') ||
    lower.includes('dark orb') ||
    lower.includes('darkorb') ||
    lower.includes('dark crown')
  ) return 'Minion Prince';

  return 'Other';
};

const bucketFromHeroName = (hero: string | undefined): 'King' | 'Queen' | 'Warden' | 'Royal Champion' | 'Minion Prince' | 'Other' => {
  if (!hero) return 'Other';
  const lower = hero.toLowerCase();
  if (lower.includes('king')) return 'King';
  if (lower.includes('queen')) return 'Queen';
  if (lower.includes('warden')) return 'Warden';
  if (lower.includes('champion')) return 'Royal Champion';
  if (lower.includes('minion')) return 'Minion Prince';
  return 'Other';
};

const toNumber = (value: any): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const Sparkline = ({ points, width = 92, height = 32, stroke = '#34d399' }: { points?: number[]; width?: number; height?: number; stroke?: string }) => {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="text-current">
      <path d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={height - ((points[points.length - 1] - min) / range) * height} r={3} fill={stroke} />
    </svg>
  );
};

const skeletonRow = Array.from({ length: 3 }).map((_, idx) => (
  <div key={idx} className="rounded-2xl border p-4 animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}>
    <div className="h-5 w-2/3 rounded bg-white/5 mb-4" />
    <div className="space-y-2">
      <div className="h-4 w-full rounded bg-white/5" />
      <div className="h-4 w-2/3 rounded bg-white/5" />
    </div>
  </div>
));

export default function PlayerProfileClient({ tag, initialProfile }: { tag: string; initialProfile?: SupabasePlayerProfilePayload | null }) {
  const swrKey = `/api/player/${encodeURIComponent(tag)}/profile`;
  const { data, isLoading, error } = useSWR<SupabasePlayerProfilePayload>(swrKey, playerProfileFetcher, {
    ...playerProfileSWRConfig,
    fallbackData: initialProfile || undefined,
  });

  const { members: rosterMembers, isLoading: rosterLoading } = useRosterData();
  const normalizedTag = normalizeTag(tag) || tag;
  const rosterFallback = useMemo(() => {
    return rosterMembers.find((m) => (normalizeTag(m.tag) || m.tag) === normalizedTag);
  }, [rosterMembers, normalizedTag]);

  const profile = data;
  const summary = (profile as any)?.summary ?? profile ?? {};
  const timeline = (profile as any)?.timeline ?? [];
  const clanHeroAverages = (profile as any)?.clanHeroAverages ?? {};
  const leadership = (profile as any)?.leadership ?? null;
  const equipmentLevels = (summary as any)?.equipmentLevels ?? null;
  const pets = (summary as any)?.pets ?? null;
  const history = (profile as any)?.history ?? null;
  const vip = (profile as any)?.vip?.current ?? null;

  const heroLevels = useMemo(() => {
    const levels: Record<string, number | null | undefined> = {};
    const srcLevels = (summary as any)?.heroLevels ?? (summary as any)?.hero_levels ?? {};
    heroOrder.forEach((key) => {
      levels[key] = srcLevels[key] ?? (summary as any)?.[key] ?? (rosterFallback as any)?.[key] ?? null;
    });
    return levels;
  }, [summary, rosterFallback]);

  const townHall = summary.townHallLevel ?? (summary as any).th ?? resolveTownHall(rosterFallback as any) ?? null;
  const leagueFromProfile = (summary as any)?.rankedLeague?.name ?? summary?.leagueName ?? null;
  const { league: leagueName, tier: leagueTier } = rosterFallback ? resolveLeague(rosterFallback as any) : { league: leagueFromProfile, tier: undefined };
  const role = (summary?.role as any)?.toString().toLowerCase() || (rosterFallback?.role as any)?.toString().toLowerCase() || 'member';
  const displayName = summary?.name || rosterFallback?.name || (rosterLoading ? 'Loading name…' : 'Name unavailable');
  const clanName = (summary as any)?.clanName ?? (summary as any)?.clan?.name ?? (rosterFallback as any)?.clanName ?? (rosterFallback as any)?.meta?.clanName ?? null;
  const clanTag = (summary as any)?.clanTag ?? (summary as any)?.clan?.tag ?? (rosterFallback as any)?.clanTag ?? null;
  const rushPercent = (summary as any)?.rushPercent ?? (rosterFallback as any)?.rushPercent ?? null;
  const activityScore = (summary as any)?.activity?.score ?? (summary as any)?.activityScore ?? (rosterFallback as any)?.activityScore ?? null;
  const tenureDays = (summary as any)?.tenure_days ?? (summary as any)?.tenureDays ?? (rosterFallback as any)?.tenure_days ?? null;
  const snapshotDate = timeline?.length ? timeline[timeline.length - 1]?.snapshotDate ?? null : null;
  const snapshotFreshness = snapshotDate ? new Date(snapshotDate) : null;
  const snapshotText = snapshotFreshness ? `Snapshot ${snapshotFreshness.toISOString().slice(0, 10)}` : null;
  const warPreference = (summary as any)?.war?.preference ?? null;
  const builderBase = (summary as any)?.builderBase ?? {};
  const capitalContrib = (summary as any)?.capitalContributions ?? null;
  const achievements = (summary as any)?.achievements ?? {};
  const expLevel = (summary as any)?.expLevel ?? null;
  const joinStatus = history?.currentStint?.isActive ? 'Active' : history?.currentStint ? 'Inactive' : null;
  const joinStart = history?.currentStint?.startDate ?? null;
  const aliases = history?.aliases ?? [];

  const recentTimeline = useMemo(() => (timeline?.length ? timeline.slice(Math.max(0, timeline.length - 7)) : []), [timeline]);
  const [actionsOpen, setActionsOpen] = useState(false);

  const deltas = useMemo(() => {
    if (!timeline || timeline.length < 2) return null;
    const latest = timeline[timeline.length - 1];
    const prev = timeline[timeline.length - 2];
    return {
      trophies: toNumber(latest.rankedTrophies ?? latest.trophies) - toNumber(prev.rankedTrophies ?? prev.trophies),
      donations: toNumber(latest.donations) - toNumber(prev.donations),
      donationsReceived: toNumber(latest.donationsReceived) - toNumber(prev.donationsReceived),
      warStars: toNumber(latest.warStars) - toNumber(prev.warStars),
    };
  }, [timeline]);

  const trendSeries = useMemo(() => {
    const getSeries = (key: string) => recentTimeline.map((entry: any) => toNumber((entry as any)[key]));
    return {
      trophies: recentTimeline.map((entry: any) => toNumber(entry.rankedTrophies ?? entry.trophies)),
      donations: getSeries('donations'),
      received: getSeries('donationsReceived'),
      warStars: getSeries('warStars'),
    };
  }, [recentTimeline]);

const groupedEquipment = useMemo(() => {
  const heroBuckets: Record<string, { name: string; level: number | null; canonical?: HeroEquipment; displayName: string; maxLevel?: number; owned: boolean }[]> = {
    King: [],
      Queen: [],
      Warden: [],
      'Royal Champion': [],
      'Minion Prince': [],
      Other: [],
    };
    const levelMap: Record<string, number> = {};
    if (equipmentLevels && typeof equipmentLevels === 'object') {
      Object.entries(equipmentLevels).forEach(([rawName, rawLevel]) => {
        const cleaned = cleanEquipmentName(rawName) || rawName;
        levelMap[normalizeEquip(cleaned)] = toNumber(rawLevel);
      });
    }

    // Add canonical equipment for each hero, mark owned if present in payload
    heroEquipmentData.forEach((heroSet) => {
      heroSet.equipment.forEach((eq) => {
        const norm = normalizeEquip(eq.name);
        const level = levelMap[norm] ?? null;
        const item = {
          name: eq.name,
          level,
          canonical: eq,
          displayName: eq.name,
          maxLevel: eq.maxLevel,
          owned: level !== null && Number.isFinite(level),
        };
        const bucket = bucketFromHeroName(heroSet.hero);
        heroBuckets[bucket].push(item);
        delete levelMap[norm]; // consumed
      });
    });

    // Any remaining payload equipment not in canonical list
    Object.entries(levelMap).forEach(([normName, level]) => {
      const cleaned = normName;
      const canonical = getEquipmentByName(cleaned);
      const displayName = canonical?.name || cleaned;
      const maxLevel = canonical?.maxLevel;
      const item = { name: cleaned, level, canonical, displayName, maxLevel, owned: true };
      const heroFromDoc = bucketFromHeroName(getHeroForEquipment(cleaned));
      const bucket = heroFromDoc !== 'Other' ? heroFromDoc : classifyEquipmentHero(cleaned);
      heroBuckets[bucket].push(item);
    });

  return heroBuckets;
}, [equipmentLevels]);

  const trophies = summary?.rankedTrophies ?? summary?.trophies ?? rosterFallback?.rankedTrophies ?? rosterFallback?.trophies ?? 0;
  const donated = summary?.donations?.given ?? rosterFallback?.donations ?? 0;
  const received = summary?.donations?.received ?? rosterFallback?.donationsReceived ?? 0;
  const warStarsValue = summary?.war?.stars ?? (rosterFallback as any)?.warStars ?? 0;
  const attackWins = summary?.war?.attackWins ?? (rosterFallback as any)?.attackWins ?? 0;
  const defenseWins = summary?.war?.defenseWins ?? (rosterFallback as any)?.defenseWins ?? 0;
  const sortedHeroEquipmentList = useMemo(() => {
    const order: Record<string, number> = { bk: 0, aq: 1, gw: 2, rc: 3, mp: 4 };
    return [...heroEquipmentData].sort((a, b) => {
      const ka = order[heroKeyFromName(a.hero) || 'zz'] ?? 99;
      const kb = order[heroKeyFromName(b.hero) || 'zz'] ?? 99;
      return ka - kb;
    });
  }, []);

  if (isLoading && !profile && !rosterFallback) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-white/5 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {skeletonRow}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && !profile && (
        <div className="rounded-2xl border p-4 text-sm text-amber-200" style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}>
          Failed to load player profile from API. Showing roster fallback if available.
        </div>
      )}
      {!profile && !rosterFallback && (
        <div className="rounded-2xl border p-6 text-sm text-slate-200" style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}>
          No player data available.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <RoleIcon role={role as any} size={36} className="shrink-0" />
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>{displayName}</h1>
            <p className="text-slate-300 text-sm">
              {profile?.tag || rosterFallback?.tag || tag}
            </p>
            <p className="text-slate-400 text-xs">
              {clanName ? clanName : 'Unknown clan'} {clanTag ? `· ${clanTag}` : ''} {snapshotText ? `· ${snapshotText}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TownHallIcon level={townHall ?? undefined} size="md" />
            <LeagueIcon league={leagueName ?? undefined} ranked size="sm" badgeText={leagueTier ?? undefined} showBadge />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActionsOpen((v) => !v)}
          title="Leadership actions"
        >
          Leadership
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card title="Overview">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: 'Trophies',
                  tooltip: 'Ranked trophies with 7-day trend',
                  value: trophies,
                  delta: deltas?.trophies,
                  series: trendSeries.trophies,
                },
                {
                  label: 'Donated',
                  tooltip: 'Season donations given',
                  value: donated,
                  delta: deltas?.donations,
                  series: trendSeries.donations,
                },
                {
                  label: 'Received',
                  tooltip: 'Season donations received',
                  value: received,
                  delta: deltas?.donationsReceived,
                  series: trendSeries.received,
                },
                {
                  label: 'Rush',
                  tooltip: 'Rush % (lower is better)',
                  value: rushPercent != null ? `${rushPercent.toFixed(1)}%` : '—',
                  tone: rushTone(rushPercent),
                  series: trendSeries.trophies,
                },
                {
                  label: 'Activity',
                  tooltip: 'Activity score (placeholder until fully wired)',
                  value: activityScore != null ? Math.round(activityScore) : '—',
                  series: trendSeries.warStars,
                },
                {
                  label: 'Snapshot',
                  tooltip: 'Most recent snapshot date',
                  value: snapshotText || 'Awaiting snapshot',
                  series: [],
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border p-3"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
                  title={item.tooltip}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 text-[11px] uppercase tracking-[0.24em]">{item.label}</span>
                    {typeof item.delta === 'number' ? (
                      <span className={`text-xs font-semibold ${item.delta >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {item.delta >= 0 ? '+' : ''}
                        {formatNumber(item.delta)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <div className="text-white font-bold text-xl" style={{ color: item.tone || undefined }}>
                        {typeof item.value === 'number' ? formatNumber(item.value) : item.value}
                      </div>
                      {typeof item.delta === 'number' ? (
                        <span className={`text-xs font-semibold ${item.delta >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {item.delta >= 0 ? '+' : ''}
                          {formatNumber(item.delta)}
                        </span>
                      ) : null}
                    </div>
                    <Sparkline points={item.series} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {sortedHeroEquipmentList.length ? (
            <Card title="Hero Equipment">
              <div className="grid gap-4 md:grid-cols-2">
                {sortedHeroEquipmentList.map((heroSet) => {
                  const bucket = bucketFromHeroName(heroSet.hero);
                  if (!bucket) return null;
                  const items = (groupedEquipment[bucket] || []).slice().sort((a, b) => {
                    const la = a.level ?? -1;
                    const lb = b.level ?? -1;
                    return lb - la;
                  });
                  if (!items.length) return null;
                  const heroKey = heroKeyFromName(heroSet.hero);
                  const heroLevel = heroKey ? heroLevels[heroKey] ?? null : null;
                  const thCaps = HERO_MAX_LEVELS[townHall ?? 0] || {};
                  const heroMax = heroKey ? (thCaps as any)[heroKey] ?? null : null;
                  const heroPct = heroLevel && heroMax ? Math.min(100, Math.round((heroLevel / heroMax) * 100)) : null;

                  const isMinion = bucket === 'Minion Prince';
                  return (
                    <div
                      key={heroSet.hero}
                      className={`rounded-2xl border p-3 ${isMinion ? 'md:col-span-2' : ''}`}
                      style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          {heroKey ? <HeroIcon hero={heroKey} size="sm" /> : null}
                          <div className="text-white font-semibold">
                            {heroSet.hero}{heroLevel ? ` · Lvl ${heroLevel}` : ''}
                          </div>
                        </div>
                        {heroPct !== null ? (
                          <div className="flex items-center gap-2 text-xs text-slate-300 min-w-[120px]">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                              <div className="h-full rounded-full" style={{ width: `${heroPct}%`, background: 'var(--accent-alt)' }} />
                            </div>
                            {heroMax ? <span>Max {heroMax}</span> : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {items.map((item) => {
                          const icon = getEquipmentIcon(item.name);
                          const displayName = item.displayName || item.name;
                          const rarity = item.canonical?.rarity;
                          const maxLevel = item.canonical?.maxLevel;
                          const isEpic = rarity === 'Epic';
                          const isMaxed = item.owned && maxLevel ? toNumber(item.level) >= maxLevel : false;
                          const epicGradient = 'linear-gradient(180deg, #a74ce5 0%, #933fcb 50%, #b04fac 100%)';
                          const fadedEpicGradient = 'linear-gradient(180deg, rgba(167,76,229,0.25) 0%, rgba(147,63,203,0.2) 50%, rgba(176,79,172,0.2) 100%)';
                          const tooltipParts = [
                            item.canonical?.description || displayName,
                            item.owned ? null : 'Not owned yet',
                          ].filter(Boolean);
                          const iconStyle = item.owned
                            ? {}
                            : { filter: 'grayscale(100%) brightness(0.6)', opacity: 0.7 };
                          return (
                            <div
                              key={`${heroSet.hero}-${item.name}`}
                              className="relative rounded-xl border p-2 text-center text-xs"
                              style={{
                                borderColor: isMaxed ? '#f5d06c' : 'var(--border-subtle)',
                                background: 'var(--panel)',
                              }}
                              title={tooltipParts.join(' • ')}
                            >
                              <div className="flex items-center justify-center">
                                <div
                                  className="relative rounded-lg text-[11px] leading-tight text-slate-100 flex items-center justify-center overflow-hidden"
                                  style={{
                                    background: isEpic ? (item.owned ? epicGradient : fadedEpicGradient) : 'var(--panel)',
                                    width: '72px',
                                    height: '60px',
                                  }}
                                >
                                  {icon ? (
                                    <img
                                      src={icon}
                                      alt={displayName}
                                      className="h-full w-full object-contain transition duration-150 hover:grayscale-0 hover:brightness-100"
                                      width={64}
                                      height={64}
                                      style={{ width: '64px', height: '64px', filter: item.owned ? undefined : 'grayscale(100%) brightness(0.7)', ...iconStyle }}
                                    />
                                  ) : (
                                    <span className="px-1 text-center" style={iconStyle}>{displayName}</span>
                                  )}
                                  <span
                                    className="absolute bottom-0 right-0 translate-x-1 translate-y-1 rounded-full border px-2 py-[1px] text-xs font-black text-white shadow-lg"
                                    style={{
                                      background: 'rgba(0,0,0,0.8)',
                                      borderColor: 'rgba(255,255,255,0.12)',
                                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                                    }}
                                  >
                                    {item.owned ? item.level : '—'}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1 text-white font-semibold leading-tight text-center text-[13px]">{displayName}</div>
                              {maxLevel ? (
                                <div className="text-[11px] text-slate-400">{isMaxed ? 'Maxed' : `Max ${maxLevel}`}</div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}

          {heroPetsData.length ? (
            <Card title="Hero Pets">
              <div className="space-y-2">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                  {heroPetsData
                    .slice()
                    .sort((a, b) => (pets?.[b.name] ?? 0) - (pets?.[a.name] ?? 0))
                    .map((pet) => {
                      const level = toNumber((pets as any)?.[pet.name] ?? 0);
                      const owned = level > 0;
                      const max = pet.maxLevel || PET_MAX_LEVEL;
                      const badgeBg = 'rgba(0,0,0,0.85)';
                      const iconBg = owned ? 'var(--panel)' : 'rgba(255,255,255,0.06)';
                      return (
                        <div
                          key={pet.name}
                          className="rounded-xl border p-2 text-center text-xs"
                          style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}
                          title={`${pet.name} • ${pet.description}${owned ? '' : ' • Not owned yet'}`}
                        >
                          <div className="flex justify-center">
                            <div
                              className="relative h-16 w-16 rounded-full flex items-center justify-center text-white font-semibold overflow-hidden"
                              style={{ background: iconBg }}
                            >
                              {getPetIcon(pet.name) ? (
                                <img
                                  src={getPetIcon(pet.name)!}
                                  alt={pet.name}
                                  className="h-full w-full object-contain"
                                  width={64}
                                  height={64}
                                  style={{ width: '64px', height: '64px', filter: owned ? undefined : 'grayscale(100%) brightness(0.7)' }}
                                />
                              ) : (
                                <span className="text-sm">{pet.name.charAt(0)}</span>
                              )}
                              <span
                                className="absolute bottom-0 right-0 translate-x-1 translate-y-1 rounded-full border px-2 py-[1px] text-xs font-black text-white shadow-lg"
                                style={{
                                  background: badgeBg,
                                  borderColor: 'rgba(255,255,255,0.12)',
                                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                                }}
                              >
                                {owned ? level : '—'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 text-white font-semibold leading-tight text-center text-[13px]">{pet.name}</div>
                          <div className="text-[11px] text-slate-400">{owned ? `Lv ${level}` : 'Not owned'}</div>
                        </div>
                      );
                  })}
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card title="War & Activity">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between" title="War stars">
                <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">War Stars</span>
                <span className="text-white font-semibold">{formatNumber(warStarsValue)}</span>
              </div>
              <div className="flex items-center justify-between" title="War attack wins">
                <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Attack Wins</span>
                <span className="text-white font-semibold">{formatNumber(attackWins)}</span>
              </div>
              <div className="flex items-center justify-between" title="War defense wins">
                <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Defense Wins</span>
                <span className="text-white font-semibold">{formatNumber(defenseWins)}</span>
              </div>
              <div className="flex items-center justify-between" title="War preference">
                <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">War Preference</span>
                <span className="text-white font-semibold">{warPreference ?? '—'}</span>
              </div>
            </div>
          </Card>

          <Card title="Progression & Base">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between" title="Town Hall level">
                <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Town Hall</span>
                <span className="text-white font-semibold">{townHall ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between" title="Experience level">
                <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Experience</span>
                <span className="text-white font-semibold">{expLevel ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between" title="Tenure in clan (days)">
                <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Tenure</span>
                <span className="text-white font-semibold">{tenureDays != null ? `${tenureDays}d` : '—'}</span>
              </div>
              <div className="flex items-center justify-between" title="Capital contributions">
                <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Capital Gold</span>
                <span className="text-white font-semibold">{capitalContrib != null ? formatNumber(capitalContrib) : '—'}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {actionsOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setActionsOpen(false)}>
          <div
            className="h-full w-full max-w-md bg-[var(--surface)] border-l"
            style={{ borderColor: 'var(--border-subtle)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="text-white font-semibold">Leadership Actions</div>
              <Button variant="outline" size="sm" onClick={() => setActionsOpen(false)}>
                Close
              </Button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <Button variant="primary" size="sm" className="w-full justify-between" disabled title="Add note (coming soon)">
                Add Note
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-between" disabled title="Flag account (coming soon)">
                Flag Account
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-between" disabled title="Report concern (coming soon)">
                Report concern
              </Button>
              <p className="text-xs text-slate-400">Leadership tools will wire to the new services soon.</p>

              <div className="h-px bg-white/10 my-2" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Aliases</span>
                  <span className="text-white font-semibold">{aliases?.length ?? 0}</span>
                </div>
                {aliases?.length ? (
                  <div className="space-y-1">
                    {aliases.slice(0, 5).map((alias: any) => (
                      <div key={alias.name} className="flex items-center justify-between">
                        <span className="text-white">{alias.name}</span>
                        <span className="text-slate-400 text-xs">{alias.lastSeen || alias.firstSeen || ''}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-300 text-sm">No linked accounts yet.</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Notes</div>
                    <div className="text-white font-semibold">{leadership?.notes?.length ?? 0}</div>
                  </div>
                  <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)' }}>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Flags</div>
                    <div className="text-white font-semibold">{leadership?.warnings?.length ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/10 my-2" />

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Snapshot</span>
                  <span className="text-white font-semibold">{snapshotText || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs uppercase tracking-[0.2em]">Join</span>
                  <span className="text-white font-semibold">
                    {joinStatus ? `${joinStatus}${joinStart ? ` · since ${joinStart}` : ''}` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-sm text-slate-300">
        <Link
          href="/new/roster"
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-semibold"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)', color: 'var(--text)' }}
        >
          ← Back to roster
        </Link>
        <Link
          href={`/player/${encodeURIComponent(tag)}`}
          className="text-slate-400 hover:text-white underline"
          title="View classic profile"
        >
          View classic profile
        </Link>
      </div>
    </div>
  );
}
