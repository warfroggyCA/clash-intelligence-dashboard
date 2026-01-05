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
  rosterLeagueSort,
  rushTone,
} from '../roster-utils';
import RosterClient from '../RosterClient';
import type { RosterData } from '@/app/(dashboard)/simple-roster/roster-transform';
import { RosterSkeleton } from '@/components/ui/RosterSkeleton';
import { normalizeTag } from '@/lib/tags';
import { normalizeSearch } from '@/lib/search';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// WORLD-CLASS COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Animated counter
const AnimatedCounter = ({ value, duration = 800 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    if (typeof value !== 'number' || isNaN(value)) return;
    const startTime = Date.now();
    const startValue = displayValue;
    const diff = value - startValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + diff * easeOut));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return <>{displayValue.toLocaleString()}</>;
};

// TH distribution bar
const THDistributionBar = ({ distribution }: { distribution: Record<number, number> }) => {
  const thColors: Record<number, string> = {
    17: '#f43f5e', 16: '#f97316', 15: '#eab308', 14: '#22c55e', 
    13: '#3b82f6', 12: '#8b5cf6', 11: '#ec4899', 10: '#6366f1',
    9: '#06b6d4', 8: '#84cc16', 7: '#f59e0b', 6: '#78716c'
  };
  
  const entries = Object.entries(distribution)
    .map(([th, count]) => ({ th: parseInt(th), count }))
    .filter(e => e.count > 0)
    .sort((a, b) => b.th - a.th);
  
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  if (total === 0) return null;
  
  return (
    <div className="flex items-center gap-1 w-full max-w-md">
      {entries.map(({ th, count }) => (
        <div
          key={th}
          className="h-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white/90"
          style={{ 
            width: `${(count / total) * 100}%`,
            minWidth: count > 0 ? '20px' : 0,
            background: thColors[th] || '#64748b',
          }}
          title={`TH${th}: ${count}`}
        >
          {th}
        </div>
      ))}
    </div>
  );
};

export default function TableClient({ initialRoster }: { initialRoster?: RosterData | null }) {
  const { data, members, isLoading, error, isValidating, mutate } = useRosterData(initialRoster || undefined);
  const [search, setSearch] = useState('');
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const update = () => setIsNarrow(typeof window !== 'undefined' ? window.innerWidth < 1280 : false);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const filteredMembers = useMemo(() => {
    const query = normalizeSearch(search.trim());
    if (!query) return members;
    return members.filter((member) => {
      const name = normalizeSearch(member.name || '');
      const tag = normalizeSearch(member.tag || '');
      return name.includes(query) || tag.includes(query);
    });
  }, [members, search]);

  const sortedMembers = useMemo(() => rosterLeagueSort(filteredMembers), [filteredMembers]);

  // Calculate clan-wide stats for the header
  const clanStats = useMemo(() => {
    if (!members.length) return null;
    
    const thDistribution: Record<number, number> = {};
    const sumIfComplete = (values: Array<number | null | undefined>) => {
      let sum = 0;
      let hasValue = false;
      for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) {
          sum += value;
          hasValue = true;
        } else {
          return null;
        }
      }
      return hasValue ? sum : null;
    };
    const heroPowers: Array<number | null> = [];
    const donations: Array<number | null> = [];
    const trophies: Array<number | null> = [];
    
      members.forEach((m) => {
        const th = resolveTownHall(m);
        if (th) thDistribution[th] = (thDistribution[th] || 0) + 1;
      heroPowers.push(m.heroPower ?? null);
      donations.push(m.donations ?? null);
      trophies.push(resolveTrophies(m));
    });
    const totalHeroPower = sumIfComplete(heroPowers);
    const totalDonations = sumIfComplete(donations);
    const totalTrophies = sumIfComplete(trophies);
    
    return {
      memberCount: members.length,
      thDistribution,
      avgHeroPower: totalHeroPower != null ? Math.round(totalHeroPower / members.length) : null,
      totalDonations,
      avgTrophies: totalTrophies != null ? Math.round(totalTrophies / members.length) : null,
    };
  }, [members]);

  const lastUpdated = data?.snapshotMetadata?.fetchedAt ?? data?.snapshotMetadata?.snapshotDate ?? data?.lastUpdated ?? null;
  const parsedLastUpdated = lastUpdated ? new Date(lastUpdated) : null;
  const safeLastUpdated = parsedLastUpdated && !Number.isNaN(parsedLastUpdated.getTime()) ? parsedLastUpdated : null;

  if (isNarrow) {
    // On narrow viewports, just reuse the card layout to avoid cramped columns and duplicate headers.
    return <RosterClient initialRoster={initialRoster} />;
  }

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════════
          WORLD-CLASS HEADER BANNER
      ═══════════════════════════════════════════════════════════════════════ */}
      <div 
        className="relative rounded-2xl overflow-hidden"
        style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          boxShadow: '0 20px 40px -12px rgba(0,0,0,0.4)'
        }}
      >
        {/* Gradient overlay */}
        <div 
          className="absolute inset-0 opacity-50"
          style={{
            background: `
              radial-gradient(ellipse 60% 40% at 30% 50%, rgba(59,130,246,0.1) 0%, transparent 50%),
              radial-gradient(ellipse 50% 30% at 70% 50%, rgba(234,179,8,0.08) 0%, transparent 50%)
            `,
          }}
        />
        
        <div className="relative p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Clan name + stats */}
            <div className="flex items-center gap-6">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 
                    className="text-3xl font-black text-white tracking-tight"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {data?.clanName || 'Roster Table'}
                  </h1>
                  {clanStats && (
                    <span 
                      className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(234,179,8,0.2)', color: '#fbbf24' }}
                    >
                      {clanStats.memberCount} Members
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {data?.clanTag && <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono">{data.clanTag}</code>}
                  {safeLastUpdated && (
                    <span>Updated {formatDistanceToNow(safeLastUpdated, { addSuffix: true })}</span>
                  )}
                </div>
              </div>
              
              {/* TH Distribution */}
              {clanStats && (
                <div className="hidden lg:block">
                  <THDistributionBar distribution={clanStats.thDistribution} />
                </div>
              )}
            </div>
            
            {/* Right: Quick stats + Actions */}
            <div className="flex items-center gap-4">
              {clanStats && (
                <div className="hidden md:flex items-center gap-3 text-xs">
                  <div className="text-center px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <div className="text-slate-500 uppercase tracking-widest text-[9px]">Avg Power</div>
                    <div className="text-purple-400 font-bold text-lg">{clanStats.avgHeroPower ?? '—'}</div>
                  </div>
                  <div className="text-center px-3 py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <div className="text-slate-500 uppercase tracking-widest text-[9px]">Total Donated</div>
                    <div className="text-emerald-400 font-bold text-lg">
                      {clanStats.totalDonations != null ? clanStats.totalDonations.toLocaleString() : '—'}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button tone="primary" onClick={() => mutate()} disabled={isValidating}>
                  {isValidating ? 'Refreshing…' : 'Refresh'}
                </Button>
                <Link
                  href="/new/roster"
                  className="inline-flex items-center justify-center rounded-xl border px-4 py-2 font-semibold text-sm"
                  style={{ borderColor: 'var(--border-subtle)', background: 'rgba(30,41,59,0.5)', color: 'var(--text)' }}
                >
                  Card view
                </Link>
              </div>
            </div>
          </div>
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
                    {sortedMembers.map((member) => {
                      const role = normalizeRole(member.role);
                      const townHall = resolveTownHall(member);
                      const { league, tier } = resolveLeague(member);
                      const trophies = resolveTrophies(member);
                      const rushValue = resolveRushPercent(member);
                      const activity = resolveActivity(member);
                      const heroCaps = HERO_MAX_LEVELS[townHall ?? 0] || {};

                      return (
                        <tr 
                          key={member.tag} 
                          className="h-16 border-b border-white/5 transition-all duration-200 hover:bg-gradient-to-r hover:from-white/[0.04] hover:to-transparent group"
                        >
                          <td className="px-3 py-3 align-middle">
                            <div className="flex h-full items-center gap-3">
                              <RoleIcon role={role} size={22} className="shrink-0" />
                              <div className="flex flex-col justify-center">
                                <div className="flex items-center gap-2 leading-tight">
                                  <Link
                                    href={`/new/player/${encodeURIComponent(normalizeTag(member.tag) || member.tag || '')}`}
                                    className="text-white font-semibold tracking-[0.02em] hover:text-[var(--accent-alt)] transition-colors group-hover:text-amber-300"
                                    style={{ fontFamily: 'var(--font-body)', display: 'inline-block', position: 'relative', top: '2px', lineHeight: '1', transform: 'translateY(12px)' }}
                                    title="View full player profile"
                                  >
                                    {member.name || member.tag}
                                  </Link>
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ background: activity.tone, boxShadow: `0 0 6px ${activity.tone}` }}
                                    title={activity.evidence?.level || activity.band}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center align-middle">
                            <TownHallIcon level={townHall ?? undefined} size="sm" showBadge />
                          </td>
                          <td className="px-2 py-3 text-center align-middle" title={league ? `League: ${league}${tier ? ` ${tier}` : ''}` : 'League unknown'}>
                            <LeagueIcon league={league} ranked size="sm" badgeText={tier} showBadge />
                          </td>
                        <td
                          className="px-2 py-3 font-bold text-right tabular-nums align-middle"
                          style={{ color: '#fbbf24' }}
                          title="Ranked trophies: current season ladder points."
                        >
                          {trophies != null ? trophies.toLocaleString() : '—'}
                        </td>
                        <td
                          className="px-2 py-3 text-right tabular-nums font-bold align-middle"
                          style={{ color: '#34d399' }}
                          title="Season donations given: higher is better."
                        >
                          {member.donations != null ? member.donations.toLocaleString() : '—'}
                        </td>
                        <td
                          className="px-2 py-3 text-right tabular-nums text-slate-400 align-middle"
                          title="Season donations received."
                        >
                          {member.donationsReceived != null ? member.donationsReceived.toLocaleString() : '—'}
                        </td>
                        <td
                          className="px-2 py-3 font-bold text-right tabular-nums align-middle"
                          style={{ color: rushTone(rushValue) }}
                          title="Rush %: lower is better (green <10%, yellow 10-20%, red >20%)."
                        >
                          {formatRush(rushValue)}
                        </td>
                        <td
                          className="px-2 py-3 font-bold text-right tabular-nums align-middle"
                          style={{ color: '#a78bfa' }}
                          title="SRS: temporary roster score (activity/skill placeholder; real calc forthcoming)."
                        >
                          {typeof activity.score === 'number' ? Math.round(activity.score) : '—'}
                        </td>
                          {(['bk', 'aq', 'gw', 'rc', 'mp'] as const).map((heroKey) => {
                            const level = (member as any)[heroKey] || 0;
                            const max = (heroCaps as any)[heroKey] || 0;
                            if (!level && !max) {
                              return (
                                <td key={`${member.tag}-${heroKey}`} className="px-2 py-3 text-center text-slate-600 tabular-nums text-[12px] align-middle">
                                  —
                                </td>
                              );
                            }
                            const pct = max ? Math.round((level / max) * 100) : 0;
                            return (
                              <td
                                key={`${member.tag}-${heroKey}`}
                                className="px-2 py-3 text-center font-semibold text-white tabular-nums text-[12px] align-middle"
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
