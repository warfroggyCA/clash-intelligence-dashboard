"use client";

import { useMemo, useState, useEffect } from 'react';
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
import type { RosterMember, RosterData } from '@/app/(dashboard)/simple-roster/roster-transform';
import { formatDistanceToNow } from 'date-fns';
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
import Link from 'next/link';
import { RosterCardsSkeleton } from './RosterCardsSkeleton';
import { normalizeTag } from '@/lib/tags';
import { normalizeSearch } from '@/lib/search';

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

// Mini stat card for header
const MiniStatCard = ({ 
  label, 
  value, 
  icon, 
  color = '#fff',
  subtext
}: { 
  label: string; 
  value: string | number; 
  icon?: string;
  color?: string;
  subtext?: string;
}) => (
  <div 
    className="flex flex-col items-center justify-center px-4 py-3 rounded-xl transition-all duration-300 hover:scale-105"
    style={{ 
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.08)'
    }}
  >
    <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
    <div className="flex items-center gap-1">
      {icon && <span className="text-lg">{icon}</span>}
      <span 
        className="text-2xl font-black"
        style={{ color, textShadow: `0 0 20px ${color}30` }}
      >
        {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
      </span>
    </div>
    {subtext && <div className="text-[10px] text-slate-500 mt-0.5">{subtext}</div>}
  </div>
);

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
          className="h-6 rounded-sm flex items-center justify-center text-[10px] font-bold text-white/90 transition-all hover:scale-y-125"
          style={{ 
            width: `${(count / total) * 100}%`,
            minWidth: count > 0 ? '24px' : 0,
            background: thColors[th] || '#64748b',
            boxShadow: `0 0 10px ${thColors[th] || '#64748b'}40`
          }}
          title={`TH${th}: ${count} members`}
        >
          {th}
        </div>
      ))}
    </div>
  );
};

const heroMeta: Record<string, { name: string; gradient: string }> = {
  bk: { name: 'Barbarian King', gradient: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)' },
  aq: { name: 'Archer Queen', gradient: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)' },
  gw: { name: 'Grand Warden', gradient: 'linear-gradient(90deg, #a855f7 0%, #9333ea 100%)' },
  rc: { name: 'Royal Champion', gradient: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)' },
  mp: { name: 'Minion Prince', gradient: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)' },
};

export default function RosterClient({ initialRoster }: { initialRoster?: RosterData | null }) {
  const { data, members, isLoading, error, isValidating, mutate } = useRosterData(initialRoster || undefined);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'current' | 'former'>('all');

  const filteredMembers = useMemo(() => {
    const query = normalizeSearch(search.trim());
    let list = members;
    if (status === 'former') {
      // Placeholder: current API only returns active roster; former list will be populated once available
      list = [];
    }
    if (!query) return list;
    return list.filter((member) => {
      const name = normalizeSearch(member.name || '');
      const tag = normalizeSearch(member.tag || '');
      return name.includes(query) || tag.includes(query);
    });
  }, [members, search, status]);

  // Calculate clan-wide stats for the header
  const clanStats = useMemo(() => {
    if (!members.length) return null;
    
    const thDistribution: Record<number, number> = {};
    let totalHeroPower = 0;
    let totalDonations = 0;
    let totalTrophies = 0;
    let activeCount = 0;
    let topDonator = { name: '', value: 0 };
    let topTrophies = { name: '', value: 0 };
    
    members.forEach((m) => {
      const th = resolveTownHall(m);
      if (th) thDistribution[th] = (thDistribution[th] || 0) + 1;
      
      const heroPower = (m.bk ?? 0) + (m.aq ?? 0) + (m.gw ?? 0) + (m.rc ?? 0) + (m.mp ?? 0);
      totalHeroPower += heroPower;
      totalDonations += m.donations ?? 0;
      totalTrophies += resolveTrophies(m);
      
      const activity = resolveActivity(m);
      if (activity.band !== 'Low') activeCount++;
      
      if ((m.donations ?? 0) > topDonator.value) {
        topDonator = { name: m.name || m.tag || '', value: m.donations ?? 0 };
      }
      const trophies = resolveTrophies(m);
      if (trophies > topTrophies.value) {
        topTrophies = { name: m.name || m.tag || '', value: trophies };
      }
    });
    
    return {
      memberCount: members.length,
      thDistribution,
      avgHeroPower: Math.round(totalHeroPower / members.length),
      totalDonations,
      avgTrophies: Math.round(totalTrophies / members.length),
      activePercent: Math.round((activeCount / members.length) * 100),
      topDonator,
      topTrophies,
    };
  }, [members]);

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
    const heroPower = (member.bk ?? 0) + (member.aq ?? 0) + (member.gw ?? 0) + (member.rc ?? 0) + (member.mp ?? 0);

    // Filter heroes to only show those that are unlocked for this TH level
    const caps = HERO_MAX_LEVELS[townHall ?? 0] || {};
    const availableHeroes = ['bk', 'aq', 'gw', 'rc', 'mp'].filter((heroKey) => {
      const max = (caps as any)[heroKey] || 0;
      return max > 0;
    });

    // Calculate total hero progress as a percentage
    let totalLevels = 0;
    let totalMaxLevels = 0;
    availableHeroes.forEach((heroKey) => {
      const level = (member as any)[heroKey] || 0;
      const max = (caps as any)[heroKey] || 0;
      totalLevels += level;
      totalMaxLevels += max;
    });
    const overallHeroPercent = totalMaxLevels > 0 ? Math.round((totalLevels / totalMaxLevels) * 100) : 0;

    return (
      <div
        key={member.tag}
        className="group relative rounded-2xl p-5 transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5"
        style={{ 
          background: 'linear-gradient(135deg, rgba(30,41,59,0.9) 0%, rgba(15,23,42,0.95) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}
      >
        {/* Hover glow effect */}
        <div 
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ 
            background: 'radial-gradient(circle at 50% 0%, rgba(234,179,8,0.1) 0%, transparent 60%)',
            boxShadow: '0 0 40px rgba(234,179,8,0.1)'
          }}
        />
        
        <div className="relative z-10 space-y-4">
          {/* ═══ HEADER: Name on top, metadata below ═══ */}
          <div className="space-y-2">
            {/* Row 1: Player name (full width) */}
            <Link
              href={`/new/player/${encodeURIComponent(normalizeTag(member.tag) || member.tag || '')}`}
              className="text-white text-xl font-bold tracking-tight hover:text-[var(--accent-alt)] transition-colors block"
              style={{ fontFamily: 'var(--font-body)' }}
              title="View full player profile"
            >
              {member.name || member.tag}
            </Link>
            
            {/* Row 2: Role + Activity/SRS on left, TH + League on right */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <RoleIcon role={role} size={28} className="shrink-0" />
                <span
                  className="inline-flex h-2 w-2 rounded-full shrink-0"
                  style={{ background: activity.tone }}
                  aria-label={`Activity ${activity.band}`}
                  title={activity.evidence?.level || activity.band}
                />
                <span className="text-xs text-slate-400">
                  SRS {Math.round(activity.score)}
                </span>
              </div>
              
              {/* Right: TH + League (visually grouped, same size) */}
              <div className="flex items-center gap-2 shrink-0">
                {league && (
                  <div className="flex items-center" title={`${league}${tier ? ` ${tier}` : ''}`}>
                    <LeagueIcon league={league} ranked size="md" badgeText={tier} showBadge />
                  </div>
                )}
                <TownHallIcon level={townHall ?? undefined} size="md" />
              </div>
            </div>
          </div>

          {/* ═══ KEY STATS: Simplified 2-column layout ═══ */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {/* Trophies */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Trophies</div>
              <div className="text-2xl font-black text-amber-400">
                {trophies.toLocaleString()}
              </div>
            </div>

            {/* Donations */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Donated</div>
              <div className="text-2xl font-black text-emerald-400">
                {(member.donations ?? 0).toLocaleString()}
              </div>
            </div>

            {/* Rush Score - More prominent */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Base</div>
              <div className="text-2xl font-black" style={{ color: rushColor }}>
                {formatRush(rushValue)}
              </div>
            </div>

            {/* Hero Progress - Compact summary */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Heroes</div>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-black text-purple-400">
                  {overallHeroPercent}%
                </div>
                <div className="text-xs text-slate-500">
                  {totalLevels}/{totalMaxLevels}
                </div>
              </div>
            </div>
          </div>

          {/* ═══ HERO ICONS: Compact row, only unlocked heroes ═══ */}
          <div className="flex items-center gap-2.5 pt-3 border-t border-white/5">
            {availableHeroes.map((heroKey) => {
              const level = (member as any)[heroKey] || 0;
              const max = (caps as any)[heroKey] || 0;
              const percent = max > 0 ? Math.min((level / max) * 100, 100) : 0;
              const meta = heroMeta[heroKey] || { name: heroKey.toUpperCase(), gradient: 'linear-gradient(90deg,#38bdf8,#0ea5e9)' };
              const iconSrc = (heroIconMap as any)[heroKey] || '';
              
              // Determine if hero needs attention (rushed or maxed)
              const isRushed = percent < 70;
              const isMaxed = percent === 100;
              
              return (
                <div
                  key={`${member.tag}-${heroKey}`}
                  className="relative group/hero transition-transform hover:scale-110"
                  title={`${meta.name}: ${level}/${max} (${Math.round(percent)}%)`}
                >
                  {iconSrc ? (
                    <div className="relative w-10 h-10 flex items-center justify-center">
                      <Image 
                        src={iconSrc} 
                        alt={meta.name} 
                        width={48} 
                        height={48} 
                        className={`object-contain transition-all ${
                          isRushed ? 'opacity-60 saturate-50' : 
                          isMaxed ? 'brightness-110 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]' : 
                          'opacity-90'
                        }`}
                        style={{ maxWidth: '48px', maxHeight: '48px' }}
                      />
                      {/* Level badge */}
                      <span
                        className={`absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                          isMaxed ? 'bg-amber-500 text-black' : 
                          isRushed ? 'bg-red-500/90 text-white' : 
                          'bg-black/90 text-white'
                        }`}
                        style={{ lineHeight: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                      >
                        {level}
                      </span>
                      {/* Thin progress indicator on hover */}
                      <div className="absolute -bottom-0.5 left-0 right-0 h-1 bg-black/50 rounded-full overflow-hidden opacity-0 group-hover/hero:opacity-100 transition-opacity">
                        <div
                          className="h-full rounded-full"
                          style={{ 
                            width: `${percent}%`, 
                            background: meta.gradient
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
            
            {/* Received donations - always visible but subtle */}
            {(member.donationsReceived ?? 0) > 0 && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500" title="Received donations this season">
                <span className="opacity-60">↓</span>
                <span>{(member.donationsReceived ?? 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════════
          WORLD-CLASS CLAN HEADER BANNER
      ═══════════════════════════════════════════════════════════════════════ */}
      <div 
        className="relative rounded-3xl overflow-hidden"
        style={{ 
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
      >
        {/* Animated gradient overlay */}
        <div 
          className="absolute inset-0 opacity-60"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 40%, rgba(234,179,8,0.12) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 60%, rgba(59,130,246,0.1) 0%, transparent 50%),
              radial-gradient(ellipse 40% 30% at 50% 80%, rgba(16,185,129,0.08) 0%, transparent 50%)
            `,
          }}
        />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
        
        <div className="relative p-6 lg:p-8">
          {/* Top row: Clan name + Actions */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 
                  className="text-4xl lg:text-5xl font-black text-white tracking-tight"
                  style={{ 
                    fontFamily: 'var(--font-display)', 
                    textShadow: '0 4px 20px rgba(0,0,0,0.5)'
                  }}
                >
                  {data?.clanName || 'Roster'}
                </h1>
                {clanStats && (
                  <div 
                    className="px-3 py-1 rounded-full text-sm font-bold"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(234,179,8,0.2) 0%, rgba(245,158,11,0.3) 100%)',
                      border: '1px solid rgba(234,179,8,0.3)',
                      color: '#fbbf24'
                    }}
                  >
                    {clanStats.memberCount} Members
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                {data?.clanTag && (
                  <code className="text-slate-400 bg-black/30 px-2 py-0.5 rounded font-mono text-xs">
                    {data.clanTag}
                  </code>
                )}
                {safeLastUpdated && (
                  <>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">
                      Updated {formatDistanceToNow(safeLastUpdated, { addSuffix: true })}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 text-sm">
              <Button tone="primary" onClick={() => mutate()} disabled={isValidating}>
                {isValidating ? 'Refreshing…' : 'Refresh'}
              </Button>
              <Button tone="accentAlt">Generate Insights</Button>
              <Button tone="ghost">Export</Button>
              <Link
                href="/new/roster/table"
                className="inline-flex items-center justify-center rounded-xl border px-4 py-2 font-semibold text-sm backdrop-blur-sm"
                style={{ borderColor: 'var(--border-subtle)', background: 'rgba(30,41,59,0.5)', color: 'var(--text)' }}
              >
                Table view
              </Link>
            </div>
          </div>

          {/* TH Distribution Bar */}
          {clanStats && (
            <div className="mb-6">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Town Hall Distribution</div>
              <THDistributionBar distribution={clanStats.thDistribution} />
            </div>
          )}

          {/* Stats Row */}
          {clanStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MiniStatCard 
                label="Members" 
                value={clanStats.memberCount} 
                icon="👥"
                color="#f59e0b"
              />
              <MiniStatCard 
                label="Avg Hero Power" 
                value={clanStats.avgHeroPower} 
                icon="⚔️"
                color="#8b5cf6"
              />
              <MiniStatCard 
                label="Total Donated" 
                value={clanStats.totalDonations} 
                icon="📤"
                color="#10b981"
              />
              <MiniStatCard 
                label="Avg Trophies" 
                value={clanStats.avgTrophies} 
                icon="🏆"
                color="#eab308"
              />
              <MiniStatCard 
                label="Active" 
                value={`${clanStats.activePercent}%`} 
                icon="📈"
                color="#22c55e"
              />
              <MiniStatCard 
                label="Top Donator" 
                value={clanStats.topDonator.value} 
                icon="🥇"
                color="#f472b6"
                subtext={clanStats.topDonator.name.slice(0, 12)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border" style={{ background: 'var(--card)', borderColor: 'var(--border-subtle)' }}>
        <div className="border-b border-white/5 px-4 py-2 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search players"
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

        {isLoading && (!data || members.length === 0) ? (
          <RosterCardsSkeleton />
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
