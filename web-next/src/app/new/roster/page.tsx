"use client";

import { useMemo, useState } from 'react';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import { Input } from '@/components/new-ui/Input';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import LeagueIcon from '@/components/new-ui/icons/LeagueIcon';
import RoleIcon from '@/components/new-ui/icons/RoleIcon';
import CopyableName from '@/components/new-ui/CopyableName';
import { heroIconMap } from '@/components/new-ui/icons/maps';
import { useRosterData } from './useRosterData';
import Image from 'next/image';
import { HERO_MAX_LEVELS } from '@/types';
import type { RosterMember } from '@/app/(dashboard)/simple-roster/roster-transform';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import {
  formatRush,
  normalizeRole,
  resolveActivity,
  resolveLeague,
  resolveRushPercent,
  resolveTownHall,
  resolveTrophies,
  rushTone,
} from './roster-utils';

const heroMeta: Record<string, { name: string; gradient: string }> = {
  bk: { name: 'Barbarian King', gradient: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)' },
  aq: { name: 'Archer Queen', gradient: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)' },
  gw: { name: 'Grand Warden', gradient: 'linear-gradient(90deg, #a855f7 0%, #9333ea 100%)' },
  rc: { name: 'Royal Champion', gradient: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)' },
  mp: { name: 'Minion Prince', gradient: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)' },
};

const LoadingCard = () => (
  <div
    className="rounded-2xl border p-4 animate-pulse"
    style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}
  >
    <div className="mb-4 h-5 w-3/4 rounded bg-white/5" />
    <div className="space-y-3">
      <div className="h-4 w-full rounded bg-white/5" />
      <div className="h-4 w-2/3 rounded bg-white/5" />
      <div className="h-4 w-1/2 rounded bg-white/5" />
    </div>
  </div>
);

export default function NewRosterPage() {
  const { data, members, isLoading, error, isValidating, mutate } = useRosterData();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'current' | 'former'>('all');

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = members;
    if (status === 'former') {
      // Placeholder: current API only returns active roster; former list will be populated once available
      list = [];
    }
    if (!query) return list;
    return list.filter((member) => {
      const name = member.name?.toLowerCase() || '';
      const tag = (member.tag || '').toLowerCase();
      return name.includes(query) || tag.includes(query);
    });
  }, [members, search, status]);

  const lastUpdated =
    data?.snapshotMetadata?.fetchedAt ??
    data?.snapshotMetadata?.snapshotDate ??
    data?.lastUpdated ??
    data?.date ??
    null;
  const parsedLastUpdated = lastUpdated ? new Date(lastUpdated) : null;
  const safeLastUpdated = parsedLastUpdated && !Number.isNaN(parsedLastUpdated.getTime()) ? parsedLastUpdated : null;

  const renderMemberCard = (member: RosterMember) => {
    const role = normalizeRole(member.role);
    const townHall = resolveTownHall(member);
    const { league, tier } = resolveLeague(member);
    const trophies = resolveTrophies(member);
    const rushValue = resolveRushPercent(member);
    const rushColor = rushTone(rushValue);
    const activity = resolveActivity(member);

    return (
      <Card
        key={member.tag}
        title={
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RoleIcon role={role} size={28} />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <CopyableName
                    name={member.name || member.tag}
                    tag={member.tag}
                    className="text-white text-lg font-bold tracking-[0.03em]"
                  />
                  <span
                    className="inline-flex h-2.5 w-2.5 rounded-full"
                    style={{ background: activity.tone, transform: 'translateY(-1px)' }}
                    aria-label={`Activity ${activity.band}`}
                    title={activity.evidence?.level || activity.band}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TownHallIcon level={townHall ?? undefined} size="md" />
            </div>
          </div>
        }
        footer={null}
      >
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-6 text-xs items-start">
            <div className="flex flex-col gap-3">
              <div>
                <div className="uppercase tracking-[0.2em] text-[10px] text-slate-400 font-medium">Trophies</div>
                <div className="text-lg font-bold text-white">{trophies.toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-2">
                <LeagueIcon league={league} ranked size="sm" badgeText={tier} showBadge />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <div className="uppercase tracking-[0.2em] text-[10px] text-slate-400 font-medium">Donated</div>
                <div className="text-lg font-bold text-white">{(member.donations ?? 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="uppercase tracking-[0.2em] text-[10px] text-slate-400 font-medium">Received</div>
                <div className="text-lg font-bold text-white">{(member.donationsReceived ?? 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <div className="uppercase tracking-[0.2em] text-[10px] text-slate-400 font-medium">SRS</div>
                <div className="text-lg font-bold text-white leading-tight">
                  {Math.round(activity.score)}
                </div>
              </div>
              <div>
                <div className="uppercase tracking-[0.2em] text-[10px] text-slate-400 font-medium">Rush</div>
                <div className="text-lg font-bold" style={{ color: rushColor }}>
                  {formatRush(rushValue)}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {['bk', 'aq', 'gw', 'rc', 'mp'].map((heroKey) => {
                const caps = HERO_MAX_LEVELS[townHall ?? 0] || {};
                const level = (member as any)[heroKey] || 0;
                const max = (caps as any)[heroKey] || 0;
                if (!level && !max) return null;
                const percent = max > 0 ? Math.min((level / max) * 100, 100) : 0;
                const meta = heroMeta[heroKey] || { name: heroKey.toUpperCase(), gradient: 'linear-gradient(90deg,#38bdf8,#0ea5e9)' };
                const iconSrc = (heroIconMap as any)[heroKey] || '';
                return (
                  <div
                    key={`${member.tag}-${heroKey}`}
                    className="flex items-center gap-2 tooltip-trigger"
                    data-tooltip={`${meta.name} level ${level}${max ? ` of ${max}` : ''}`}
                  >
                    {iconSrc ? (
                      <div className="relative">
                        <Image src={iconSrc} alt={meta.name} width={32} height={32} className="object-contain" />
                        {max ? (
                          <span
                            className="absolute -bottom-1 -right-1 rounded-full bg-black/80 px-1 text-[10px] font-semibold text-white"
                            style={{ lineHeight: '14px' }}
                          >
                            {level}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">{max ? `${Math.round((level / max) * 100)}%` : '—'}</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${percent}%`, background: meta.gradient }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Roster</h1>
          <p className="text-slate-300 text-sm">
            {data?.clanName ? `${data.clanName} · ${data.clanTag}` : 'New layout using the refreshed tokens.'}
            {safeLastUpdated ? (
              <span className="text-slate-400 ml-2">
                · Updated {formatDistanceToNow(safeLastUpdated, { addSuffix: true })}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Button tone="primary" onClick={() => mutate()} disabled={isValidating}>
            {isValidating ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button tone="accentAlt">Generate Insights</Button>
          <Button tone="ghost">Export</Button>
          <Link
            href="/new/roster/table"
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)', color: 'var(--text)' }}
          >
            Table view
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border" style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}>
        <div className="border-b border-white/5 px-4 py-2 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search players, tags"
            className="max-w-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2 text-xs">
            {(['all', 'current', 'former'] as const).map((key) => (
              <Button
                key={key}
                tone={status === key ? 'accentAlt' : 'ghost'}
                className="h-10 px-4"
                onClick={() => setStatus(key)}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="p-6 text-sm text-red-300">
            Failed to load roster. {error.message || 'Please try again.'}
          </div>
        ) : null}

        {isLoading ? (
          <div className="grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => <LoadingCard key={idx} />)}
          </div>
        ) : null}

        {!isLoading && !error ? (
          filteredMembers.length ? (
            <div className="grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredMembers.map(renderMemberCard)}
            </div>
          ) : (
            <div className="p-6 text-sm text-slate-300">
              {status === 'former'
                ? 'Former members will appear here once departure data is wired.'
                : 'No roster members match that filter.'}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
