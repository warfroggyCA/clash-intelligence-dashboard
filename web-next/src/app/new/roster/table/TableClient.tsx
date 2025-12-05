"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/new-ui/Button';
import { Input } from '@/components/new-ui/Input';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import LeagueIcon from '@/components/new-ui/icons/LeagueIcon';
import RoleIcon from '@/components/new-ui/icons/RoleIcon';
import CopyableName from '@/components/new-ui/CopyableName';
import { HERO_MAX_LEVELS } from '@/types';
import { heroIconMap } from '@/components/new-ui/icons/maps';
import { useRosterData } from '../useRosterData';
import {
  formatRush,
  normalizeRole,
  resolveActivity,
  resolveLeague,
  resolveRushPercent,
  resolveTownHall,
  resolveTrophies,
  rushTone,
} from '../roster-utils';
import RosterClient from '../RosterClient';
import type { RosterData } from '@/app/(dashboard)/simple-roster/roster-transform';
import { RosterSkeleton } from '@/components/ui/RosterSkeleton';
import { normalizeTag } from '@/lib/tags';
import Link from 'next/link';

export default function TableClient({ initialRoster }: { initialRoster?: RosterData | null }) {
  const { members, isLoading, error, isValidating, mutate } = useRosterData(initialRoster || undefined);
  const [search, setSearch] = useState('');
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const update = () => setIsNarrow(typeof window !== 'undefined' ? window.innerWidth < 1280 : false);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const name = member.name?.toLowerCase() || '';
      const tag = (member.tag || '').toLowerCase();
      return name.includes(query) || tag.includes(query);
    });
  }, [members, search]);

  if (isNarrow) {
    // On narrow viewports, just reuse the card layout to avoid cramped columns and duplicate headers.
    return <RosterClient initialRoster={initialRoster} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Roster Table</h1>
          <p className="text-slate-300 text-sm">Same tokens and icons, compact in rows.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Button tone="primary" onClick={() => mutate()} disabled={isValidating}>
            {isValidating ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Link
            href="/new/roster"
            className="inline-flex items-center justify-center rounded-xl border px-4 py-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--panel)', color: 'var(--text)' }}
          >
            Card view
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
        </div>

        {error ? (
          <div className="p-6 text-sm text-red-300">
            Failed to load roster. {error.message || 'Please try again.'}
          </div>
        ) : null}

        {isLoading && (!members.length) ? (
          <RosterSkeleton />
        ) : null}

        <div className="hidden md:block">
          {!isLoading && !error ? (
            filteredMembers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-sm text-slate-200">
                  <colgroup>
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '5%' }} />
                  </colgroup>
                  <thead className="text-xs uppercase tracking-[0.15em] text-slate-400">
                    <tr className="border-b border-white/5">
                      <th className="px-2 py-3 text-left">Player</th>
                      <th className="px-2 py-3 text-center">TH</th>
                      <th className="px-2 py-3 text-center">League</th>
                      <th className="px-2 py-3 text-right">Trophies</th>
                      <th className="px-2 py-3 text-right">Donated</th>
                      <th className="px-2 py-3 text-right">Received</th>
                      <th className="px-2 py-3 text-right">Rush</th>
                      <th className="px-2 py-3 text-right">SRS</th>
                      {(['bk', 'aq', 'gw', 'rc', 'mp'] as const).map((heroKey) => (
                        <th key={`hero-head-${heroKey}`} className="px-2 py-3 text-center" title="Hero levels (current; dash if unavailable)">
                          <img
                            src={heroIconMap[heroKey]}
                            alt={heroKey.toUpperCase()}
                            className="mx-auto h-6 w-6"
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => {
                      const role = normalizeRole(member.role);
                      const townHall = resolveTownHall(member);
                      const { league, tier } = resolveLeague(member);
                      const trophies = resolveTrophies(member);
                      const rushValue = resolveRushPercent(member);
                      const activity = resolveActivity(member);
                      const heroCaps = HERO_MAX_LEVELS[townHall ?? 0] || {};

                      return (
                        <tr key={member.tag} className="border-b border-white/5 hover:bg-white/[0.03]">
                          <td className="px-2 py-3">
                            <div className="flex items-center gap-3">
                              <RoleIcon role={role} size={22} className="shrink-0" />
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/new/player/${encodeURIComponent(normalizeTag(member.tag) || member.tag || '')}`}
                                    className="text-white font-semibold tracking-[0.02em] hover:text-[var(--accent-alt)] transition-colors"
                                    style={{ fontFamily: 'var(--font-body)' }}
                                    title="View full player profile"
                                  >
                                    {member.name || member.tag}
                                  </Link>
                                  <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ background: activity.tone }}
                                    title={activity.evidence?.level || activity.band}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <TownHallIcon level={townHall ?? undefined} size="sm" showBadge />
                          </td>
                          <td className="px-2 py-3 text-center" title={league ? `League: ${league}${tier ? ` ${tier}` : ''}` : 'League unknown'}>
                            <LeagueIcon league={league} ranked size="sm" badgeText={tier} showBadge />
                          </td>
                        <td
                          className="px-2 py-3 font-semibold text-white text-right tabular-nums"
                          title="Ranked trophies: current season ladder points."
                        >
                          {trophies.toLocaleString()}
                        </td>
                        <td
                          className="px-2 py-3 text-right tabular-nums font-semibold"
                          style={{ color: '#34d399' }}
                          title="Season donations given: higher is better."
                        >
                          {(member.donations ?? 0).toLocaleString()}
                        </td>
                        <td
                          className="px-2 py-3 text-right tabular-nums"
                          title="Season donations received."
                        >
                          {(member.donationsReceived ?? 0).toLocaleString()}
                        </td>
                        <td
                          className="px-2 py-3 font-semibold text-right tabular-nums"
                          style={{ color: rushTone(rushValue) }}
                          title="Rush %: lower is better (green <10%, yellow 10-20%, red >20%)."
                        >
                          {formatRush(rushValue)}
                        </td>
                        <td
                          className="px-2 py-3 font-semibold text-white text-right tabular-nums"
                          title="SRS: temporary roster score (activity/skill placeholder; real calc forthcoming)."
                        >
                          {Math.round(activity.score)}
                        </td>
                          {(['bk', 'aq', 'gw', 'rc', 'mp'] as const).map((heroKey) => {
                            const level = (member as any)[heroKey] || 0;
                            const max = (heroCaps as any)[heroKey] || 0;
                            if (!level && !max) {
                              return (
                                <td key={`${member.tag}-${heroKey}`} className="px-2 py-3 text-center text-slate-600 tabular-nums text-[12px]">
                                  —
                                </td>
                              );
                            }
                            const pct = max ? Math.round((level / max) * 100) : 0;
                            return (
                              <td
                                key={`${member.tag}-${heroKey}`}
                                className="px-2 py-3 text-center font-semibold text-white tabular-nums text-[12px]"
                                title={`${heroKey.toUpperCase()} ${level}${max ? ` / ${max} (${pct}%)` : ''}`}
                                style={{ width: '48px' }}
                              >
                                {level}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-sm text-slate-300">No roster members match that filter.</div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
