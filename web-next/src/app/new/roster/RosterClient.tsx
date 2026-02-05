"use client";

import { useMemo, useState, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import useSWR from 'swr';
import type { IngestionJobRecord } from '@/lib/ingestion/job-store';
import { Spec2Button as Button, Spec2Input as Input, Spec2IconButton } from '@/components/ui/Spec2Controls';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import LeagueIcon from '@/components/new-ui/icons/LeagueIcon';
import RoleIcon from '@/components/new-ui/icons/RoleIcon';
import { heroIconMap } from '@/components/new-ui/icons/maps';
import { useRosterData } from './useRosterData';
import { apiFetcher } from '@/lib/api/swr-fetcher';
import Image from 'next/image';
import { HERO_MAX_LEVELS } from '@/types';
import type { RosterMember, RosterData } from './types';
import { formatDistanceToNow } from 'date-fns';
import { RosterHeader } from './RosterHeader';
import {
  normalizeRole,
  resolveActivity,
  resolveLeague,
  resolveLeagueBadgeText,
  resolveRushPercent,
  resolveTownHall,
  resolveTrophies,
  rosterLeagueSort,
} from './roster-utils';
import Link from 'next/link';
import { Tooltip } from '@/components/ui/Tooltip';
import { MoreHorizontal } from 'lucide-react';

const useMountFade = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
};
import { RosterCardsSkeleton } from './RosterCardsSkeleton';
import { normalizeTag } from '@/lib/tags';
import { normalizeSearch } from '@/lib/search';
import { useRouter, useSearchParams } from 'next/navigation';
import { showToast } from '@/lib/toast';
import { useLeadership } from '@/hooks/useLeadership';
import {
  handleCopySummary,
  handleExportCSV,
  handleExportDiscord,
} from '@/lib/export/roster-export';
import { RosterPlayerNotesModal } from '@/components/leadership/RosterPlayerNotesModal';
import { RosterPlayerTenureModal } from '@/components/leadership/RosterPlayerTenureModal';
import { RosterPlayerDepartureModal } from '@/components/leadership/RosterPlayerDepartureModal';

// ═══════════════════════════════════════════════════════════════════════════════
// WORLD-CLASS COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// Animated counter
const AnimatedCounter = ({ value, duration = 800 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const displayValueRef = useRef(0);
  
  useEffect(() => {
    if (typeof value !== 'number' || isNaN(value)) return;
    const startTime = Date.now();
    const startValue = displayValueRef.current;
    const diff = value - startValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(startValue + diff * easeOut);
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return <>{displayValue.toLocaleString()}</>;
};

const surface = {
  card: 'var(--card)',
  panel: 'var(--panel)',
  border: 'var(--border-subtle)',
};

const text = {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
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
    className="flex flex-col items-center justify-center px-3 py-2 rounded-lg"
    style={{
      background: surface.panel,
      border: `1px solid ${surface.border}`,
    }}
  >
    <div className="text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: text.muted }}>{label}</div>
    <div className="flex items-center gap-1">
      {icon && <span className="text-base">{icon}</span>}
      <span className="text-xl font-extrabold tabular-nums" style={{ color }}>
        {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
      </span>
    </div>
    {subtext && <div className="text-[10px] mt-0.5" style={{ color: text.muted }}>{subtext}</div>}
  </div>
);

const heroMeta: Record<string, { name: string; gradient: string }> = {
  bk: { name: 'Barbarian King', gradient: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)' },
  aq: { name: 'Archer Queen', gradient: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)' },
  gw: { name: 'Grand Warden', gradient: 'linear-gradient(90deg, #a855f7 0%, #9333ea 100%)' },
  rc: { name: 'Royal Champion', gradient: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)' },
  mp: { name: 'Minion Prince', gradient: 'linear-gradient(90deg, #f59e0b 0%, #f97316 100%)' },
};

const Chip = ({
  label,
  tone = 'muted',
}: {
  label: string;
  tone?: 'muted' | 'info' | 'vip' | 'success' | 'warning' | 'danger';
}) => {
  const styleMap: Record<string, { bg: string; fg: string; border: string }> = {
    muted: { bg: 'transparent', fg: text.secondary, border: surface.border },
    info: { bg: 'rgba(96,165,250,0.18)', fg: text.primary, border: 'rgba(96,165,250,0.26)' },
    vip: { bg: 'rgba(167,139,250,0.18)', fg: text.primary, border: 'rgba(167,139,250,0.26)' },
    success: { bg: 'rgba(52,211,153,0.18)', fg: text.primary, border: 'rgba(52,211,153,0.26)' },
    warning: { bg: 'rgba(251,191,36,0.18)', fg: text.primary, border: 'rgba(251,191,36,0.26)' },
    danger: { bg: 'rgba(248,113,113,0.18)', fg: text.primary, border: 'rgba(248,113,113,0.26)' },
  };

  const style = styleMap[tone] ?? styleMap.muted;

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tabular-nums"
      style={{ background: style.bg, color: style.fg, border: `1px solid ${style.border}` }}
    >
      {label}
    </span>
  );
};

const Progress = ({
  label,
  value,
  detail,
  tone = 'primary',
}: {
  label: string;
  value: number | null;
  detail?: string;
  tone?: 'primary' | 'secondary';
}) => {
  const pct = value == null ? null : Math.max(0, Math.min(100, value));
  const barColor = tone === 'secondary' ? 'var(--accent)' : 'var(--accent-alt)';
  const barHeight = tone === 'secondary' ? 'h-1.5' : 'h-2';

  const tooltip = detail ? (
    <div>
      <div className="font-semibold" style={{ color: text.primary }}>{label}</div>
      <div style={{ color: text.secondary }}>{detail}{pct != null ? ` · ${pct}%` : ''}</div>
    </div>
  ) : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: text.secondary }}>
        {tooltip ? (
          <Tooltip content={tooltip}>
            <span className="uppercase tracking-[0.16em] cursor-help">{label}</span>
          </Tooltip>
        ) : (
          <span className="uppercase tracking-[0.16em]">{label}</span>
        )}
        <span className="tabular-nums" style={{ color: text.primary }}>
          {pct == null ? '—' : `${pct}%`}
        </span>
      </div>
      <div className={`${barHeight} rounded-full`} style={{ background: surface.border }}>
        <div
          className="h-full rounded-full"
          style={{ width: pct == null ? '0%' : `${pct}%`, background: barColor, opacity: pct == null ? 0 : 1 }}
        />
      </div>
    </div>
  );
};

type FormerMember = {
  tag: string;
  name: string;
  lastRole?: string | null;
  lastTownHallLevel?: number | null;
  lastLeagueName?: string | null;
  lastRankedLeagueName?: string | null;
  lastRankedTrophies?: number | null;
  lastLeagueTrophies?: number | null;
  totalTenureDays?: number | null;
  departedAt?: string | null;
  updatedAt?: string | null;
};

const isNewJoiner = (member: RosterMember): boolean => {
  const tenure = member.tenureDays ?? member.tenure_days;
  return typeof tenure === 'number' && tenure <= 7;
};

export default function RosterClient({
  initialRoster,
  onViewChange,
  mode,
  onToggleMode,
}: {
  initialRoster?: RosterData | null;
  onViewChange?: (view: 'cards' | 'table') => void;
  mode: 'dark' | 'light';
  onToggleMode: () => void;
}) {
  const mounted = useMountFade();
  const { data, members, isLoading, error, isValidating, mutate, clanTag, refreshLive } = useRosterData(initialRoster || undefined);
  const { permissions } = useLeadership();
  const searchParams = useSearchParams();
  const router = useRouter();

  const joinerFilter = searchParams?.get('filter') === 'new-joiners';
  const initialQ = searchParams?.get('q') ?? '';
  const initialStatusParam = searchParams?.get('status');

  const [search, setSearch] = useState(() => initialQ);
  const deferredSearch = useDeferredValue(search);
  const normalizedQuery = useMemo(() => normalizeSearch(deferredSearch.trim()), [deferredSearch]);
  const [status, setStatus] = useState<'all' | 'current' | 'former'>(() =>
    initialStatusParam === 'current' || initialStatusParam === 'former' || initialStatusParam === 'all'
      ? (initialStatusParam as any)
      : 'all'
  );
  const shouldLoadFormer = status === 'former';
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [actionMenuTag, setActionMenuTag] = useState<string | null>(null);
  const [notesTarget, setNotesTarget] = useState<RosterMember | null>(null);
  const [tenureTarget, setTenureTarget] = useState<RosterMember | null>(null);
  const [departureTarget, setDepartureTarget] = useState<RosterMember | null>(null);

  const formerKey = shouldLoadFormer && clanTag
    ? `/api/v2/roster/former?clanTag=${encodeURIComponent(clanTag)}`
    : null;

  const {
    data: formerData,
    error: formerError,
    isLoading: isFormerLoading,
  } = useSWR<{ members: FormerMember[] }>(formerKey, apiFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  const formerMembers = useMemo(() => formerData?.members ?? [], [formerData]);

  const newJoinerCount = useMemo(
    () => members.filter(isNewJoiner).length,
    [members]
  );

  const resolvedClanTag = data?.clanTag || clanTag || '';

  const exportRoster = useMemo<RosterData | null>(() => {
    if (data) return data;
    if (!members.length) return null;
    return {
      members,
      clanName: resolvedClanTag || 'Roster',
      clanTag: resolvedClanTag || 'UNKNOWN',
      date: null,
    };
  }, [data, members, resolvedClanTag]);

  useEffect(() => {
    if (!exportOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!exportRef.current) return;
      if (event.target instanceof Node && !exportRef.current.contains(event.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [exportOpen]);

  // Close per-card action menu on outside click / Escape
  useEffect(() => {
    if (!actionMenuTag) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        setActionMenuTag(null);
        return;
      }
      const root = target.closest?.(`[data-action-menu-root="${actionMenuTag}"]`);
      if (root) return;
      setActionMenuTag(null);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionMenuTag(null);
    };

    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [actionMenuTag]);

  const handleGenerateInsights = useCallback(() => {
    if (!permissions.canGenerateCoachingInsights) {
      showToast('You do not have permission to generate insights.', 'error');
      return;
    }
    showToast('Insight generation is queued.', 'success');
  }, [permissions.canGenerateCoachingInsights]);

  const handleExportAction = useCallback(
    async (action: 'csv' | 'discord' | 'summary') => {
      if (!permissions.canGenerateCoachingInsights) {
        showToast('You do not have permission to export roster data.', 'error');
        return;
      }
      if (!exportRoster) {
        showToast('Roster data is not available yet.', 'error');
        return;
      }
      let ok = false;
      if (action === 'csv') ok = await handleExportCSV(exportRoster);
      if (action === 'discord') ok = await handleExportDiscord(exportRoster);
      if (action === 'summary') ok = await handleCopySummary(exportRoster);
      setExportOpen(false);
      showToast(ok ? 'Export complete.' : 'Export failed.', ok ? 'success' : 'error');
    },
    [permissions.canGenerateCoachingInsights, exportRoster]
  );

  const toggleJoinerFilter = () => {
    if (status === 'former') {
      setStatus('current');
    }
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (joinerFilter) {
      params.delete('filter');
    } else {
      params.set('filter', 'new-joiners');
    }
    const query = params.toString();
    router.replace(query ? `/new/roster?${query}` : '/new/roster');
  };

  // Persist search + status in URL (shareable + survives refresh)
  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? '');

    const q = deferredSearch.trim();
    if (q) params.set('q', q);
    else params.delete('q');

    if (status) params.set('status', status);
    else params.delete('status');

    const next = params.toString();
    const current = (searchParams?.toString() ?? '').replace(/^\?/, '');
    if (next !== current) {
      router.replace(next ? `/new/roster?${next}` : '/new/roster');
    }
  }, [deferredSearch, router, searchParams, status]);

  const applyJoinerFilter = joinerFilter && status !== 'former';

  const filteredCurrentMembers = useMemo(() => {
    const query = normalizedQuery;
    let list = members;
    if (applyJoinerFilter) {
      list = list.filter(isNewJoiner);
    }
    if (!query) return list;
    return list.filter((member) => {
      const name = normalizeSearch(member.name || '');
      const tag = normalizeSearch(member.tag || '');
      return name.includes(query) || tag.includes(query);
    });
  }, [members, normalizedQuery, applyJoinerFilter]);

  const filteredFormerMembers = useMemo(() => {
    const query = normalizedQuery;
    if (!query) return formerMembers;
    return formerMembers.filter((member) => {
      const name = normalizeSearch(member.name || '');
      const tag = normalizeSearch(member.tag || '');
      return name.includes(query) || tag.includes(query);
    });
  }, [formerMembers, normalizedQuery]);

  const sortedMembers = useMemo(() => rosterLeagueSort(filteredCurrentMembers), [filteredCurrentMembers]);

  const sortedFormerMembers = useMemo(() => {
    return [...filteredFormerMembers].sort((a, b) => {
      const dateA = a.departedAt ?? a.updatedAt ?? '';
      const dateB = b.departedAt ?? b.updatedAt ?? '';
      return dateB.localeCompare(dateA);
    });
  }, [filteredFormerMembers]);

  const activeMembers = status === 'former' ? sortedFormerMembers : sortedMembers;
  const activeError = status === 'former' ? formerError : error;
  const activeLoading = status === 'former' ? isFormerLoading : isLoading;

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
    const vipScores: number[] = [];
    const activityCounts = {
      veryActive: 0,
      active: 0,
      moderate: 0,
      low: 0,
      inactive: 0,
    };
    let activeCount = 0;
    let topDonator: { name: string; value: number | null } = { name: '', value: null };
    let topTrophies: { name: string; value: number | null } = { name: '', value: null };
    let topVip: { name: string; value: number | null } = { name: '', value: null };
    
      members.forEach((m) => {
        const th = resolveTownHall(m);
        if (th) thDistribution[th] = (thDistribution[th] || 0) + 1;

      heroPowers.push(m.heroPower ?? null);
      donations.push(m.donations ?? null);
      trophies.push(resolveTrophies(m));
      
      const activity = resolveActivity(m);
      if (activity.band !== 'Low') activeCount++;
      if (activity.level === 'Very Active') activityCounts.veryActive++;
      else if (activity.level === 'Active') activityCounts.active++;
      else if (activity.level === 'Moderate') activityCounts.moderate++;
      else if (activity.level === 'Low') activityCounts.low++;
      else activityCounts.inactive++;
      
      if (typeof m.donations === 'number' && (topDonator.value == null || m.donations > topDonator.value)) {
        topDonator = { name: m.name || m.tag || '', value: m.donations };
      }
      if (typeof m.vip?.score === 'number' && Number.isFinite(m.vip.score)) {
        vipScores.push(m.vip.score);
        if (topVip.value == null || m.vip.score > topVip.value) {
          topVip = { name: m.name || m.tag || '', value: m.vip.score };
        }
      }
      const resolvedTrophies = resolveTrophies(m);
      if (typeof resolvedTrophies === 'number' && (topTrophies.value == null || resolvedTrophies > topTrophies.value)) {
        topTrophies = { name: m.name || m.tag || '', value: resolvedTrophies };
      }
    });
    const totalHeroPower = sumIfComplete(heroPowers);
    const totalDonations = sumIfComplete(donations);
    const totalTrophies = sumIfComplete(trophies);
    const avgVipScore =
      vipScores.length > 0
        ? Math.round((vipScores.reduce((sum, value) => sum + value, 0) / vipScores.length) * 10) / 10
        : null;
    
    return {
      memberCount: members.length,
      thDistribution,
      avgHeroPower: totalHeroPower != null ? Math.round(totalHeroPower / members.length) : null,
      totalDonations,
      avgTrophies: totalTrophies != null ? Math.round(totalTrophies / members.length) : null,
      activePercent: Math.round((activeCount / members.length) * 100),
      topDonator,
      topTrophies,
      avgVipScore,
      topVip,
      activityCounts,
    };
  }, [members]);

  const [ingestionJobId, setIngestionJobId] = useState<string | null>(null);
  const [ingestionRequestedAt, setIngestionRequestedAt] = useState<Date | null>(null);

  const lastUpdated =
    data?.snapshotMetadata?.fetchedAt ??
    data?.snapshotMetadata?.snapshotDate ??
    data?.lastUpdated ??
    data?.date ??
    null;
  const parsedLastUpdated = lastUpdated ? new Date(lastUpdated) : null;
  const safeLastUpdated = parsedLastUpdated && !Number.isNaN(parsedLastUpdated.getTime()) ? parsedLastUpdated : null;

  const updatedLabel = useMemo(() => {
    if (ingestionJobId && ingestionRequestedAt) {
      return `Refresh requested ${formatDistanceToNow(ingestionRequestedAt, { addSuffix: true })}`;
    }
    if (safeLastUpdated) {
      return `Snapshot updated ${formatDistanceToNow(safeLastUpdated, { addSuffix: true })}`;
    }
    return 'Snapshot time unknown';
  }, [ingestionJobId, ingestionRequestedAt, safeLastUpdated]);

  const ingestionJobKey = ingestionJobId ? `/api/ingestion/jobs/${encodeURIComponent(ingestionJobId)}` : null;
  const { data: ingestionJobData } = useSWR<IngestionJobRecord>(
    ingestionJobKey,
    apiFetcher,
    {
      refreshInterval: ingestionJobId ? 1500 : 0,
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    if (!ingestionJobId || !ingestionJobData) return;
    if (ingestionJobData.status === 'completed') {
      showToast('Refresh complete. Loading latest snapshot…', 'success');
      setIngestionJobId(null);
      setIngestionRequestedAt(null);
      void mutate();
    } else if (ingestionJobData.status === 'failed') {
      showToast('Refresh failed. Check logs.', 'error');
      setIngestionJobId(null);
      setIngestionRequestedAt(null);
    }
  }, [ingestionJobId, ingestionJobData, mutate]);

  const handleRequestRefresh = useCallback(async () => {
    if (!permissions.canModifyClanData || !clanTag) {
      showToast('Permission required to request refresh.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/ingestion/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clanTag }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || `Request failed (${res.status})`);
      }
      const jobId = payload?.data?.jobId as string;
      setIngestionJobId(jobId);
      setIngestionRequestedAt(new Date());
      showToast('Refresh queued.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to request refresh.', 'error');
    }
  }, [clanTag, permissions.canModifyClanData]);

  const renderMemberCard = (member: RosterMember) => {
    const role = normalizeRole(member.role);
    const townHall = resolveTownHall(member);
    const { league, tier } = resolveLeague(member);
    const trophies = resolveTrophies(member);
    const rushValue = resolveRushPercent(member);
    const activity = resolveActivity(member);
    const activityScoreDisplay =
      typeof activity.score === 'number' && Number.isFinite(activity.score)
        ? Math.round(activity.score).toString()
        : '—';
    const vipScore = typeof member.vip?.score === 'number' && Number.isFinite(member.vip.score)
      ? member.vip.score
      : null;
    const activityLabel = activity.evidence?.level || activity.band;
    const roleLabel = role === 'coleader' ? 'Co-leader' : role.charAt(0).toUpperCase() + role.slice(1);
    const leagueBadge = resolveLeagueBadgeText(league, tier);

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
    const overallHeroPercent = totalMaxLevels > 0 ? Math.round((totalLevels / totalMaxLevels) * 100) : null;
    const heroDetail = totalMaxLevels > 0 ? `${totalLevels}/${totalMaxLevels}` : undefined;
    const baseReadiness = typeof rushValue === 'number' ? Math.max(0, 100 - rushValue) : null;
    const baseDetail = typeof rushValue === 'number' ? `Rush ${rushValue.toFixed(1)}%` : undefined;

    const isActionOpen = actionMenuTag === member.tag;

    return (
      <div
        key={member.tag}
        className="group relative rounded-2xl border p-4 transition-transform"
        style={{
          background: surface.card,
          borderColor: surface.border,
          boxShadow: '0 14px 32px -18px rgba(0,0,0,0.7)',
        }}
      >
        {permissions.canModifyClanData ? (
          <div className="absolute right-3 top-3" data-action-menu-root={member.tag}>
            <Tooltip content={<span>More actions</span>}>
              <Spec2IconButton
                ariaLabel="Roster actions"
                active={isActionOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  setActionMenuTag(isActionOpen ? null : member.tag);
                }}
              >
                <MoreHorizontal size={18} />
              </Spec2IconButton>
            </Tooltip>

            {isActionOpen ? (
              <div
                className="absolute right-0 mt-2 w-44 rounded-xl border p-1 text-xs shadow-lg"
                style={{ background: surface.panel, borderColor: surface.border }}
                role="menu"
              >
                <button
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                  style={{ color: text.primary }}
                  onClick={() => {
                    setNotesTarget(member);
                    setActionMenuTag(null);
                  }}
                >
                  Leadership notes
                </button>
                <button
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                  style={{ color: text.primary }}
                  onClick={() => {
                    setTenureTarget(member);
                    setActionMenuTag(null);
                  }}
                >
                  Update tenure
                </button>
                <button
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => {
                    setDepartureTarget(member);
                    setActionMenuTag(null);
                  }}
                >
                  Record departure
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-3">
              <TownHallIcon level={townHall ?? undefined} size="sm" className="-ml-1" />
              {league ? (
                <LeagueIcon
                  league={league}
                  ranked
                  size="xs"
                  className="-ml-0.5"
                  showBadge
                  badgeText={leagueBadge}
                />
              ) : null}
            </div>

            <div>
              <Link
                href={`/new/player/${encodeURIComponent(normalizeTag(member.tag) || member.tag || '')}`}
                className="text-[22px] font-black leading-tight transition-colors"
                style={{ color: text.primary, fontFamily: 'var(--font-display)' }}
                title="View full player profile"
              >
                {member.name || member.tag}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Tooltip content={<span><b>SRS</b>: placeholder roster score (activity/skill). Higher is better.</span>}>
                  <span className="inline-flex"><Chip label={`SRS ${activityScoreDisplay}`} tone="info" /></span>
                </Tooltip>
                {vipScore != null ? (
                  <Tooltip content={<span><b>VIP</b> score: overall contribution (war + support + progression).</span>}>
                    <span className="inline-flex"><Chip label={`VIP ${vipScore.toFixed(1)}`} tone="vip" /></span>
                  </Tooltip>
                ) : null}
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: activity.tone || surface.border }} />
                  {activityLabel}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-10 gap-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>Trophies</span>
            <span className="text-xl font-black tabular-nums" style={{ color: text.primary }}>
              {trophies != null ? trophies.toLocaleString() : '—'}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>Donated</span>
            <span className="text-xl font-black tabular-nums" style={{ color: text.primary }}>
              {member.donations != null ? member.donations.toLocaleString() : '—'}
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <Progress label="Base" value={baseReadiness} detail={baseDetail} tone="primary" />
          <Progress label="Heroes" value={overallHeroPercent} detail={heroDetail} tone="secondary" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {availableHeroes.map((heroKey) => {
            const level = (member as any)[heroKey] || 0;
            const iconSrc = (heroIconMap as any)[heroKey] || '';
            const meta = heroMeta[heroKey] || { name: heroKey.toUpperCase(), gradient: 'linear-gradient(90deg,#38bdf8,#0ea5e9)' };

            return (
              <Tooltip
                key={`${member.tag}-${heroKey}`}
                content={<span><b>{meta.name}</b> {level}</span>}
              >
                <div
                  className="relative h-12 w-12 shrink-0 rounded-xl border"
                  style={{ borderColor: surface.border, background: surface.panel }}
                >
                  {iconSrc ? (
                    <>
                      <Image
                        src={iconSrc}
                        alt={meta.name}
                        fill
                        className="object-contain p-[7px]"
                        sizes="48px"
                      />
                      <div
                        className="absolute bottom-0.5 right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums"
                        style={{
                          background: 'var(--badge-bg, rgba(0,0,0,0.70))',
                          color: 'var(--badge-fg, rgba(255,255,255,0.92))',
                          border: `1px solid ${surface.border}`,
                        }}
                      >
                        {level}
                      </div>
                    </>
                  ) : null}
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFormerCard = (member: FormerMember) => {
    const roleKey = member.lastRole ? normalizeRole(member.lastRole) : null;
    const townHall = typeof member.lastTownHallLevel === 'number' ? member.lastTownHallLevel : null;
    const lastSeenAt = member.departedAt ?? member.updatedAt ?? null;
    const lastSeenDate = lastSeenAt ? new Date(lastSeenAt) : null;
    const safeLastSeen = lastSeenDate && !Number.isNaN(lastSeenDate.getTime()) ? lastSeenDate : null;
    const lastLeague = member.lastRankedLeagueName ?? member.lastLeagueName ?? null;
    const lastTrophies = member.lastRankedTrophies ?? member.lastLeagueTrophies ?? null;
    const tenureDays = typeof member.totalTenureDays === 'number' ? member.totalTenureDays : null;

    return (
      <div
        key={member.tag}
        className="group relative rounded-2xl p-5 transition-all duration-300 hover:scale-[1.015] hover:-translate-y-0.5"
        style={{
          background: surface.card,
          border: `1px solid ${surface.border}`,
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-bold" style={{ color: text.primary }}>{member.name || member.tag}</div>
              <div className="text-xs" style={{ color: text.muted }}>{member.tag}</div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ border: `1px solid ${surface.border}`, color: text.secondary }}
            >
              Former
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs" style={{ color: text.secondary }}>
            {roleKey ? <RoleIcon role={roleKey} size={26} className="shrink-0" /> : null}
            {member.lastRole ? (
              <span style={{ color: text.primary }}>{member.lastRole}</span>
            ) : (
              <span style={{ color: text.muted }}>Role unknown</span>
            )}
            {townHall ? <TownHallIcon level={townHall} size="sm" /> : null}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: text.muted }}>Last Seen</div>
              <div style={{ color: text.primary }}>
                {safeLastSeen ? formatDistanceToNow(safeLastSeen, { addSuffix: true }) : 'Unknown'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: text.muted }}>Total Tenure</div>
              <div style={{ color: text.primary }}>
                {typeof tenureDays === 'number' ? `${tenureDays.toLocaleString()} days` : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: text.muted }}>Last League</div>
              <div style={{ color: text.primary }}>{lastLeague ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: text.muted }}>Last Trophies</div>
              <div style={{ color: text.primary }}>
                {typeof lastTrophies === 'number' ? lastTrophies.toLocaleString() : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <RosterHeader
        clanName={data?.clanName || 'Roster'}
        clanTag={data?.clanTag || null}
        lastUpdated={safeLastUpdated}
        subtitle={updatedLabel}
        clanStats={clanStats || null}
        view="cards"
        onViewChange={onViewChange}
        mode={mode}
        onToggleMode={onToggleMode}
        detailsExtra={
          clanStats ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <MiniStatCard label="Avg VIP" value={clanStats.avgVipScore ?? '—'} icon="⭐" color="#38bdf8" />
              <MiniStatCard label="Avg Hero Power" value={clanStats.avgHeroPower ?? '—'} icon="⚔️" color="#8b5cf6" />
              <MiniStatCard label="Total Donated" value={clanStats.totalDonations ?? '—'} icon="📤" color="#10b981" />
              <MiniStatCard label="Avg Trophies" value={clanStats.avgTrophies ?? '—'} icon="🏆" color="#eab308" />
              <MiniStatCard label="Active" value={`${clanStats.activePercent}%`} icon="📈" color="#22c55e" />
              <MiniStatCard
                label="Top Donator"
                value={clanStats.topDonator.value ?? '—'}
                icon="🥇"
                color="#f472b6"
                subtext={clanStats.topDonator.value != null ? clanStats.topDonator.name.slice(0, 12) : '—'}
              />
              <MiniStatCard
                label="Top VIP"
                value={clanStats.topVip.value ?? '—'}
                icon="👑"
                color="#fbbf24"
                subtext={clanStats.topVip.value != null ? clanStats.topVip.name.slice(0, 12) : '—'}
              />
            </div>
          ) : null
        }
        rightActions={
          <>
            <Tooltip content={<span>Refresh snapshot.</span>}>
              <Button
                tone="primary"
                onClick={() => {
                  void mutate();
                }}
                disabled={isValidating}
                ariaLabel="Refresh snapshot"
              >
                {isValidating ? 'Refreshing…' : 'Refresh'}
              </Button>
            </Tooltip>

            {permissions.canModifyClanData ? (
              <Tooltip
                content={
                  <span>
                    {ingestionJobId ? 'Refresh already running.' : 'Queue a full ingestion run (updates snapshots).'}
                  </span>
                }
              >
                <Button
                  tone="accentAlt"
                  onClick={handleRequestRefresh}
                  disabled={Boolean(ingestionJobId)}
                  ariaLabel={ingestionJobId ? 'Refresh already running' : 'Request refresh'}
                >
                  {ingestionJobId ? (ingestionJobData?.status === 'running' ? 'Refreshing…' : 'Refresh queued') : 'Request refresh'}
                </Button>
              </Tooltip>
            ) : null}

            <Tooltip content={<span>{!permissions.canGenerateCoachingInsights ? 'Permission required.' : 'Generate insights.'}</span>}>
              <Button
                tone="accentAlt"
                onClick={handleGenerateInsights}
                disabled={!permissions.canGenerateCoachingInsights}
                ariaLabel="Generate insights"
              >
                Generate Insights
              </Button>
            </Tooltip>

            <div className="relative" ref={exportRef}>
              <Tooltip
                content={
                  !permissions.canGenerateCoachingInsights
                    ? <span>Permission required.</span>
                    : <span>Export roster.</span>
                }
              >
                <Button
                  tone="ghost"
                  onClick={() => setExportOpen((prev) => !prev)}
                  disabled={!permissions.canGenerateCoachingInsights || !exportRoster}
                  ariaLabel="Export roster"
                >
                  Export
                </Button>
              </Tooltip>

              {exportOpen && (
                <div
                  className="absolute right-0 mt-2 w-44 rounded-xl border p-1 text-xs shadow-lg"
                  style={{ background: surface.panel, borderColor: surface.border }}
                >
                  <button
                    className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                    style={{ color: text.primary }}
                    onClick={() => handleExportAction('csv')}
                  >
                    Export CSV
                  </button>
                  <button
                    className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                    style={{ color: text.primary }}
                    onClick={() => handleExportAction('summary')}
                  >
                    Copy Summary
                  </button>
                  <button
                    className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                    style={{ color: text.primary }}
                    onClick={() => handleExportAction('discord')}
                  >
                    Copy Discord
                  </button>
                </div>
              )}
            </div>
          </>
        }
      />

      <div className={"transition-opacity duration-200 " + (mounted ? "opacity-100" : "opacity-0")}>
        <div className="rounded-2xl border" style={{ background: surface.card, borderColor: surface.border, boxShadow: 'var(--shadow-md)' }}>
        <div
          className="sticky top-2 z-20 border-b backdrop-blur px-4 py-3 flex flex-wrap items-center gap-3"
          style={{ borderColor: surface.border, background: surface.panel }}
        >
          <Input
            value={search}
            onChange={setSearch}
            placeholder="Search players"
            ariaLabel="Search players"
            className="max-w-xs"
          />

          <div
            className="inline-flex rounded-xl border overflow-hidden"
            style={{ borderColor: surface.border, background: surface.panel }}
            role="group"
            aria-label="Roster filter"
          >
            {([
              { key: 'all', label: 'All', active: status === 'all' && !joinerFilter, disabled: false },
              { key: 'current', label: 'Current', active: status === 'current' && !joinerFilter, disabled: false },
              { key: 'former', label: 'Former', active: status === 'former' && !joinerFilter, disabled: false },
              { key: 'new', label: 'New Joiners', active: joinerFilter, disabled: newJoinerCount === 0 },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  if (opt.key === 'new') {
                    toggleJoinerFilter();
                    return;
                  }

                  setStatus(opt.key);
                  const params = new URLSearchParams(searchParams?.toString() ?? '');
                  params.set('status', opt.key);
                  params.delete('filter');
                  const query = params.toString();
                  router.replace(query ? `/new/roster?${query}` : '/new/roster');
                }}
                disabled={opt.disabled}
                className="h-11 px-4 inline-flex items-center gap-2 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: opt.active ? 'rgba(34,211,238,0.18)' : 'transparent',
                  color: opt.active ? 'var(--accent-alt)' : text.secondary,
                  boxShadow: opt.active ? 'inset 0 0 0 1px rgba(34,211,238,0.35)' : undefined,
                }}
                aria-pressed={opt.active}
              >
                <span>{opt.label}</span>
                {opt.key === 'new' && newJoinerCount > 0 ? (
                  <span
                    className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'rgba(167,139,250,0.18)', border: '1px solid rgba(167,139,250,0.26)', color: text.primary }}
                  >
                    {newJoinerCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {activeError ? (
          <div className="p-6 text-sm text-red-300">
            {status === 'former' ? 'Failed to load former members.' : 'Failed to load roster.'}{' '}
            {activeError.message || 'Please try again.'}
          </div>
        ) : null}

      {activeLoading && activeMembers.length === 0 ? (
        <RosterCardsSkeleton />
      ) : null}

      {clanStats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Very Active', value: clanStats.activityCounts?.veryActive ?? 0, color: '#22c55e' },
            { label: 'Active', value: clanStats.activityCounts?.active ?? 0, color: '#38bdf8' },
            { label: 'Moderate', value: clanStats.activityCounts?.moderate ?? 0, color: '#eab308' },
            { label: 'Low', value: clanStats.activityCounts?.low ?? 0, color: '#f97316' },
            { label: 'Inactive', value: clanStats.activityCounts?.inactive ?? 0, color: '#f87171' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border px-4 py-3 text-xs"
              style={{ borderColor: surface.border, background: surface.panel }}
            >
              <div className="uppercase tracking-widest text-[10px]" style={{ color: text.muted }}>{item.label}</div>
              <div className="mt-2 text-2xl font-black" style={{ color: item.color }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

        {!activeLoading && !activeError ? (
          activeMembers.length ? (
            <div className={"grid gap-5 p-4 md:grid-cols-2 xl:grid-cols-3 " + (isValidating ? 'opacity-60 animate-pulse' : '')}>
              {status === 'former'
                ? sortedFormerMembers.map(renderFormerCard)
                : sortedMembers.map(renderMemberCard)}
            </div>
          ) : (
            <div className="p-6 text-sm" style={{ color: text.secondary }}>
              {status === 'former'
                ? 'No former members recorded yet.'
                : 'No roster members match that filter.'}
            </div>
          )
        ) : null}
      </div>

      {notesTarget && resolvedClanTag && (
        <RosterPlayerNotesModal
          playerTag={notesTarget.tag}
          playerName={notesTarget.name || notesTarget.tag}
          clanTag={resolvedClanTag}
          onClose={() => setNotesTarget(null)}
        />
      )}
      {tenureTarget && resolvedClanTag && (
        <RosterPlayerTenureModal
          playerTag={tenureTarget.tag}
          playerName={tenureTarget.name || tenureTarget.tag}
          clanTag={resolvedClanTag}
          onClose={() => setTenureTarget(null)}
        />
      )}
      {departureTarget && resolvedClanTag && (
        <RosterPlayerDepartureModal
          playerTag={departureTarget.tag}
          playerName={departureTarget.name || departureTarget.tag}
          clanTag={resolvedClanTag}
          onClose={() => setDepartureTarget(null)}
        />
      )}
      </div>
    </div>
  );
}
