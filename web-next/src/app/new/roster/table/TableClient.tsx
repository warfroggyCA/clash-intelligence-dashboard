"use client";

import { useEffect, useMemo, useState, useCallback, useRef, useDeferredValue } from 'react';
import type { MouseEvent } from 'react';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';

type PlayerWarMetrics = { 
  warsConsidered: number;
  attacksUsed: number;
  avgStars: number | null;
  avgDestructionPct: number | null;
  tripleRate: number | null;
  lowHitRate: number | null;
};
import Image from 'next/image';
import { Spec2Button as Button, Spec2Input as Input, Spec2IconButton } from '@/components/ui/Spec2Controls';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import LeagueIcon from '@/components/new-ui/icons/LeagueIcon';
import RoleIcon from '@/components/new-ui/icons/RoleIcon';
import CopyableName from '@/components/new-ui/CopyableName';
import { HERO_MAX_LEVELS } from '@/types';
import { heroIconMap } from '@/components/new-ui/icons/maps';
import { useRosterData } from '../useRosterData';
import { apiFetcher } from '@/lib/api/swr-fetcher';
import {
  formatRush,
  normalizeRole,
  resolveActivity,
  resolveLeague,
  resolveLeagueBadgeText,
  resolveRushPercent,
  resolveTownHall,
  resolveTrophies,
  rosterLeagueSort,
  rushTone,
} from '../roster-utils';
import RosterClient from '../RosterClient';
import type { RosterData, RosterMember } from '../types';
import { RosterSkeleton } from '@/components/ui/RosterSkeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import { normalizeTag } from '@/lib/tags';
import { normalizeSearch } from '@/lib/search';
import Link from 'next/link';
import ColumnPickerModal, { type ColumnKey as ModalColumnKey } from './ColumnPickerModal';

const useMountFade = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
};
import { formatDistanceToNow } from 'date-fns';
import { RosterHeader } from '../RosterHeader';
import { MoreHorizontal, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { useLeadership } from '@/hooks/useLeadership';
import { showToast } from '@/lib/toast';
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

const MiniStatCard = ({
  label,
  value,
  icon,
  color = '#fff',
  subtext,
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
      background: surface.panel,
      border: `1px solid ${surface.border}`,
    }}
  >
    <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: text.muted }}>{label}</div>
    <div className="flex items-center gap-1">
      {icon ? <span className="text-lg">{icon}</span> : null}
      <span className="text-2xl font-black" style={{ color, textShadow: `0 0 20px ${color}30` }}>
        {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
      </span>
    </div>
    {subtext ? <div className="text-[10px] mt-0.5" style={{ color: text.muted }}>{subtext}</div> : null}
  </div>
);

// TH distribution bar is shared via RosterHeader

export default function TableClient({
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

  const router = useRouter();
  const searchParams = useSearchParams();

  const urlDensity = searchParams?.get('density');

  const [density, setDensity] = useState<'cozy' | 'compact'>(() => {
    if (urlDensity === 'compact') return 'compact';
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('roster.table.density') : null;
      if (saved === 'compact' || saved === 'cozy') return saved;
    } catch {
      // ignore
    }
    return 'cozy';
  });

  const tablePadY = density === 'compact' ? 'py-1' : 'py-3';
  const tablePadX = 'px-3';

  const tableHeaderBg = mode === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(9,16,31,0.9)';
  const tableHeaderColor = mode === 'light' ? 'rgba(30,58,138,0.78)' : text.muted;
  const tableToolbarMuted = mode === 'light' ? 'rgba(30,58,138,0.72)' : text.secondary;

  const sortGlyph = (key: string) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };
  const headerTextClass = 'text-[11px] font-semibold uppercase tracking-[0.16em]';

  // Keep density in sync with URL changes.
  useEffect(() => {
    setDensity(urlDensity === 'compact' ? 'compact' : 'cozy');
  }, [urlDensity]);

  const { data, members, isLoading, error, isValidating, mutate, clanTag } = useRosterData(initialRoster || undefined);
  const { permissions } = useLeadership();

  const initialQ = searchParams?.get('q') ?? '';
  const [search, setSearch] = useState(() => initialQ);
  const deferredSearch = useDeferredValue(search);
  const normalizedQuery = useMemo(() => normalizeSearch(deferredSearch.trim()), [deferredSearch]);

  type TablePreset = 'default' | 'war' | 'leadership' | 'economy' | 'custom';
  type ColumnKey = ModalColumnKey;

  const presetColumns: Record<Exclude<TablePreset, 'custom'>, ColumnKey[]> = useMemo(
    () => ({
      default: ['th', 'league', 'trophies', 'vip', 'donations', 'rush', 'srs', 'heroes'],
      leadership: ['role', 'th', 'vip', 'donations', 'rush', 'tenure'],
      war: ['th', 'league', 'trophies', 'vip', 'rush', 'heroes', 'war_avg_stars', 'war_triple_rate'],
      economy: ['th', 'league', 'trophies', 'donations', 'vip', 'rush', 'heroes'],
    }),
    [],
  );

  const allColumns: Array<{ key: ColumnKey; label: string; description?: string }> = useMemo(
    () => [
      { key: 'th', label: 'TH' },
      { key: 'league', label: 'League' },
      { key: 'trophies', label: 'Trophies' },
      { key: 'vip', label: 'VIP' },
      { key: 'donations', label: 'Donated' },
      { key: 'rush', label: 'Rush %' },
      { key: 'srs', label: 'SRS' },
      { key: 'heroes', label: 'Heroes %' },
      { key: 'role', label: 'Role' },
      { key: 'tenure', label: 'Tenure' },
      { key: 'war_attacks', label: 'War Attacks', description: 'Attacks used across last 3 regular wars.' },
      { key: 'war_avg_stars', label: 'War Avg Stars', description: 'Average stars across last 3 regular wars.' },
      { key: 'war_triple_rate', label: 'War Triple %', description: '3★ rate across last 3 regular wars.' },
      { key: 'war_low_hit_rate', label: 'War Low-hit %', description: '0–1★ rate across last 3 regular wars.' },
      { key: 'war_avg_destruction', label: 'War Avg Destr %', description: 'Average destruction across last 3 regular wars.' },
    ],
    [],
  );

  // Available columns list is memoized above

  const didHydrateRef = useRef(false);

  const [preset, setPreset] = useState<TablePreset>(() => {
    const urlPreset = searchParams?.get('preset');
    if (urlPreset === 'default' || urlPreset === 'leadership' || urlPreset === 'war' || urlPreset === 'economy' || urlPreset === 'custom') {
      return urlPreset;
    }
    // Back-compat: old links/storage used "compact".
    if (urlPreset === 'compact') return 'default';

    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('roster.table.preset') : null;
      if (saved === 'default' || saved === 'leadership' || saved === 'war' || saved === 'economy' || saved === 'custom') {
        return saved;
      }
      if (saved === 'compact') return 'default';
    } catch {
      // ignore
    }
    return 'default';
  });

  const [sortKey, setSortKey] = useState<
    'league' | 'th' | 'trophies' | 'donations' | 'received' | 'rush' | 'srs' | 'vip' | 'war_attacks' | 'war_avg_stars' | 'war_triple_rate' | 'war_low_hit_rate' | 'war_avg_destruction'
  >(() => {
    const urlSort = searchParams?.get('sort');
    return (urlSort as any) || 'league';
  });

  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    const urlDir = searchParams?.get('dir');
    return urlDir === 'asc' || urlDir === 'desc' ? urlDir : 'desc';
  });

  const [customOpen, setCustomOpen] = useState(false);
  const [customColumns, setCustomColumns] = useState<ColumnKey[]>(presetColumns.default);

  const activeColumns = useMemo<ColumnKey[]>(() => {
    return preset === 'custom' ? customColumns : presetColumns[preset];
  }, [customColumns, preset, presetColumns]);

  // Load custom columns from localStorage once we know which keys are allowed.
  useEffect(() => {
    try {
      const savedCols = window.localStorage.getItem('roster.table.customColumns');
      if (savedCols) {
        const parsed = JSON.parse(savedCols);
        if (Array.isArray(parsed)) {
          const allowed = new Set(allColumns.map((c) => c.key));
          const next = parsed.filter((k) => allowed.has(k));
          if (next.length) setCustomColumns(next);
        }
      }
    } catch {
      // ignore
    } finally {
      didHydrateRef.current = true;
    }
  }, [allColumns]);

  useEffect(() => {
    if (!didHydrateRef.current) return;
    try {
      window.localStorage.setItem('roster.table.preset', preset);
    } catch {
      // ignore
    }

    // Persist preset in URL for shareable links.
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('preset', preset);
    const next = params.toString();
    const current = (searchParams?.toString() ?? '').replace(/^\?/, '');
    if (next !== current) {
      router.replace(next ? `/new/roster?${next}` : '/new/roster');
    }
  }, [preset, router, searchParams]);

  useEffect(() => {
    if (!didHydrateRef.current) return;
    try {
      window.localStorage.setItem('roster.table.density', density);
    } catch {
      // ignore
    }

    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (density === 'compact') params.set('density', 'compact');
    else params.delete('density');

    const next = params.toString();
    const current = (searchParams?.toString() ?? '').replace(/^\?/, '');
    if (next !== current) {
      router.replace(next ? `/new/roster?${next}` : '/new/roster');
    }
  }, [density, router, searchParams]);

  useEffect(() => {
    try {
      window.localStorage.setItem('roster.table.customColumns', JSON.stringify(customColumns));
    } catch {
      // ignore
    }
  }, [customColumns]);
  const [isNarrow, setIsNarrow] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const [viewsOpen, setViewsOpen] = useState(false);
  const viewsRef = useRef<HTMLDivElement | null>(null);
  const [actionMenuTag, setActionMenuTag] = useState<string | null>(null);
  const [notesTarget, setNotesTarget] = useState<RosterMember | null>(null);
  const [tenureTarget, setTenureTarget] = useState<RosterMember | null>(null);
  const [departureTarget, setDepartureTarget] = useState<RosterMember | null>(null);

  useEffect(() => {
    const update = () => setIsNarrow(typeof window !== 'undefined' ? window.innerWidth < 1280 : false);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const exportRoster = useMemo<RosterData | null>(() => {
    if (data) return data;
    if (!members.length) return null;
    return {
      members,
      clanName: 'Roster',
      clanTag: 'UNKNOWN',
      date: null,
    };
  }, [data, members]);

  useEffect(() => {
    if (!exportOpen && !viewsOpen) return;

    const handleClick = (event: globalThis.MouseEvent) => {
      if (exportOpen && exportRef.current && event.target instanceof Node && !exportRef.current.contains(event.target)) {
        setExportOpen(false);
      }
      if (viewsOpen && viewsRef.current && event.target instanceof Node && !viewsRef.current.contains(event.target)) {
        setViewsOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExportOpen(false);
        setViewsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [exportOpen, viewsOpen]);

  useEffect(() => {
    if (!actionMenuTag) return;

    const onClick = (event: globalThis.MouseEvent) => {
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

  const handleCopyTag = useCallback(async (tag: string) => {
    try {
      await navigator.clipboard.writeText(tag);
      showToast(`Copied ${tag}`, 'success');
    } catch {
      showToast('Failed to copy player tag.', 'error');
    }
  }, []);

  // Persist search in URL (shareable + survives refresh)
  useEffect(() => {
    if (!didHydrateRef.current) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    const q = deferredSearch.trim();
    if (q) params.set('q', q);
    else params.delete('q');

    const next = params.toString();
    const current = (searchParams?.toString() ?? '').replace(/^\?/, '');
    if (next !== current) {
      router.replace(next ? `/new/roster?${next}` : '/new/roster');
    }
  }, [deferredSearch, router, searchParams]);

  const filteredMembers = useMemo(() => {
    const query = normalizedQuery;
    if (!query) return members;
    return members.filter((member) => {
      const name = normalizeSearch(member.name || '');
      const tag = normalizeSearch(member.tag || '');
      return name.includes(query) || tag.includes(query);
    });
  }, [members, normalizedQuery]);

  const warKey = useMemo(() => {
    if (!clanTag) return null;
    return `/api/war/player-metrics?clanTag=${encodeURIComponent(clanTag)}&limit=3&warType=regular`;
  }, [clanTag]);

  const { data: warMetricsData, mutate: mutateWarMetrics } = useSWR<
    {
      clanTag: string;
      warType: string;
      limit: number;
      warIds: string[];
      metrics: Record<string, PlayerWarMetrics>;
    }
  >(warKey, apiFetcher, {
    revalidateOnFocus: false,
    revalidateOnMount: true,
    revalidateIfStale: true,
    dedupingInterval: 5_000,
  });

  const warMetrics = useMemo(() => warMetricsData?.metrics ?? {}, [warMetricsData]);

  const sortedMembers = useMemo(() => {
    if (sortKey === 'league') {
      return rosterLeagueSort(filteredMembers);
    }
    const direction = sortDirection === 'asc' ? 1 : -1;
    const valueFor = (member: typeof filteredMembers[number]) => {
      if (sortKey === 'th') return resolveTownHall(member) ?? 0;
      if (sortKey === 'trophies') return resolveTrophies(member) ?? 0;
      if (sortKey === 'donations') return member.donations ?? 0;
      if (sortKey === 'received') return member.donationsReceived ?? 0;
      if (sortKey === 'rush') return resolveRushPercent(member) ?? 0;
      if (sortKey === 'srs') return resolveActivity(member).score ?? 0;
      if (sortKey === 'vip') return member.vip?.score ?? 0;

      const wm = warMetrics[normalizeTag(member.tag) || member.tag || ''];
      if (!wm) return 0;
      if (sortKey === 'war_attacks') return wm.attacksUsed ?? 0;
      if (sortKey === 'war_avg_stars') return wm.avgStars ?? 0;
      if (sortKey === 'war_triple_rate') return wm.tripleRate ?? 0;
      if (sortKey === 'war_low_hit_rate') return wm.lowHitRate ?? 0;
      if (sortKey === 'war_avg_destruction') return wm.avgDestructionPct ?? 0;

      return 0;
    };
    return [...filteredMembers].sort((a, b) => {
      const aValue = valueFor(a);
      const bValue = valueFor(b);
      return (aValue - bValue) * direction;
    });
  }, [filteredMembers, sortDirection, sortKey, warMetrics]);

  const handleSort = (key: typeof sortKey) => {
    let nextKey = sortKey;
    let nextDir: 'asc' | 'desc' = sortDirection;

    if (sortKey === key) {
      nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      nextKey = key;
      nextDir = 'desc';
    }

    setSortKey(nextKey);
    setSortDirection(nextDir);

    // Persist sort in URL for shareable links.
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('sort', String(nextKey));
    params.set('dir', nextDir);
    const query = params.toString();
    router.replace(query ? `/new/roster?${query}` : '/new/roster');
  };

  const handleRowClick = useCallback(
    (event: MouseEvent<HTMLTableRowElement>, tag: string) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('a, button, input, textarea, select, [role="button"], [data-no-row-nav]')) return;
      const normalized = normalizeTag(tag) || tag || '';
      if (!normalized) return;
      router.push(`/new/player/${encodeURIComponent(normalized)}`);
    },
    [router]
  );

  const resolvedClanTag = data?.clanTag || clanTag || '';

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
    let topDonation = { name: '', value: -1 };
    let topVip = { name: '', value: -1 };

    const activityCounts = {
      veryActive: 0,
      active: 0,
      moderate: 0,
      low: 0,
      inactive: 0,
    };
    
      members.forEach((m) => {
        const th = resolveTownHall(m);
        if (th) thDistribution[th] = (thDistribution[th] || 0) + 1;
      heroPowers.push(m.heroPower ?? null);
      donations.push(m.donations ?? null);
      trophies.push(resolveTrophies(m));

      if (typeof m.donations === 'number' && Number.isFinite(m.donations) && m.donations > topDonation.value) {
        topDonation = { name: m.name || m.tag || '—', value: m.donations };
      }

      if (typeof m.vip?.score === 'number' && Number.isFinite(m.vip.score)) {
        vipScores.push(m.vip.score);
        if (m.vip.score > topVip.value) {
          topVip = { name: m.name || m.tag || '—', value: m.vip.score };
        }
      }

      const activity = resolveActivity(m);
      if (activity.level === 'Very Active') activityCounts.veryActive++;
      else if (activity.level === 'Active') activityCounts.active++;
      else if (activity.level === 'Moderate') activityCounts.moderate++;
      else if (activity.level === 'Low') activityCounts.low++;
      else activityCounts.inactive++;
    });
    const totalHeroPower = sumIfComplete(heroPowers);
    const totalDonations = sumIfComplete(donations);
    const totalTrophies = sumIfComplete(trophies);
    const avgVipScore =
      vipScores.length > 0
        ? Math.round((vipScores.reduce((sum, value) => sum + value, 0) / vipScores.length) * 10) / 10
        : null;
    
    const activeCount = activityCounts.veryActive + activityCounts.active;
    const activePercent = Math.round((activeCount / members.length) * 100);

    return {
      memberCount: members.length,
      thDistribution,
      avgHeroPower: totalHeroPower != null ? Math.round(totalHeroPower / members.length) : null,
      totalDonations,
      avgTrophies: totalTrophies != null ? Math.round(totalTrophies / members.length) : null,
      avgVipScore,
      activePercent,
      topDonator: topDonation.value >= 0 ? topDonation : { name: '—', value: null },
      topVip: topVip.value >= 0 ? topVip : { name: '—', value: null },
      activityCounts,
    };
  }, [members]);

  const lastUpdated = data?.snapshotMetadata?.fetchedAt ?? data?.snapshotMetadata?.snapshotDate ?? data?.lastUpdated ?? null;
  const parsedLastUpdated = lastUpdated ? new Date(lastUpdated) : null;
  const safeLastUpdated = parsedLastUpdated && !Number.isNaN(parsedLastUpdated.getTime()) ? parsedLastUpdated : null;

  if (isNarrow) {
    // On narrow viewports, just reuse the card layout to avoid cramped columns.
    return <RosterClient initialRoster={initialRoster} onViewChange={onViewChange} mode={mode} onToggleMode={onToggleMode} />;
  }

  return (
    <div className="space-y-6 overflow-x-hidden">
      <RosterHeader
        clanName={data?.clanName || 'Roster'}
        clanTag={data?.clanTag || null}
        lastUpdated={safeLastUpdated}
        clanStats={clanStats || null}
        view="table"
        onViewChange={onViewChange}
        mode={mode}
        onToggleMode={onToggleMode}
        eyebrow="Players → Roster"
        viewingChipLabel="Viewing as: Guest"
        rightActions={
          <>
            <Tooltip content={<span>{!permissions.canGenerateCoachingInsights ? 'Permission required.' : 'Generate insights.'}</span>}>
              <Button
                tone="primary"
                onClick={handleGenerateInsights}
                disabled={!permissions.canGenerateCoachingInsights}
                aria-label="Generate insights"
                className="px-5 shadow-[0_0_18px_rgba(34,211,238,0.22)]"
              >
                Generate Insights
              </Button>
            </Tooltip>

            <Tooltip content={<span>Refresh snapshot.</span>}>
              <Spec2IconButton
                ariaLabel="Refresh"
                onClick={() => {
                  void mutate();
                  void mutateWarMetrics();
                  showToast('Refreshing snapshot…', 'success');
                }}
                disabled={isValidating}
                className="shadow-[0_8px_20px_rgba(2,6,23,0.35)]"
              >
                <RefreshCw size={18} className={isValidating ? 'animate-spin' : ''} />
              </Spec2IconButton>
            </Tooltip>

            <div className="relative" ref={exportRef}>
              <Tooltip content={<span>More</span>}>
                <Spec2IconButton
                  ariaLabel="More"
                  onClick={() => setExportOpen((prev) => !prev)}
                  className="shadow-[0_8px_20px_rgba(2,6,23,0.35)]"
                >
                  <MoreHorizontal size={18} />
                </Spec2IconButton>
              </Tooltip>

              {exportOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl border p-1 text-xs shadow-lg"
                  style={{ background: surface.card, borderColor: surface.border, boxShadow: 'var(--shadow-md)' }}
                >
                  {permissions.canModifyClanData && data?.clanTag ? (
                    <button
                      className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                      style={{ color: text.primary }}
                      onClick={async () => {
                        try {
                          setExportOpen(false);
                          showToast('Live refresh started…', 'success');
                          const liveKey = `/api/v2/roster?clanTag=${encodeURIComponent(data.clanTag)}&mode=live`;
                          await mutate(apiFetcher(liveKey) as any, { revalidate: false });
                          await mutateWarMetrics();
                          showToast('Live refresh complete.', 'success');
                        } catch (err: any) {
                          showToast(err?.message || 'Live refresh failed.', 'error');
                        }
                      }}
                      disabled={isValidating}
                    >
                      Live Refresh
                    </button>
                  ) : null}

                  {permissions.canModifyClanData && data?.clanTag ? (
                    <div className="my-1 border-t" style={{ borderColor: surface.border }} />
                  ) : null}

                  <button
                    className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                    style={{ color: text.primary }}
                    onClick={() => handleExportAction('csv')}
                    disabled={!permissions.canGenerateCoachingInsights || !exportRoster}
                  >
                    Export CSV
                  </button>
                  <button
                    className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                    style={{ color: text.primary }}
                    onClick={() => handleExportAction('summary')}
                    disabled={!permissions.canGenerateCoachingInsights || !exportRoster}
                  >
                    Copy Summary
                  </button>
                  <button
                    className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                    style={{ color: text.primary }}
                    onClick={() => handleExportAction('discord')}
                    disabled={!permissions.canGenerateCoachingInsights || !exportRoster}
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
        {/* Keep surrounding chrome identical to card view. */}

        <div className="rounded-2xl border overflow-hidden" style={{ background: surface.card, borderColor: surface.border }}>
          <div
            className="border-b px-4 py-3 flex flex-wrap items-center gap-3"
            style={{ borderColor: surface.border, background: surface.panel }}
          >
            <Input
              placeholder="Search players, tags"
              className="max-w-none flex-[1_1_60%] min-w-[320px] md:min-w-[420px]"
              value={search}
              onChange={setSearch}
            />

            <div className="flex flex-1 items-center gap-2 text-xs">
              {/* Left: preset tabs (Spec2) */}
              <div className="hidden md:flex items-center gap-2">
                {([
                  { key: 'default', label: 'Default' },
                  { key: 'war', label: 'War' },
                  { key: 'leadership', label: 'Leadership' },
                  { key: 'economy', label: 'Economy' },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPreset(opt.key)}
                    className="h-11 px-5 rounded-xl border text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors"
                    style={{
                      borderColor: surface.border,
                      background: preset === opt.key ? (mode === 'light' ? 'rgba(14,116,144,0.12)' : 'rgba(255,255,255,0.06)') : surface.card,
                      color: preset === opt.key ? text.primary : tableToolbarMuted,
                      boxShadow: preset === opt.key ? 'inset 0 0 0 1px rgba(34,211,238,0.24), 0 0 14px rgba(34,211,238,0.12)' : undefined,
                    }}
                    aria-pressed={preset === opt.key}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex-1" />

              {/* Right: Columns / Views / Density */}
              <button
                type="button"
                className="h-10 px-4 rounded-xl border text-[11px] font-semibold uppercase tracking-[0.16em] inline-flex items-center gap-2"
                style={{ borderColor: surface.border, background: surface.card, color: tableToolbarMuted }}
                onClick={() => setCustomOpen(true)}
              >
                Columns
              </button>

              <div className="relative" ref={viewsRef}>
                <button
                  type="button"
                  className="h-10 px-4 rounded-xl border text-[11px] font-semibold uppercase tracking-[0.16em] inline-flex items-center gap-2"
                  style={{ borderColor: surface.border, background: viewsOpen ? (mode === 'light' ? 'rgba(14,116,144,0.10)' : 'rgba(255,255,255,0.06)') : surface.card, color: tableToolbarMuted }}
                  onClick={() => setViewsOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={viewsOpen}
                >
                  Views
                </button>

                {viewsOpen ? (
                  <div
                    className="absolute right-0 mt-2 w-64 rounded-xl border p-1 text-xs shadow-lg z-30"
                    style={{ background: surface.card, borderColor: surface.border, boxShadow: 'var(--shadow-md)' }}
                    role="menu"
                  >
                    <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>
                      Quick views
                    </div>

                    {([
                      { key: 'default', label: 'Default (Cozy)', preset: 'default', density: 'cozy' },
                      { key: 'default-compact', label: 'Default (Compact)', preset: 'default', density: 'compact' },
                      { key: 'war', label: 'War (Cozy)', preset: 'war', density: 'cozy' },
                      { key: 'war-compact', label: 'War (Compact)', preset: 'war', density: 'compact' },
                      { key: 'leadership', label: 'Leadership (Cozy)', preset: 'leadership', density: 'cozy' },
                      { key: 'leadership-compact', label: 'Leadership (Compact)', preset: 'leadership', density: 'compact' },
                      { key: 'economy', label: 'Economy (Cozy)', preset: 'economy', density: 'cozy' },
                      { key: 'economy-compact', label: 'Economy (Compact)', preset: 'economy', density: 'compact' },
                    ] as const).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                        style={{
                          color: text.primary,
                          background: preset === item.preset && density === item.density ? (mode === 'light' ? 'rgba(14,116,144,0.10)' : 'rgba(255,255,255,0.06)') : 'transparent',
                        }}
                        onClick={() => {
                          setPreset(item.preset);
                          setDensity(item.density);
                          setViewsOpen(false);
                        }}
                        role="menuitem"
                      >
                        {item.label}
                      </button>
                    ))}

                    <div className="my-1 border-t" style={{ borderColor: surface.border }} />

                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                      style={{ color: text.primary }}
                      onClick={() => {
                        setViewsOpen(false);
                        setPreset('custom');
                        setCustomOpen(true);
                      }}
                      role="menuitem"
                    >
                      Custom columns…
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="inline-flex overflow-hidden rounded-xl border" style={{ borderColor: surface.border, background: surface.card }}>
                {([
                  { key: 'cozy', label: 'Cozy' },
                  { key: 'compact', label: 'Compact' },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDensity(opt.key)}
                    className="h-10 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors"
                    style={{
                      background: density === opt.key ? (mode === 'light' ? 'rgba(14,116,144,0.10)' : 'rgba(255,255,255,0.06)') : 'transparent',
                      color: density === opt.key ? text.primary : tableToolbarMuted,
                    }}
                    aria-pressed={density === opt.key}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {preset === 'custom' ? (
                <Button tone="ghost" className="h-10 px-3" onClick={() => setCustomOpen(true)}>
                  Edit…
                </Button>
              ) : null}
            </div>
          </div>

        {error ? (
          <div className="p-6 text-sm text-red-300">
            Failed to load roster. {error.message || 'Please try again.'}
          </div>
        ) : null}

        {isLoading && (!members.length) ? (
          <RosterSkeleton />
        ) : null}

        <div className="hidden md:block overflow-x-hidden">
          {!isLoading && !error ? (
            filteredMembers.length > 0 ? (
              <div className={"overflow-x-hidden " + (isValidating ? 'opacity-60 animate-pulse' : '')}>
                <table className="w-full table-fixed text-sm" style={{ color: text.primary }}>
                  {(() => {
                    const weight: Record<string, number> = {
                      th: 6,
                      league: 7,
                      trophies: 10,
                      vip: 8,
                      donations: 9,
                      rush: 10,
                      srs: 10,
                      heroes: 10,
                      role: 10,
                      tenure: 12,
                      war_attacks: 9,
                      war_avg_stars: 10,
                      war_triple_rate: 10,
                      war_low_hit_rate: 10,
                      war_avg_destruction: 11,
                    };

                    const player = preset === 'leadership' ? 34 : preset === 'war' ? 36 : 30;
                    const actions = 5;
                    const remaining = 100 - player - actions;
                    const sum = activeColumns.reduce((acc, k) => acc + (weight[k] ?? 8), 0) || 1;
                    const cols = activeColumns.map((k) => {
                      const w = Math.max(6, Math.round((remaining * (weight[k] ?? 8)) / sum));
                      return <col key={`col-${k}`} style={{ width: `${w}%` }} />;
                    });

                    return (
                      <colgroup>
                        <col style={{ width: `${player}%` }} />
                        {cols}
                        <col style={{ width: `${actions}%` }} />
                      </colgroup>
                    );
                  })()}
                  <thead
                    className="sticky top-0 z-10"
                    style={{
                      background: tableHeaderBg,
                      borderBottom: `1px solid ${surface.border}`,
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <tr className={headerTextClass} style={{ color: tableHeaderColor }}>
                      <th
                        className={`${tablePadX} ${tablePadY} text-left sticky z-20`}
                        style={{ left: 0, background: tableHeaderBg }}
                      >
                        Player
                      </th>
                      {activeColumns.map((col) => {
                        if (col === 'role') return <th key={col} className={`${tablePadX} ${tablePadY} text-left`}>Role</th>;
                        if (col === 'tenure')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                              <Tooltip content={<span>Days in clan.</span>}>
                                <span className="inline-flex items-center justify-end gap-1 cursor-help"><span>Tenure</span>{sortGlyph('tenure')}</span>
                              </Tooltip>
                            </th>
                          );
                        if (col === 'heroes')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                              <Tooltip content={<span>Combined hero progress for this Town Hall.</span>}>
                                <span className="inline-flex items-center justify-end gap-1 cursor-help"><span>Heroes</span>{sortGlyph('heroes')}</span>
                              </Tooltip>
                            </th>
                          );

                        if (col === 'war_attacks')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                              <Tooltip content={<span>Attacks used across last 3 regular wars.</span>}>
                                <button type="button" onClick={() => handleSort('war_attacks')} className="inline-flex items-center gap-1 cursor-help">
                                  <span>War Att</span>
                                  {sortGlyph('war_attacks')}
                                </button>
                              </Tooltip>
                            </th>
                          );
                        if (col === 'war_avg_stars')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                              <Tooltip content={<span>Average stars across last 3 regular wars.</span>}>
                                <button type="button" onClick={() => handleSort('war_avg_stars')} className="inline-flex items-center gap-1 cursor-help">
                                  <span>War ★</span>
                                  {sortGlyph('war_avg_stars')}
                                </button>
                              </Tooltip>
                            </th>
                          );
                        if (col === 'war_triple_rate')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                              <Tooltip content={<span>3★ rate across last 3 regular wars.</span>}>
                                <button type="button" onClick={() => handleSort('war_triple_rate')} className="inline-flex items-center gap-1 cursor-help">
                                  <span>War 3★%</span>
                                  {sortGlyph('war_triple_rate')}
                                </button>
                              </Tooltip>
                            </th>
                          );
                        if (col === 'war_low_hit_rate')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                              <Tooltip content={<span>0–1★ rate across last 3 regular wars.</span>}>
                                <button type="button" onClick={() => handleSort('war_low_hit_rate')} className="inline-flex items-center gap-1 cursor-help">
                                  <span>War 0–1★%</span>
                                  {sortGlyph('war_low_hit_rate')}
                                </button>
                              </Tooltip>
                            </th>
                          );
                        if (col === 'war_avg_destruction')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                              <Tooltip content={<span>Average destruction across last 3 regular wars.</span>}>
                                <button type="button" onClick={() => handleSort('war_avg_destruction')} className="inline-flex items-center gap-1 cursor-help">
                                  <span>War %</span>
                                  {sortGlyph('war_avg_destruction')}
                                </button>
                              </Tooltip>
                            </th>
                          );

                        if (col === 'th')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-center`}>
                              <button type="button" onClick={() => handleSort('th')} className="inline-flex items-center gap-1">
                                <span>TH</span> {sortGlyph('th')}
                              </button>
                            </th>
                          );
                        if (col === 'league')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-center`}>
                              <button type="button" onClick={() => handleSort('league')} className="inline-flex items-center gap-1">
                                <span>League</span> {sortGlyph('league')}
                              </button>
                            </th>
                          );
                        if (col === 'trophies')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                              <Tooltip content={<span>Ranked trophies: current season ladder points.</span>}>
                                <button type="button" onClick={() => handleSort('trophies')} className="inline-flex items-center gap-1 cursor-help">
                                  <span>Trophies</span>
                                  {sortGlyph('trophies')}
                                </button>
                              </Tooltip>
                            </th>
                          );
                        if (col === 'vip')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                              <Tooltip content={<span>VIP score: overall contribution rating.</span>}>
                                <button type="button" onClick={() => handleSort('vip')} className="inline-flex items-center gap-1 cursor-help">
                                  <span>VIP</span>
                                  {sortGlyph('vip')}
                                </button>
                              </Tooltip>
                            </th>
                          );
                        if (col === 'donations')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                              <Tooltip content={<span>Season donations given: higher is better.</span>}>
                                <button type="button" onClick={() => handleSort('donations')} className="inline-flex items-center gap-1 cursor-help">
                                  <span>Donated</span>
                                  {sortGlyph('donations')}
                                </button>
                              </Tooltip>
                            </th>
                          );
                        if (col === 'rush')
                          return (
                            <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                              <Tooltip content={<span>Rush %: lower is better (green &lt;10%, yellow 10–20%, red &gt;20%).</span>}>
                                <button type="button" onClick={() => handleSort('rush')} className="inline-flex items-center gap-1 cursor-help">
                                  <span>Rush</span>
                                  {sortGlyph('rush')}
                                </button>
                              </Tooltip>
                            </th>
                          );
                        // srs
                        return (
                          <th key={col} className={`${tablePadX} ${tablePadY} text-right`}>
                            <Tooltip content={<span>SRS: temporary roster score (activity/skill placeholder; real calc forthcoming).</span>}>
                              <button type="button" onClick={() => handleSort('srs')} className="inline-flex items-center gap-1 cursor-help">
                                <span>SRS</span>
                                {sortGlyph('srs')}
                              </button>
                            </Tooltip>
                          </th>
                        );
                      })}
                      <th
                        className={`${tablePadX} ${tablePadY} text-center sticky z-20`}
                        style={{ right: 0, background: tableHeaderBg }}
                      >
                        <Tooltip content={<span>Row actions</span>}>
                          <span className="inline-flex items-center justify-center">
                            <MoreHorizontal size={14} />
                            <span className="sr-only">Actions</span>
                          </span>
                        </Tooltip>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMembers.map((member, idx) => {
                      const role = normalizeRole(member.role);
                      const townHall = resolveTownHall(member);
                      const { league, tier } = resolveLeague(member);
                      const trophies = resolveTrophies(member);
                      const rushValue = resolveRushPercent(member);
                      const activity = resolveActivity(member);
                      const heroCaps = HERO_MAX_LEVELS[townHall ?? 0] || {};
                      const vipScore = typeof member.vip?.score === 'number' && Number.isFinite(member.vip.score)
                        ? member.vip.score
                        : null;
                      const normalizedTag = normalizeTag(member.tag) || member.tag || '';
                      const isActionOpen = actionMenuTag === member.tag;

                      const rowBg = idx % 2 === 0
                        ? (mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.02)')
                        : 'transparent';
                      const rowHover = mode === 'light' ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)';

                      return (
                        <tr
                          key={member.tag}
                          className="group cursor-pointer border-t bg-[var(--row-bg)] transition-colors hover:bg-[var(--row-hover)]"
                          style={{
                            borderColor: surface.border,
                            ['--row-bg' as any]: rowBg,
                            ['--row-hover' as any]: rowHover,
                          }}
                          onClick={(event) => handleRowClick(event, member.tag)}
                          role="link"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              const normalized = normalizeTag(member.tag) || member.tag || '';
                              if (normalized) router.push(`/new/player/${encodeURIComponent(normalized)}`);
                            }
                          }}
                        >
                          <td
                            className={`${tablePadX} ${tablePadY} align-middle sticky z-10`}
                            style={{ left: 0, background: 'var(--row-bg)' }}
                          >
                            <div className="flex items-center gap-3">
                              <RoleIcon role={role} size={22} className="shrink-0" />
                              <div className="flex h-6 flex-1 items-center gap-2 min-w-0">
                                <Link
                                  href={`/new/player/${encodeURIComponent(normalizedTag)}`}
                                  className="flex h-6 max-w-[180px] items-center truncate font-semibold tracking-[0.02em] transition-colors group-hover:underline"
                                  style={{
                                    fontFamily: 'var(--font-display)',
                                    color: text.primary,
                                    textDecorationColor: 'var(--accent-alt)',
                                  }}
                                  aria-label="Open player profile"
                                >
                                  <span className="block leading-[24px] truncate">{member.name || member.tag}</span>
                                </Link>
                                <Tooltip content={<span>{activity.evidence?.level || activity.band}</span>}>
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ background: activity.tone, boxShadow: `0 0 6px ${activity.tone}` }}
                                    aria-label="Activity indicator"
                                  />
                                </Tooltip>
                              </div>
                            </div>
                          </td>
                          {(() => {
                            const tenureDays =
                              typeof (member as any).tenureDays === 'number'
                                ? (member as any).tenureDays
                                : typeof (member as any).tenure_days === 'number'
                                  ? (member as any).tenure_days
                                  : typeof (member as any).tenure === 'number'
                                    ? (member as any).tenure
                                    : null;

                            const heroPct = (() => {
                              const caps = HERO_MAX_LEVELS[townHall ?? 0] || {};
                              const availableHeroes = ['bk', 'aq', 'gw', 'rc', 'mp'].filter((heroKey) => ((caps as any)[heroKey] || 0) > 0);
                              let totalLevels = 0;
                              let totalMax = 0;
                              for (const heroKey of availableHeroes) {
                                totalLevels += (member as any)[heroKey] || 0;
                                totalMax += (caps as any)[heroKey] || 0;
                              }
                              if (!totalMax) return null;
                              return Math.round((totalLevels / totalMax) * 100);
                            })();

                            return (
                              <>
                                {activeColumns.map((col) => {
                                  if (col === 'role') {
                                    return (
                                      <td key={col} className={`${tablePadX} ${tablePadY} text-left align-middle`} style={{ color: text.secondary }}>
                                        {role}
                                      </td>
                                    );
                                  }

                                  if (col === 'th') {
                                    return (
                                      <td key={col} className={`${tablePadX} ${tablePadY} text-center align-middle`}>
                                        <TownHallIcon level={townHall ?? undefined} size="sm" showBadge />
                                      </td>
                                    );
                                  }

                                  if (col === 'league') {
                                    const label = league ? `League: ${league}${tier ? ` ${tier}` : ''}` : 'League unknown';
                                    const badgeText = resolveLeagueBadgeText(league, tier);
                                    return (
                                      <td key={col} className={`${tablePadX} ${tablePadY} text-center align-middle`}>
                                        <Tooltip content={<span>{label}</span>}>
                                          <span className="inline-flex">
                                            <LeagueIcon league={league} ranked size="xs" badgeText={badgeText} showBadge />
                                          </span>
                                        </Tooltip>
                                      </td>
                                    );
                                  }

                                  if (col === 'trophies') {
                                    return (
                                      <td
                                        key={col}
                                        className={`${tablePadX} ${tablePadY} font-bold text-right tabular-nums align-middle`}
                                        style={{ color: text.primary }}
                                      >
                                        {trophies != null ? trophies.toLocaleString() : '—'}
                                      </td>
                                    );
                                  }

                                  if (col === 'vip') {
                                    return (
                                      <td
                                        key={col}
                                        className={`${tablePadX} ${tablePadY} text-right tabular-nums font-bold align-middle`}
                                        style={{ color: '#38bdf8' }}
                                      >
                                        {vipScore != null ? vipScore.toFixed(1) : '—'}
                                      </td>
                                    );
                                  }

                                  if (col === 'donations') {
                                    return (
                                      <td
                                        key={col}
                                        className={`${tablePadX} ${tablePadY} text-right tabular-nums font-bold align-middle`}
                                        style={{ color: text.primary }}
                                      >
                                        {member.donations != null ? member.donations.toLocaleString() : '—'}
                                      </td>
                                    );
                                  }

                                  if (col === 'rush') {
                                    return (
                                      <td
                                        key={col}
                                        className={`${tablePadX} ${tablePadY} font-bold text-right tabular-nums align-middle`}
                                        style={{ color: rushTone(rushValue) }}
                                      >
                                        {formatRush(rushValue)}
                                      </td>
                                    );
                                  }

                                  if (col === 'srs') {
                                    return (
                                      <td
                                        key={col}
                                        className={`${tablePadX} ${tablePadY} font-bold text-right tabular-nums align-middle`}
                                        style={{ color: '#a78bfa' }}
                                      >
                                        {typeof activity.score === 'number' ? Math.round(activity.score) : '—'}
                                      </td>
                                    );
                                  }

                                  if (col === 'tenure') {
                                    return (
                                      <td key={col} className={`${tablePadX} ${tablePadY} text-right tabular-nums font-bold align-middle`} style={{ color: text.primary }}>
                                        {typeof tenureDays === 'number' ? `${tenureDays}d` : '—'}
                                      </td>
                                    );
                                  }

                                  const wm = warMetrics[normalizeTag(member.tag) || member.tag || ''];
                                  if (col === 'war_attacks') {
                                    return (
                                      <td key={col} className={`${tablePadX} ${tablePadY} text-right tabular-nums font-bold align-middle`}>
                                        {wm?.attacksUsed != null ? wm.attacksUsed : '—'}
                                      </td>
                                    );
                                  }
                                  if (col === 'war_avg_stars') {
                                    return (
                                      <td key={col} className={`${tablePadX} ${tablePadY} text-right tabular-nums font-bold align-middle`} style={{ color: '#fbbf24' }}>
                                        {wm?.avgStars != null ? wm.avgStars.toFixed(2) : '—'}
                                      </td>
                                    );
                                  }
                                  if (col === 'war_triple_rate') {
                                    return (
                                      <td key={col} className={`${tablePadX} ${tablePadY} text-right tabular-nums font-bold align-middle`}>
                                        {wm?.tripleRate != null ? `${Math.round(wm.tripleRate * 100)}%` : '—'}
                                      </td>
                                    );
                                  }
                                  if (col === 'war_low_hit_rate') {
                                    return (
                                      <td key={col} className={`${tablePadX} ${tablePadY} text-right tabular-nums font-bold align-middle`}>
                                        {wm?.lowHitRate != null ? `${Math.round(wm.lowHitRate * 100)}%` : '—'}
                                      </td>
                                    );
                                  }
                                  if (col === 'war_avg_destruction') {
                                    return (
                                      <td key={col} className={`${tablePadX} ${tablePadY} text-right tabular-nums font-bold align-middle`}>
                                        {wm?.avgDestructionPct != null ? `${wm.avgDestructionPct.toFixed(1)}%` : '—'}
                                      </td>
                                    );
                                  }

                                  // heroes
                                  return (
                                    <td
                                      key={col}
                                      className={`${tablePadX} ${tablePadY} font-bold text-right tabular-nums align-middle`}
                                    >
                                      {heroPct != null ? `${heroPct}%` : '—'}
                                    </td>
                                  );
                                })}
                                <td
                                  className={`${tablePadX} ${tablePadY} text-right align-middle sticky z-10 relative`}
                                  style={{ right: 0, background: 'var(--row-bg)' }}
                                  data-action-menu-root={member.tag}
                                >
                                  <Tooltip content={<span>Row actions</span>}>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setActionMenuTag(isActionOpen ? null : member.tag);
                                      }}
                                      className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border transition-opacity ${isActionOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
                                      style={{
                                        background: mode === 'light' ? 'rgba(30,58,138,0.06)' : 'rgba(255,255,255,0.04)',
                                        borderColor: surface.border,
                                        color: text.secondary,
                                      }}
                                      aria-label="Row actions"
                                      aria-haspopup="menu"
                                      aria-expanded={isActionOpen}
                                      data-no-row-nav
                                    >
                                      <MoreHorizontal size={16} />
                                    </button>
                                  </Tooltip>
                                  {isActionOpen ? (
                                    <div
                                      className="absolute right-0 top-full mt-2 w-44 rounded-xl border p-1 text-xs shadow-lg z-30"
                                      style={{ background: surface.panel, borderColor: surface.border }}
                                      role="menu"
                                    >
                                      <button
                                        className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                                        style={{ color: text.primary }}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setActionMenuTag(null);
                                          if (normalizedTag) router.push(`/new/player/${encodeURIComponent(normalizedTag)}`);
                                        }}
                                        role="menuitem"
                                      >
                                        Open profile
                                      </button>
                                      <button
                                        className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                                        style={{ color: text.primary }}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setActionMenuTag(null);
                                          void handleCopyTag(member.tag);
                                        }}
                                        role="menuitem"
                                      >
                                        Copy player tag
                                      </button>

                                      {permissions.canModifyClanData ? (
                                        <>
                                          <div className="my-1 border-t" style={{ borderColor: surface.border }} />
                                          <button
                                            className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                                            style={{ color: text.primary }}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setNotesTarget(member);
                                              setActionMenuTag(null);
                                            }}
                                            role="menuitem"
                                          >
                                            Leadership notes
                                          </button>
                                          <button
                                            className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                                            style={{ color: text.primary }}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setTenureTarget(member);
                                              setActionMenuTag(null);
                                            }}
                                            role="menuitem"
                                          >
                                            Update tenure
                                          </button>
                                          <button
                                            className="w-full rounded-lg px-3 py-2 text-left transition-colors"
                                            style={{ color: 'var(--danger)' }}
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setDepartureTarget(member);
                                              setActionMenuTag(null);
                                            }}
                                            role="menuitem"
                                          >
                                            Record departure
                                          </button>
                                        </>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </td>
                              </>
                            );
                          })()}
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-sm" style={{ color: text.secondary }}>No roster members match that filter.</div>
            )
          ) : null}
        </div>
      </div>
      </div>

      {clanStats ? (
        <details className="rounded-2xl border overflow-hidden" style={{ borderColor: surface.border, background: surface.card }}>
          <summary className="list-none cursor-pointer select-none">
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ background: surface.panel, borderBottom: `1px solid ${surface.border}` }}
            >
              <div>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: text.muted }}>
                  Clan snapshot
                </div>
                <div className="text-sm font-semibold" style={{ color: text.primary }}>
                  Stats
                </div>
              </div>
              <div className="text-xs" style={{ color: text.muted }}>Expand</div>
            </div>
          </summary>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-3">
              <MiniStatCard label="Members" value={clanStats.memberCount} icon="👥" color="#f59e0b" />
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
          </div>
        </details>
      ) : null}

      {notesTarget && resolvedClanTag ? (
        <RosterPlayerNotesModal
          playerTag={notesTarget.tag}
          playerName={notesTarget.name || notesTarget.tag}
          clanTag={resolvedClanTag}
          onClose={() => setNotesTarget(null)}
        />
      ) : null}
      {tenureTarget && resolvedClanTag ? (
        <RosterPlayerTenureModal
          playerTag={tenureTarget.tag}
          playerName={tenureTarget.name || tenureTarget.tag}
          clanTag={resolvedClanTag}
          onClose={() => setTenureTarget(null)}
        />
      ) : null}
      {departureTarget && resolvedClanTag ? (
        <RosterPlayerDepartureModal
          playerTag={departureTarget.tag}
          playerName={departureTarget.name || departureTarget.tag}
          clanTag={resolvedClanTag}
          onClose={() => setDepartureTarget(null)}
        />
      ) : null}

      <ColumnPickerModal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        allColumns={allColumns}
        value={customColumns}
        onChange={(next) => {
          setCustomColumns(next);
          setPreset('custom');
        }}
      />
    </div>
  );
}
