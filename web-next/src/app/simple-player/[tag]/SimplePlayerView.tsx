"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { TownHallBadge, LeagueBadge, HeroLevel } from '@/components/ui';
import { calculateRushPercentage, getHeroCaps } from '@/lib/business/calculations';
import type { Member, PlayerActivityTimelineEvent, MemberEnriched, ActivityEvidence } from '@/types';

const DashboardLayout = dynamic(() => import('@/components/layout/DashboardLayout'), { ssr: false });

interface PlayerData {
  name: string;
  tag: string;
  role?: string | null;
  townHallLevel: number;
  trophies: number;
  lastWeekTrophies?: number | null;
  rankedTrophies?: number | null;
  seasonTotalTrophies?: number | null;
  donations?: number;
  donationsReceived?: number;
  rankedLeagueId?: number | null;
  rankedLeagueName?: string | null;
  league?: { name: string | null } | null;
  rankedLeague?: { id: number | null; name: string | null } | null;
  bk?: number | null;
  aq?: number | null;
  gw?: number | null;
  rc?: number | null;
  mp?: number | null;
  clan?: { name: string } | null;
  activityTimeline?: PlayerActivityTimelineEvent[];
  activity?: ActivityEvidence | null;
  enriched?: MemberEnriched | null;
}

const HERO_ICON_MAP = {
  bk: { src: '/assets/heroes/Barbarian_King.png', alt: 'Barbarian King' },
  aq: { src: '/assets/heroes/Archer_Queen.png', alt: 'Archer Queen' },
  gw: { src: '/assets/heroes/Grand_Warden.png', alt: 'Grand Warden' },
  rc: { src: '/assets/heroes/Royal_Champion.png', alt: 'Royal Champion' },
  mp: { src: '/assets/heroes/Minion_Prince.png', alt: 'Minion Prince' },
} as const;

const HERO_LABEL_MAP = {
  bk: 'Barbarian King',
  aq: 'Archer Queen',
  gw: 'Grand Warden',
  rc: 'Royal Champion',
  mp: 'Minion Prince',
} as const;

type TimelineEventType =
  | 'hero-upgrade'
  | 'ranked-final'
  | 'trophy-spike'
  | 'donation-spike'
  | 'activity-highlight'
  | 'baseline'
  | 'future';

const EVENT_PRIORITY: TimelineEventType[] = [
  'hero-upgrade',
  'ranked-final',
  'trophy-spike',
  'donation-spike',
  'activity-highlight',
  'baseline',
  'future',
];

const TIMELINE_SLOTS = 30;

const EVENT_STYLE_MAP: Record<TimelineEventType, { background: string; accent: string; label: string }> = {
  'hero-upgrade': {
    background: '#7c3aed',
    accent: 'bg-fuchsia-400',
    label: 'Hero upgrade',
  },
  'ranked-final': {
    background: '#f59e0b',
    accent: 'bg-amber-400',
    label: 'Ranked finals',
  },
  'trophy-spike': {
    background: '#3b82f6',
    accent: 'bg-sky-400',
    label: 'Trophy swing',
  },
  'donation-spike': {
    background: '#22c55e',
    accent: 'bg-emerald-400',
    label: 'Donation burst',
  },
  'activity-highlight': {
    background: '#6366f1',
    accent: 'bg-indigo-400',
    label: 'Activity spike',
  },
  baseline: {
    background: '#1f2937',
    accent: 'bg-slate-500',
    label: 'Baseline snapshot',
  },
  future: {
    background: '#0f172a',
    accent: 'bg-slate-600',
    label: 'Upcoming snapshot',
  },
};

const EMPTY_ACTIVITY: ActivityEvidence = {
  last_active_at: new Date(0).toISOString(),
  confidence: 'weak',
  indicators: [],
  score: 0,
  level: 'Inactive',
};

interface SimplePlayerViewProps {
  tag: string;
}

export default function SimplePlayerView({ tag }: SimplePlayerViewProps) {
  const router = useRouter();
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tag) return;

    async function loadProfile() {
      try {
        setLoading(true);
        const response = await fetch(`/api/v2/player/${tag}`);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to load player: ${response.status} - ${errorText.substring(0, 120)}`);
        }

        const apiData = await response.json();
        if (apiData.success && apiData.data) {
          setPlayer(apiData.data);
        } else {
          throw new Error('Invalid API response');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load player profile');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [tag]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="mb-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
            ← Back
          </button>
          <h1 className="text-3xl font-bold">Loading player…</h1>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="mb-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
            ← Back
          </button>
          <h1 className="text-3xl font-bold mb-4 text-red-400">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => router.back()} className="mb-4 px-4 py-2 bg-gray-700 rounded hover:bg-gray-600">
            ← Back
          </button>
          <h1 className="text-3xl font-bold">No player data</h1>
        </div>
      </div>
    );
  }

  const memberLike: Member = {
    tag: player.tag,
    name: player.name,
    role: (player.role ?? 'member') as Member['role'],
    townHallLevel: player.townHallLevel,
    trophies: player.trophies ?? 0,
    rankedLeagueId: player.rankedLeagueId ?? undefined,
    rankedLeagueName: player.rankedLeagueName ?? undefined,
    rankedTrophies: player.rankedTrophies ?? undefined,
    seasonTotalTrophies: player.seasonTotalTrophies ?? undefined,
    donations: player.donations ?? undefined,
    donationsReceived: player.donationsReceived ?? undefined,
    bk: player.bk ?? undefined,
    aq: player.aq ?? undefined,
    gw: player.gw ?? undefined,
   rc: player.rc ?? undefined,
   mp: player.mp ?? undefined,
   enriched: player.enriched ?? null,
    activity: player.activity ?? null,
  } as Member;

  const rushPercent = calculateRushPercentage(memberLike);
  const heroCaps = getHeroCaps(player.townHallLevel);
  const activityTimeline = (player.activityTimeline ?? []).map((event) => ({
    ...event,
    heroUpgrades: event.heroUpgrades ?? [],
    trophyDelta: event.trophyDelta ?? 0,
    rankedTrophyDelta: event.rankedTrophyDelta ?? 0,
    donationsDelta: event.donationsDelta ?? 0,
    donationsReceivedDelta: event.donationsReceivedDelta ?? 0,
  }));
  const activity = player.activity ?? EMPTY_ACTIVITY;
  const activityDetails = activity.indicators.length
    ? activity.indicators.map((indicator: string) => `• ${indicator}`).join('\n')
    : 'No recent activity indicators yet.';

  const rankedLeagueId = player.rankedLeagueId ?? player.rankedLeague?.id ?? null;
  const rankedLeagueName = player.rankedLeagueName ?? player.rankedLeague?.name ?? null;
  const isCompetitive = rankedLeagueId !== null && rankedLeagueId !== 105000000;
  const leagueBadgeName = rankedLeagueName || player.league?.name || 'Unranked';
  const leagueTooltip = isCompetitive
    ? `${leagueBadgeName}\n${(player.rankedTrophies ?? player.trophies ?? 0).toLocaleString()} trophies\nActively competing in ranked battles.`
    : 'Player is not currently earning ranked trophies.';

  const donations = player.donations ?? 0;
  const donationsReceived = player.donationsReceived ?? 0;
  const donationBalance = donations - donationsReceived;

  const activityChip =
    activity.level === 'Very Active'
      ? 'bg-green-200 text-green-900 border-green-300'
      : activity.level === 'Active'
      ? 'bg-blue-200 text-blue-900 border-blue-300'
      : activity.level === 'Moderate'
      ? 'bg-yellow-200 text-yellow-900 border-yellow-300'
      : activity.level === 'Low'
      ? 'bg-orange-200 text-orange-900 border-orange-300'
      : 'bg-red-200 text-red-900 border-red-300';

  return (
    <DashboardLayout clanName={player.clan?.name || undefined}>
      <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-8 space-y-8">
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-gray-700/70 bg-gray-900/70 px-4 py-2 text-sm text-blue-100 transition-colors hover:bg-gray-800"
        >
          <span>←</span> Back to Roster
        </button>

        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 backdrop-blur-sm rounded-2xl p-8 border border-blue-500/20 shadow-2xl">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-8">
            <div className="flex items-center gap-5">
              <div className="flex items-center">
                <TownHallBadge
                  level={player.townHallLevel}
                  size="lg"
                  showBox={false}
                  showLevel
                  className="drop-shadow-2xl"
                  levelBadgeClassName="rounded-full border-0 bg-slate-950/95 px-2 text-lg font-bold text-white shadow-[0_3px_8px_rgba(0,0,0,0.55)]"
                />
              </div>
              <div>
                <h1
                  className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2"
                  style={{ fontFamily: "'Clash Display', sans-serif", WebkitTextStroke: '1.8px rgba(0,0,0,0.45)' }}
                >
                  {player.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-blue-200 font-mono">
                  <span>{player.tag}</span>
                  <span className="text-blue-400">•</span>
                  <span className="capitalize">{player.role ?? 'Member'}</span>
                </div>
                {player.clan?.name && (
                  <p className="text-blue-100/80 flex items-center gap-2 mt-2 text-sm">
                    <span className="text-lg">🏰</span>
                    {player.clan.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div title={leagueTooltip} className="cursor-help">
                <LeagueBadge league={leagueBadgeName ?? undefined} trophies={player.trophies} size="md" />
              </div>
              <div className="text-sm text-blue-200 uppercase tracking-wider">
                {isCompetitive ? 'Competitive Ranked Player' : 'Legacy / Unranked'}
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-900/60 border border-gray-700/60 rounded-xl p-5 shadow-inner">
              <p className="text-xs text-blue-200/70 uppercase tracking-wider mb-1">Current Week</p>
              <p className="text-3xl font-mono font-bold text-clash-gold">{(player.trophies ?? 0).toLocaleString()}</p>
              <p className="text-xs text-blue-100/60 mt-2">
                Weekly trophies reset every Tuesday at 5:00 AM UTC. We capture the final Monday snapshot at 4:30 AM UTC for leaderboard history.
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-700/60 rounded-xl p-5 shadow-inner">
              <p className="text-xs text-blue-200/70 uppercase tracking-wider mb-1">Last Week Finals</p>
              <p className="text-3xl font-mono font-bold text-brand-accent">
                {player.lastWeekTrophies !== null && player.lastWeekTrophies !== undefined
                  ? player.lastWeekTrophies.toLocaleString()
                  : '—'}
              </p>
              <p className="text-xs text-blue-100/60 mt-2">Monday snapshot (4:30 AM UTC) before Tuesday reset.</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-700/60 rounded-xl p-5 shadow-inner">
              <p className="text-xs text-blue-200/70 uppercase tracking-wider mb-1">Running Total</p>
              <p className="text-3xl font-mono font-bold text-clash-gold">
                {player.seasonTotalTrophies !== null && player.seasonTotalTrophies !== undefined
                  ? player.seasonTotalTrophies.toLocaleString()
                  : '—'}
              </p>
              <p className="text-xs text-blue-100/60 mt-2">Cumulative Monday finals since the ranked season reset.</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-700/60 rounded-xl p-5 shadow-inner">
              <p className="text-xs text-blue-200/70 uppercase tracking-wider mb-1">Ranked League</p>
              <div className="flex items-center gap-3">
                <LeagueBadge league={leagueBadgeName ?? undefined} trophies={player.rankedTrophies ?? undefined} size="sm" showText={false} />
                <div>
                  <p className="text-lg font-semibold text-white">{leagueBadgeName || 'Unranked'}</p>
                  <p className="text-sm text-blue-100/70">
                    {player.rankedTrophies !== null && player.rankedTrophies !== undefined
                      ? `${player.rankedTrophies.toLocaleString()} trophies`
                      : 'No ranked trophies yet'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {activityTimeline.length > 0 && <ActivityHistoryTimeline timeline={activityTimeline} />}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-5 space-y-3">
            <p className="text-xs text-brand-text-muted uppercase tracking-wider">Activity</p>
            <div
              title={activityDetails}
              className={`inline-flex items-center justify-center px-3 py-1 text-sm font-semibold border rounded-full ${activityChip}`}
            >
              {activity.level}
            </div>
            <p className="text-sm text-brand-text-tertiary leading-relaxed whitespace-pre-line">{activityDetails}</p>
          </div>

          <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-5 space-y-2">
            <p className="text-xs text-brand-text-muted uppercase tracking-wider">Donations</p>
            <div className="flex items-baseline gap-4">
              <div className="flex-1">
                <p className="text-sm text-brand-text-tertiary">Donated</p>
                <p className="text-2xl font-mono font-bold text-green-500">{donations.toLocaleString()}</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-brand-text-tertiary">Received</p>
                <p className="text-2xl font-mono font-bold text-blue-400">{donationsReceived.toLocaleString()}</p>
              </div>
            </div>
            <p
              className={`mt-4 text-sm font-mono ${
                donationBalance > 0
                  ? 'text-green-500'
                  : donationBalance < 0
                  ? 'text-red-500'
                  : 'text-brand-text-secondary'
              }`}
            >
              Balance: {donationBalance > 0 ? '+' : ''}{donationBalance.toLocaleString()}
            </p>
          </div>

          <div className="bg-brand-surface border border-brand-border/60 rounded-xl p-5">
            <p className="text-xs text-brand-text-muted uppercase tracking-wider">Rush Status</p>
            <p className={`mt-2 text-3xl font-mono font-bold ${rushPercent >= 70 ? 'text-red-500' : rushPercent >= 40 ? 'text-yellow-400' : 'text-green-400'}`}>
              {rushPercent}%
            </p>
            <p className="text-sm text-brand-text-tertiary mt-2">Lower is better — compares hero levels to Town Hall {player.townHallLevel} caps.</p>
          </div>
        </div>

        <div className="bg-brand-surface border border-brand-border/60 rounded-2xl p-6 xl:p-8 shadow-inner">
          <h2 className="text-xl font-semibold text-brand-text-primary mb-5">Hero Levels</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {['bk', 'aq', 'gw', 'rc', 'mp'].map((key) => {
              const heroKey = key as keyof typeof HERO_ICON_MAP;
              const icon = HERO_ICON_MAP[heroKey];
              const label = HERO_LABEL_MAP[heroKey];
              const level = player[heroKey] ?? null;
              const maxLevel = (heroCaps as Record<string, number | undefined>)[heroKey] ?? 0;
              return (
                <div key={heroKey} className="flex items-center gap-4 rounded-2xl border border-gray-700/60 bg-gray-900/70 p-4">
                  {icon ? (
                    <Image
                      src={icon.src}
                      alt={icon.alt}
                      width={56}
                      height={56}
                      className="h-14 w-14 object-contain drop-shadow-[0_6px_16px_rgba(8,15,31,0.45)]"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-slate-800/80" aria-hidden="true" />
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between text-sm text-blue-100/80">
                      <span className="font-semibold text-white">{label}</span>
                      <span className="font-mono text-xs text-blue-200/80">{level !== null ? `${level}/${maxLevel}` : '—'}</span>
                    </div>
                    <HeroLevel
                      hero={heroKey.toUpperCase() as any}
                      level={level ?? 0}
                      maxLevel={maxLevel ?? 0}
                      showName={false}
                      size="md"
                      className="pt-1"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

interface TimelineEventWithStyle extends PlayerActivityTimelineEvent {
  index: number;
  eventTypes: TimelineEventType[];
  style: { background: string; accent: string; label: string };
  tickLabel: string;
}

function resolveTimelineStyle(eventTypes: TimelineEventType[]) {
  const resolvedType = EVENT_PRIORITY.find((type) => eventTypes.includes(type)) ?? 'baseline';
  return EVENT_STYLE_MAP[resolvedType];
}



function ActivityHistoryTimeline({ timeline }: { timeline: PlayerActivityTimelineEvent[] }) {
  const events = useMemo<TimelineEventWithStyle[]>(() => {
    return timeline.map((event, index) => {
      const types: TimelineEventType[] = [];
      if (event.heroUpgrades && event.heroUpgrades.length) {
        types.push('hero-upgrade');
      }
      const date = event.date ? new Date(event.date) : null;
      const isValidDate = date && !Number.isNaN(date.valueOf());
      if (isValidDate && date!.getUTCDay() === 1) {
        types.push('ranked-final');
      }
      if (Math.abs(event.rankedTrophyDelta) >= 50) {
        types.push('ranked-final');
      }
      if (Math.abs(event.trophyDelta) >= 100) {
        types.push('trophy-spike');
      }
      if (event.donationsDelta >= 100 || event.donationsReceivedDelta >= 100) {
        types.push('donation-spike');
      }
      if (event.activityScore !== null && event.activityScore >= 45) {
        types.push('activity-highlight');
      }
      if (!types.length) {
        types.push('baseline');
      }
      const style = resolveTimelineStyle(types);
      const tickLabel = isValidDate
        ? date!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'Snapshot';
      return {
        ...event,
        index,
        eventTypes: types,
        style,
        tickLabel,
      };
    });
  }, [timeline]);

  const trimmedEvents = useMemo(() => {
    if (events.length <= TIMELINE_SLOTS) return events;
    return events.slice(events.length - TIMELINE_SLOTS);
  }, [events]);

  const slots = useMemo(() => {
    const slotCount = TIMELINE_SLOTS;
    const result: Array<{ type: TimelineEventType; event: TimelineEventWithStyle | null }> = new Array(slotCount)
      .fill(null)
      .map(() => ({ type: 'future', event: null }));
    trimmedEvents.forEach((event, idx) => {
      if (idx < slotCount) {
        const slotType = EVENT_PRIORITY.find((type) => event.eventTypes.includes(type)) ?? 'baseline';
        result[idx] = { type: slotType, event };
      }
    });
    return result;
  }, [trimmedEvents]);

  const [hoverSlot, setHoverSlot] = useState(() => {
    const lastEventIndex = slots.reduce((acc, slot, idx) => (slot.event ? idx : acc), 0);
    return lastEventIndex;
  });
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const lastEventIndex = slots.reduce((acc, slot, idx) => (slot.event ? idx : acc), 0);
    setHoverSlot(lastEventIndex);
  }, [slots]);

  const maxSlotIndex = slots.length > 0 ? slots.length - 1 : 0;
  const activeSlotIndex = Math.min(Math.max(hoverSlot, 0), maxSlotIndex);
  const activeSlot = slots[activeSlotIndex];
  const selectedEvent = activeSlot?.event ?? null;
  const pointerLeft = useMemo(() => {
    if (slots.length === 0) return 0;
    const raw = ((activeSlotIndex + 0.5) / slots.length) * 100;
    return Math.min(Math.max(raw, 0), 100);
  }, [activeSlotIndex, slots.length]);

  const formattedDate = useMemo(() => {
    if (!selectedEvent) {
      return 'Upcoming snapshot';
    }
    const raw = selectedEvent.date ? new Date(selectedEvent.date) : null;
    if (!raw || Number.isNaN(raw.valueOf())) {
      return 'Snapshot';
    }
    return raw.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }, [selectedEvent]);

  const handlePointer = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const relative = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const ratio = rect.width === 0 ? 0 : relative / rect.width;
    const slotIndex = Math.min(Math.max(Math.round(ratio * maxSlotIndex), 0), maxSlotIndex);
    setHoverSlot(slotIndex);
  }, [maxSlotIndex]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    handlePointer(event.clientX);
  }, [handlePointer]);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches && event.touches[0]) {
      handlePointer(event.touches[0].clientX);
    }
  }, [handlePointer]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setHoverSlot((prev) => Math.max(0, prev - 1));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setHoverSlot((prev) => Math.min(maxSlotIndex, prev + 1));
    }
  };

  const activeTypes = selectedEvent?.eventTypes ?? ['future'];

  const renderDelta = (value: number, label?: string) => {
    if (!value) return null;
    const positive = value > 0;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          positive ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'
        }`}
      >
        {positive ? '▲' : '▼'} {Math.abs(value)}{label ? ` ${label}` : ''}
      </span>
    );
  };

  return (
    <div className="bg-gray-900/60 border border-gray-700/60 rounded-2xl p-6 shadow-inner">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-blue-200/70">Activity Timeline</p>
          <p className="text-sm text-blue-100/70">
            Season scrubber highlighting hero upgrades, ranked finals, trophy swings, and donation bursts.
          </p>
        </div>
        <span className="text-xs font-mono text-blue-100/70">{slots.length} snapshots</span>
      </div>

      <div
        ref={trackRef}
        className="relative mt-6"
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={maxSlotIndex}
        aria-valuenow={activeSlotIndex}
        aria-label="Activity history timeline"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onKeyDown={handleKeyDown}
      >
        <div className="h-12 rounded-full border border-slate-800/70 bg-slate-900/80 px-2">
          <div className="flex h-full w-full items-stretch gap-1">
            {slots.map((slot, idx) => (
              <div
                key={`timeline-slot-${idx}`}
                className={`flex-1 rounded-lg transition-opacity duration-150 ${idx === activeSlotIndex ? 'opacity-100' : 'opacity-70'}`}
                style={{ background: EVENT_STYLE_MAP[slot.type].background }}
                onMouseEnter={() => setHoverSlot(idx)}
                onFocus={() => setHoverSlot(idx)}
                role="presentation"
              />
            ))}
          </div>
        </div>

        <div
          className="pointer-events-none absolute top-0 bottom-0 flex items-start"
          style={{
            left: `${pointerLeft}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="relative flex h-full flex-col items-center justify-end">
            <div className="absolute bottom-full mb-3 w-[min(260px,80vw)] rounded-xl border border-white/10 bg-slate-950/95 px-3 py-2 text-[11px] text-blue-100/80 shadow-xl shadow-slate-950/60 backdrop-blur">
              <p className="text-xs font-semibold text-white">{formattedDate}</p>
              {selectedEvent ? (
                <div className="mt-2 space-y-3">
                  {selectedEvent.heroUpgrades.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedEvent.heroUpgrades.map((upgrade, idx) => {
                        const label = HERO_LABEL_MAP[upgrade.hero];
                        return (
                          <span
                            key={`${upgrade.hero}-${idx}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-500/15 px-2 py-1 text-[10px] font-semibold text-purple-100"
                          >
                            {label}
                            <span className="font-mono text-[10px] text-purple-200">
                              {upgrade.from !== null ? `${upgrade.from}→${upgrade.to}` : `Lv ${upgrade.to}`}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="space-y-1 text-[10px] uppercase tracking-[0.16em]">
                    <div className="flex items-center gap-2 text-white">
                      <span className="font-mono text-xs">{selectedEvent.trophies.toLocaleString()}</span>
                      <span className="text-blue-200/70">Ranked trophies</span>
                      {renderDelta(selectedEvent.trophyDelta, 'ranked trophies')}
                    </div>
                    <div className="flex items-center gap-2 text-emerald-100">
                      <span className="font-mono text-xs text-white">{selectedEvent.donations.toLocaleString()}</span>
                      <span className="text-blue-200/70">Donated</span>
                      {renderDelta(selectedEvent.donationsDelta)}
                    </div>
                    <div className="flex items-center gap-2 text-blue-100">
                      <span className="font-mono text-xs text-white">{selectedEvent.donationsReceived.toLocaleString()}</span>
                      <span className="text-blue-200/70">Received</span>
                      {renderDelta(selectedEvent.donationsReceivedDelta)}
                    </div>
                    {selectedEvent.activityScore !== null && (
                      <div className="flex items-center gap-2 text-blue-100">
                        <span className="text-blue-200/70">Activity</span>
                        <span className="font-mono text-xs text-white">{selectedEvent.activityScore}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-1 leading-relaxed text-blue-200/70">
                  Upcoming snapshot — hover to explore recent activity.
                </p>
              )}
            </div>
            <div className={`h-16 w-0.5 sm:h-20 ${EVENT_STYLE_MAP[activeTypes[0]].accent}`} />
            <div className={`mt-1 h-2 w-2 rotate-45 ${EVENT_STYLE_MAP[activeTypes[0]].accent}`} />
          </div>
        </div>
      </div>

    </div>
  );
}
