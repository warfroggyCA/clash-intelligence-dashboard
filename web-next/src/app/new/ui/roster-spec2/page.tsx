"use client";

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { tokens } from '@/lib/tokens';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import LeagueIcon from '@/components/new-ui/icons/LeagueIcon';
import Image from 'next/image';
import { heroIconMap } from '@/components/new-ui/icons/maps';
import { Tooltip, type TooltipTheme } from '@/components/ui/Tooltip';
import { Info, LayoutGrid, Table2, RefreshCw, MoreHorizontal, Sun, Moon, Image as ImageIcon, Ellipsis, ChevronDown, ChevronUp } from 'lucide-react';

type View = 'cards' | 'table';

type ActivityBucket = 'very_active' | 'active' | 'moderate' | 'low' | 'inactive';
type SortKey = 'name' | 'vip' | 'trophies' | 'base' | 'heroes';

type Player = {
  tag: string;
  name: string;
  role: 'leader' | 'coleader' | 'elder' | 'member';
  th: number;
  league: string;
  trophies: number;
  donated: number;
  vip: number;
  srs: number;
  basePct: number | null;
  baseDetail?: string;
  heroesPct: number | null;
  heroesDetail?: string;
  activity: ActivityBucket;
  tenureDays: number;
  heroes: Array<{ key: string; level: number }>;
};

const fakeNames = [
  'Arrowflux',
  'Blitzpaw',
  'Cinderlynx',
  'Driftforge',
  'Embervale',
  'Frostbyte',
  'Gildhawk',
  'Hexwell',
  'Ironlark',
  'Jadecoil',
  'Kestrel',
  'Lumen',
  'Mistral',
  'Nightjar',
  'Onyx',
  'Palisade',
  'Quicksand',
  'Rook',
  'Solaris',
  'Tempest',
  'Umber',
  'Vanta',
  'Whisper',
  'Xylo',
  'Yonder',
  'Zephyr',
  'Ashen',
  'Bastion',
  'Cipher',
  'Dynamo',
  'Echo',
  'Falcon',
  'Glint',
  'Havoc',
  'Ion',
  'Jolt',
  'Karma',
  'Lattice',
  'Mosaic',
  'Nimbus',
  'Obsidian',
  'Pulse',
  'Quasar',
  'Rift',
  'Signal',
  'Talon',
  'Ultraviolet',
  'Vesper',
  'Warden',
  'Zenith',
];

const fakeLeagues = [
  'Bronze League III',
  'Bronze League I',
  'Silver League III',
  'Silver League I',
  'Gold League III',
  'Gold League I',
  'Crystal League III',
  'Crystal League I',
  'Master League III',
  'Master League I',
  'Champion League III',
  'Champion League I',
  'Titan League III',
  'Titan League I',
  'Legend League',
];

const fakeRoles: Player['role'][] = ['member', 'member', 'member', 'elder', 'coleader', 'leader'];
const fakeActivity: ActivityBucket[] = ['very_active', 'active', 'moderate', 'low', 'inactive'];
const heroKeys = ['BK', 'AQ', 'GW', 'RC', 'MP'] as const;

function createFakePlayers(count: number, startIndex = 1): Player[] {
  const players: Player[] = [];
  const basePctValues: Array<number | null> = [null, 12, 20, 28, 35, 48, 62, 74];
  const heroesPctValues: Array<number | null> = [null, 52, 64, 78, 86, 92, 97];

  for (let i = 0; i < count; i += 1) {
    const idx = i + startIndex;
    const nameBase = fakeNames[idx % fakeNames.length];
    const nameSuffix = idx % 4 === 0 ? ` ${idx}` : '';
    const th = 10 + (idx % 8);
    const league = fakeLeagues[idx % fakeLeagues.length];
    const trophies = 180 + ((idx * 37) % 420);
    const donated = (idx * 23) % 220;
    const vip = Number((45 + ((idx * 3.7) % 55)).toFixed(1));
    const srs = 25 + ((idx * 5) % 60);
    const basePct = basePctValues[idx % basePctValues.length];
    const baseDetail = basePct == null ? 'not tracked' : `${Math.floor((basePct / 100) * 520)}/520`;
    const heroesPct = heroesPctValues[(idx + 2) % heroesPctValues.length];
    const heroesDetail = heroesPct == null ? 'not tracked' : `${Math.floor((heroesPct / 100) * 334)}/334`;
    const activity = fakeActivity[idx % fakeActivity.length];
    const tenureDays = 3 + ((idx * 9) % 520);
    const heroCount = idx % 3 === 0 ? 5 : 4;
    const heroes = heroKeys.slice(0, heroCount).map((key, k) => ({
      key,
      level: Math.max(10, Math.min(95, (th * 5) + ((idx * 2 + k * 3) % 20))),
    }));

    players.push({
      tag: `#FAKE${String(idx).padStart(3, '0')}`,
      name: `${nameBase}${nameSuffix}`,
      role: fakeRoles[idx % fakeRoles.length],
      th,
      league,
      trophies,
      donated,
      vip,
      srs,
      basePct,
      baseDetail,
      heroesPct,
      heroesDetail,
      activity,
      tenureDays,
      heroes,
    });
  }

  return players;
}

const surface = {
  bg: 'var(--bg)',
  panel: 'var(--panel)',
  card: 'var(--card)',
  border: 'var(--border-subtle)',
};

const text = {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
};

function Chip({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger' | 'vip' }) {
  const style = useMemo(() => {
    const map: Record<string, { bg: string; fg: string; border: string }> = {
      muted: { bg: 'transparent', fg: text.secondary, border: 'var(--border-subtle)' },
      primary: { bg: tokens.colors.accentAlt, fg: '#0b1220', border: 'transparent' },
      secondary: { bg: tokens.colors.accent, fg: '#0b1220', border: 'transparent' },
      info: { bg: 'rgba(96,165,250,0.18)', fg: text.primary, border: 'rgba(96,165,250,0.26)' },
      success: { bg: 'rgba(52,211,153,0.18)', fg: text.primary, border: 'rgba(52,211,153,0.26)' },
      warning: { bg: 'rgba(251,191,36,0.18)', fg: text.primary, border: 'rgba(251,191,36,0.26)' },
      danger: { bg: 'rgba(251,113,133,0.18)', fg: text.primary, border: 'rgba(251,113,133,0.26)' },
      vip: { bg: 'rgba(167,139,250,0.18)', fg: text.primary, border: 'rgba(167,139,250,0.26)' },
    };
    return map[tone] ?? map.muted;
  }, [tone]);

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tabular-nums"
      style={{ background: style.bg, color: style.fg, border: `1px solid ${style.border}` }}
    >
      {label}
    </span>
  );
}

function Button({
  children,
  tone = 'primary',
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  tone?: 'primary' | 'secondary' | 'ghost';
  onClick?: () => void;
  disabled?: boolean;
}) {
  const style = useMemo(() => {
    if (tone === 'primary') {
      return { bg: tokens.colors.accentAlt, fg: '#0b1220', border: 'transparent' };
    }
    if (tone === 'secondary') {
      return { bg: tokens.colors.accent, fg: '#0b1220', border: 'transparent' };
    }
    return { bg: 'transparent', fg: text.primary, border: 'var(--border-subtle)' };
  }, [tone]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-11 rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      style={{ background: style.bg, color: style.fg, border: `1px solid ${style.border}` }}
    >
      {children}
    </button>
  );
}

function Segmented({
  value,
  onChange,
  mode,
  tooltipTheme,
  tooltipMaxWidth = 260,
  tooltipOffset = 10,
}: {
  value: View;
  onChange: (v: View) => void;
  mode: 'dark' | 'light';
  tooltipTheme?: TooltipTheme;
  tooltipMaxWidth?: number;
  tooltipOffset?: number;
}) {
  return (
    <div
      className="inline-flex rounded-xl border overflow-hidden"
      style={{ borderColor: surface.border, background: 'rgba(0,0,0,0.2)' }}
      role="group"
      aria-label="View"
    >
      {([
        { key: 'cards', label: 'Cards', Icon: LayoutGrid },
        { key: 'table', label: 'Table', Icon: Table2 },
      ] as const).map((opt) => (
        <Tooltip
          key={opt.key}
          content={<span>{opt.label} view</span>}
          maxWidthPx={tooltipMaxWidth}
          offsetPx={tooltipOffset}
          theme={tooltipTheme}
        >
          <button
            type="button"
            onClick={() => onChange(opt.key)}
            className="h-11 w-11 inline-flex items-center justify-center"
            style={{
              background:
                value === opt.key
                  ? mode === 'dark'
                    ? 'rgba(34,211,238,0.18)'
                    : '#0E7490'
                  : 'transparent',
              color:
                value === opt.key
                  ? mode === 'dark'
                    ? tokens.colors.accentAlt
                    : '#ffffff'
                  : text.secondary,
              boxShadow:
                value === opt.key
                  ? mode === 'dark'
                    ? 'inset 0 0 0 1px rgba(34,211,238,0.35)'
                    : 'inset 0 0 0 1px rgba(14,116,144,0.65)'
                  : undefined,
            }}
            aria-pressed={value === opt.key}
            aria-label={opt.label}
          >
            <opt.Icon size={18} />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

function Tile({ label, value, tone = 'muted', sub }: { label: string; value: string; tone?: 'muted' | 'primary' | 'secondary' | 'vip'; sub?: string }) {
  const vColor =
    tone === 'primary'
      ? tokens.colors.accentAlt
      : tone === 'secondary'
        ? tokens.colors.accent
        : tone === 'vip'
          ? 'var(--accent-vip)'
          : text.primary;

  return (
    <div
      className="min-w-[150px] h-[72px] rounded-2xl border px-4 py-3 flex flex-col justify-between"
      style={{ background: surface.card, borderColor: surface.border, boxShadow: 'var(--shadow-md)' }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>
        {label}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="text-2xl font-black tabular-nums leading-none" style={{ color: vColor }}>
          {value}
        </div>
        {/* Reserve a line for subtext so all tiles have equal height */}
        <div className="text-[11px] leading-tight text-right" style={{ color: text.secondary, minHeight: 14 }}>
          {sub ?? ''}
        </div>
      </div>
    </div>
  );
}

function Progress({
  label,
  value,
  detail,
  tone = 'primary',
  tooltipTheme,
  tooltipMaxWidth = 260,
  tooltipMinWidth = 0,
  tooltipOffset = 10,
}: {
  label: string;
  value: number | null;
  detail?: string;
  tone?: 'primary' | 'secondary';
  tooltipTheme?: TooltipTheme;
  tooltipMaxWidth?: number;
  tooltipMinWidth?: number;
  tooltipOffset?: number;
}) {
  const pct = value == null ? null : Math.max(0, Math.min(100, value));
  const tooltip = detail && pct != null ? (
    <div>
      <div className="font-semibold" style={{ color: text.primary }}>{label}</div>
      <div style={{ color: text.secondary }}>{detail} · {pct}%</div>
    </div>
  ) : detail ? (
    <div>
      <div className="font-semibold" style={{ color: text.primary }}>{label}</div>
      <div style={{ color: text.secondary }}>{detail}</div>
    </div>
  ) : null;

  const trackBg = 'var(--progress-track)';
  const barColor = tone === 'secondary' ? 'var(--progress-secondary)' : tokens.colors.accentAlt;
  const barHeight = tone === 'secondary' ? 'h-1.5' : 'h-2';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: text.secondary }}>
        <span className="inline-flex items-center gap-1">
          {tooltip ? (
            <Tooltip
              content={tooltip}
              maxWidthPx={tooltipMaxWidth}
              minWidthPx={tooltipMinWidth}
              offsetPx={tooltipOffset}
              theme={tooltipTheme}
            >
              <span className="uppercase tracking-[0.16em] cursor-help">{label}</span>
            </Tooltip>
          ) : (
            <span className="uppercase tracking-[0.16em]">{label}</span>
          )}
        </span>

        <span className="tabular-nums" style={{ color: text.primary }}>
          {pct == null ? '—' : `${pct}%`}
        </span>
      </div>

      <div className={`${barHeight} rounded-full`} style={{ background: trackBg }}>
        <div
          className="h-full rounded-full"
          style={{ width: pct == null ? '0%' : `${pct}%`, background: barColor, opacity: pct == null ? 0 : 1 }}
        />
      </div>
    </div>
  );
}

function activityTone(bucket: ActivityBucket): 'success' | 'info' | 'warning' | 'danger' {
  if (bucket === 'very_active') return 'success';
  if (bucket === 'active') return 'info';
  if (bucket === 'moderate') return 'warning';
  return 'danger';
}

function activityAccent(bucket: ActivityBucket) {
  const tone = activityTone(bucket);
  if (tone === 'success') return '#34D399';
  if (tone === 'info') return '#60A5FA';
  if (tone === 'warning') return '#FBBF24';
  return '#FB7185';
}

function leagueBadgeText(league: string) {
  const m = /\b([IV]{1,3})\b/.exec(league);
  if (m?.[1]) return m[1];
  const lower = league.toLowerCase();
  if (lower.includes('legend')) return 'L';
  if (lower.includes('titan')) return 'T';
  if (lower.includes('champion')) return 'C';
  if (lower.includes('master')) return 'M';
  if (lower.includes('crystal')) return 'CR';
  if (lower.includes('gold')) return 'G';
  if (lower.includes('silver')) return 'S';
  if (lower.includes('bronze')) return 'B';
  return undefined;
}

export default function RosterSpecPage() {
  const [mode, setMode] = useState<'dark' | 'light'>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('ui.rosterSpec.mode') : null;
      return saved === 'light' || saved === 'dark' ? saved : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [assetsOn, setAssetsOn] = useState(true);

  // Spec-only: pretend we are signed in as this tag, so we can validate the "highlight me" treatment.
  const currentUserTag = '#WARFROGGY';
  const viewStorageKey = 'ui.rosterSpec.view';
  const [view, setView] = useState<View>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.sessionStorage.getItem(viewStorageKey) : null;
      return saved === 'table' || saved === 'cards' ? saved : 'cards';
    } catch {
      return 'cards';
    }
  });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'current' | 'former' | 'new'>('all');
  const [tablePreset, setTablePreset] = useState<'default' | 'war' | 'leadership' | 'economy'>('default');
  const [tableDensity, setTableDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sortMode, setSortMode] = useState<'default' | 'custom'>('default');
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'vip', direction: 'desc' });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshDot, setShowRefreshDot] = useState(false);
  const [morePulse, setMorePulse] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem('ui.rosterSpec.mode', mode);
    } catch {
      // ignore
    }
  }, [mode]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(viewStorageKey, view);
    } catch {
      // ignore
    }
  }, [view, viewStorageKey]);

  const themeVars = useMemo<React.CSSProperties>(() => {
    if (mode === 'light') {
      return {
        // Surfaces
        ['--bg' as any]: '#F6F8FC',
        // Light mode surfaces: slightly cooler so ink doesn't feel harsh
        ['--panel' as any]: '#EEF4FF',
        ['--card' as any]: '#FBFDFF',
        ['--input' as any]: '#FFFFFF',
        ['--border-subtle' as any]: 'rgba(15,23,42,0.10)',

        // Text
        // Light mode: use "navy ink" (avoid harsh black)
        // Push primary text slightly bluer (less "black", more "ink")
        ['--text-primary' as any]: 'rgba(30,58,138,0.92)',
        ['--text-secondary' as any]: 'rgba(30,58,138,0.76)',
        ['--text-muted' as any]: 'rgba(30,58,138,0.62)',

        // Badges (hero levels etc.)
        ['--badge-bg' as any]: 'rgba(255,255,255,0.95)',
        ['--badge-fg' as any]: 'var(--text-primary)',

        // Accents
        ['--accent-vip' as any]: '#6D28D9',
        ['--ring-user' as any]: 'rgba(14,116,144,0.60)',
        ['--glow-user' as any]: 'rgba(14,116,144,0.22)',

        // Elevation
        ['--shadow-md' as any]: '0 10px 26px rgba(15,23,42,0.10)',

        // Progress
        ['--progress-track' as any]: 'rgba(15,23,42,0.10)',
        // Use the same hue family as the primary bar, but softer.
        ['--progress-secondary' as any]: 'rgba(34,211,238,0.55)',

        // Tooltip
        ['--tooltip-border' as any]: 'rgba(15,23,42,0.10)',
        ['--tooltip-shadow' as any]: 'var(--shadow-md)',

        background: 'var(--bg)',
        color: 'var(--text-primary)',
      };
    }

    return {
      ['--bg' as any]: '#0B1220',
      ['--panel' as any]: '#121F38',
      ['--card' as any]: '#142242',
      ['--input' as any]: '#0F1A2E',
      ['--border-subtle' as any]: 'rgba(255,255,255,0.08)',

      ['--text-primary' as any]: 'rgba(255,255,255,0.92)',
      ['--text-secondary' as any]: 'rgba(255,255,255,0.72)',
      ['--text-muted' as any]: 'rgba(255,255,255,0.56)',

      // Badges (hero levels etc.)
      ['--badge-bg' as any]: 'rgba(0,0,0,0.85)',
      ['--badge-fg' as any]: 'rgba(255,255,255,0.92)',

      // Accents
      ['--accent-vip' as any]: '#A78BFA',
      ['--ring-user' as any]: 'rgba(34,211,238,0.55)',
      ['--glow-user' as any]: 'rgba(34,211,238,0.38)',

      // Elevation (dark mode: borders/overlays do most of the work)
      ['--shadow-md' as any]: 'none',

      // Progress
      ['--progress-track' as any]: 'rgba(255,255,255,0.10)',
      // Use the same hue family as the primary bar, but softer.
      ['--progress-secondary' as any]: 'rgba(34,211,238,0.55)',

      // Tooltip (dark mode: border-led separation)
      ['--tooltip-border' as any]: 'rgba(255,255,255,0.14)',
      ['--tooltip-shadow' as any]: '0 0 0 1px rgba(255,255,255,0.06)',

      background: 'var(--bg)',
      color: 'var(--text-primary)',
    };
  }, [mode]);

  const tooltipTheme = useMemo<TooltipTheme>(() => {
    if (mode === 'light') {
      return {
        background: '#1E2A44',
        borderColor: 'rgba(30,58,138,0.45)',
        color: 'rgba(248,250,255,0.96)',
        boxShadow: '0 16px 30px rgba(15,23,42,0.28)',
      };
    }
    return {
      background: '#142242',
      borderColor: 'rgba(255,255,255,0.14)',
      color: 'rgba(255,255,255,0.92)',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
    };
  }, [mode]);

  const tooltipMaxWidth = 280;
  const tooltipMinWidth = 180;
  const tooltipOffset = 10;
  const tooltipTightOffset = 12;

  const players: Player[] = useMemo(() => {
    const core: Player[] = [
      {
        tag: '#WARFROGGY',
        name: 'warfroggy',
        role: 'member',
        th: 15,
        league: 'Titan League II',
        trophies: 368,
        donated: 66,
        vip: 77.4,
        srs: 41,
        basePct: 15,
        baseDetail: '78/520',
        heroesPct: 96,
        heroesDetail: '320/334',
        activity: 'active',
        tenureDays: 32,
        heroes: [
          { key: 'BK', level: 80 },
          { key: 'AQ', level: 80 },
          { key: 'GW', level: 55 },
          { key: 'RC', level: 30 },
          { key: 'MP', level: 80 },
        ],
      },
      {
        tag: '#OZY',
        name: 'Ozymandias',
        role: 'member',
        th: 12,
        league: 'Crystal League I',
        trophies: 297,
        donated: 132,
        vip: 66.3,
        srs: 34,
        basePct: 35,
        baseDetail: '180/520',
        heroesPct: 66,
        heroesDetail: '210/320',
        activity: 'low',
        tenureDays: 5,
        heroes: [
          { key: 'BK', level: 45 },
          { key: 'AQ', level: 45 },
          { key: 'GW', level: 20 },
          { key: 'MP', level: 40 },
        ],
      },
      {
        tag: '#GOD',
        name: 'God Of LOYINs',
        role: 'leader',
        th: 15,
        league: 'Legend League',
        trophies: 15,
        donated: 0,
        vip: 80.4,
        srs: 26,
        basePct: null,
        baseDetail: 'not tracked',
        heroesPct: 84,
        heroesDetail: '280/334',
        activity: 'moderate',
        tenureDays: 180,
        heroes: [
          { key: 'BK', level: 80 },
          { key: 'AQ', level: 80 },
          { key: 'GW', level: 55 },
          { key: 'RC', level: 30 },
          { key: 'MP', level: 80 },
        ],
      },
    ];

    const extras = createFakePlayers(47, 1);
    return [...core, ...extras];
  }, []);

  const memberCount = players.length;
  const maxTh = Math.max(...players.map((p) => p.th));
  const maxThCount = players.filter((p) => p.th === maxTh).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q) || p.tag.toLowerCase().includes(q));
  }, [players, query]);

  const ordered = useMemo(() => {
    const list = [...filtered];
    if (view !== 'table' || sortMode === 'default') {
      list.sort((a, b) => {
        if (a.vip !== b.vip) return b.vip - a.vip;
        if (a.trophies !== b.trophies) return b.trophies - a.trophies;
        if ((a.heroesPct ?? -1) !== (b.heroesPct ?? -1)) return (b.heroesPct ?? -1) - (a.heroesPct ?? -1);
        return a.name.localeCompare(b.name);
      });
      return list;
    }
    const dir = sort.direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * dir;
      if (sort.key === 'vip') return (a.vip - b.vip) * dir;
      if (sort.key === 'trophies') return (a.trophies - b.trophies) * dir;
      if (sort.key === 'base') return ((a.basePct ?? -1) - (b.basePct ?? -1)) * dir;
      if (sort.key === 'heroes') return ((a.heroesPct ?? -1) - (b.heroesPct ?? -1)) * dir;
      return 0;
    });
    return list;
  }, [filtered, sort, sortMode, view]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        setSortMode('custom');
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      setSortMode('custom');
      return { key, direction: 'desc' };
    });
  };

  const sortIcon = (key: SortKey) => {
    if (sortMode !== 'custom' || sort.key !== key) return <ChevronDown size={12} style={{ opacity: 0.25 }} />;
    return sort.direction === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const resetSort = () => {
    setSortMode('default');
    setSort({ key: 'vip', direction: 'desc' });
  };

  const tablePresets = [
    { key: 'default', label: 'Default' },
    { key: 'war', label: 'War' },
    { key: 'leadership', label: 'Leadership' },
    { key: 'economy', label: 'Economy' },
  ] as const;

  const tablePadY = tableDensity === 'compact' ? 'py-1' : 'py-3';
  const tableHeaderColor = mode === 'light' ? 'rgba(30,58,138,0.78)' : text.muted;
  const tableToolbarMuted = mode === 'light' ? 'rgba(30,58,138,0.72)' : text.secondary;
  const tableDefaultMuted = mode === 'light' ? 'rgba(30,58,138,0.78)' : text.muted;

  useEffect(() => {
    if (!showMoreMenu) return;
    const onClick = (event: MouseEvent) => {
      if (!moreMenuRef.current?.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowMoreMenu(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [showMoreMenu]);

  return (
    <div
      className="space-y-6 rounded-3xl p-6 font-sans"
      style={{
        ...themeVars,
        backgroundImage:
          mode === 'dark'
            ? 'radial-gradient(900px 420px at 20% 0%, rgba(34,211,238,0.10) 0%, rgba(167,139,250,0.08) 42%, rgba(0,0,0,0) 75%)'
            : 'radial-gradient(900px 420px at 20% 0%, rgba(34,211,238,0.10) 0%, rgba(96,165,250,0.08) 52%, rgba(255,255,255,0) 78%)',
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: text.muted }}>
            UI Kit → Roster Spec
          </div>
          <h1 className="text-3xl font-black" style={{ color: text.primary, fontFamily: 'var(--font-display)' }}>
            Roster Dashboard (Spec Playground v2)
          </h1>
          <div className="flex flex-wrap gap-2 items-center">
            <Chip label="#2PR8R8V8P" />
            <Chip label={`${memberCount} Members`} />
            <Chip label={`TH${maxTh}×${maxThCount}`} />
            <Chip label="Viewing as: Guest" tone="muted" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary CTA */}
          <div className="flex items-center gap-2">
            <Button
              tone="primary"
              disabled={isGenerating}
              onClick={() => {
                setIsGenerating(true);
                // Spec-only: simulate an async request so we can validate button feedback.
                window.setTimeout(() => {
                  setGeneratedCount((c) => c + 1);
                  setLastGeneratedAt(Date.now());
                  setIsGenerating(false);
                }, 700);
              }}
            >
              {isGenerating ? 'Generating…' : 'Generate Insights'}
            </Button>
            {generatedCount > 0 && (
              <span className="text-[11px] font-semibold" style={{ color: text.secondary }}>
                Generated {generatedCount}×{lastGeneratedAt ? ` · ${new Date(lastGeneratedAt).toLocaleTimeString()}` : ''}
              </span>
            )}
          </div>

          {/* Utility cluster */}
          <Tooltip content={<span>Refresh (placeholder)</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
            <button
              type="button"
              onClick={() => {
                if (isRefreshing) return;
                setIsRefreshing(true);
                window.setTimeout(() => {
                  setIsRefreshing(false);
                  setShowRefreshDot(true);
                  window.setTimeout(() => setShowRefreshDot(false), 2400);
                }, 700);
              }}
              className="relative h-11 w-11 inline-flex items-center justify-center rounded-xl border transition-colors"
              style={{
                background: isRefreshing
                  ? (mode === 'dark' ? 'rgba(34,211,238,0.16)' : 'rgba(14,116,144,0.16)')
                  : surface.card,
                borderColor: surface.border,
                color: text.secondary,
              }}
              aria-label="Refresh"
              aria-busy={isRefreshing}
            >
              <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
              {showRefreshDot ? (
                <span
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"
                  style={{ background: mode === 'dark' ? tokens.colors.accentAlt : '#0E7490' }}
                />
              ) : null}
            </button>
          </Tooltip>

          <div ref={moreMenuRef} className="relative">
            <Tooltip content={<span>More actions (placeholder)</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
              <button
                type="button"
                onClick={() => {
                  setMorePulse(true);
                  window.setTimeout(() => setMorePulse(false), 350);
                  setShowMoreMenu((v) => !v);
                }}
                className="h-11 w-11 inline-flex items-center justify-center rounded-xl border transition-colors"
                style={{
                  background: morePulse || showMoreMenu
                    ? (mode === 'dark' ? 'rgba(34,211,238,0.14)' : 'rgba(14,116,144,0.12)')
                    : surface.card,
                  borderColor: surface.border,
                  color: text.secondary,
                  boxShadow: morePulse || showMoreMenu ? '0 0 0 2px rgba(14,116,144,0.15)' : undefined,
                }}
                aria-label="More"
                aria-haspopup="menu"
                aria-expanded={showMoreMenu}
              >
                <MoreHorizontal size={18} />
              </button>
            </Tooltip>
            {showMoreMenu ? (
              <div
                className="absolute right-0 top-12 z-20 min-w-[200px] rounded-xl border p-2 shadow-lg"
                style={{
                  background: surface.panel,
                  borderColor: surface.border,
                  boxShadow: '0 16px 32px -18px rgba(15,23,42,0.4)',
                }}
                role="menu"
              >
                {([
                  { label: 'Export roster…', sub: 'CSV / Sheets', muted: false },
                  { label: 'Copy tags', sub: 'Clipboard', muted: false },
                  { label: 'Save view', sub: 'Coming soon', muted: true },
                ] as const).map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setShowMoreMenu(false)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors"
                    style={{
                      color: item.muted ? text.muted : text.primary,
                    }}
                    onMouseEnter={(e) => {
                      if (item.muted) return;
                      (e.currentTarget as HTMLButtonElement).style.background = mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    <span className="font-semibold">{item.label}</span>
                    <span className="text-[11px]" style={{ color: item.muted ? text.muted : text.secondary }}>
                      {item.sub}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* View toggles */}
          <Tooltip content={<span>{mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}
              className="h-11 w-11 inline-flex items-center justify-center rounded-xl border"
              style={{
                background: surface.card,
                borderColor: surface.border,
                color: text.secondary,
              }}
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </Tooltip>

          <Tooltip content={<span>{assetsOn ? 'Assets on' : 'Assets off'}</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
            <button
              type="button"
              onClick={() => setAssetsOn((v) => !v)}
              className="h-11 w-11 inline-flex items-center justify-center rounded-xl border"
              style={{
                background: assetsOn ? (mode === 'dark' ? 'rgba(34,211,238,0.18)' : '#0E7490') : surface.card,
                borderColor: assetsOn ? 'var(--ring-user)' : surface.border,
                color: assetsOn ? (mode === 'dark' ? tokens.colors.accentAlt : '#ffffff') : text.secondary,
              }}
              aria-pressed={assetsOn}
              aria-label="Toggle assets"
            >
              <ImageIcon size={18} />
            </button>
          </Tooltip>

          {/* Layout (cards/table) */}
          <Segmented value={view} onChange={setView} mode={mode} tooltipTheme={tooltipTheme} tooltipMaxWidth={tooltipMaxWidth} tooltipOffset={tooltipOffset} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border p-3 flex flex-wrap items-center gap-3" style={{ background: surface.card, borderColor: surface.border }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players"
            className="h-11 flex-1 min-w-[220px] max-w-[720px] rounded-xl border px-3 text-sm"
            style={{ background: 'var(--input)', borderColor: surface.border, color: text.primary }}
          />
          <div
            className="inline-flex rounded-xl border overflow-hidden"
            style={{
              borderColor: surface.border,
              background: mode === 'light' ? 'rgba(30,58,138,0.06)' : 'rgba(0,0,0,0.2)',
            }}
          >
            {([
              { key: 'all', label: 'All' },
              { key: 'current', label: 'Current' },
              { key: 'former', label: 'Former' },
              { key: 'new', label: 'New Joiners' },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStatus(opt.key)}
                className="h-11 px-4 text-sm font-semibold"
                style={{
                  background: status === opt.key
                    ? mode === 'light'
                      ? 'rgba(30,58,138,0.14)'
                      : 'rgba(255,255,255,0.10)'
                    : 'transparent',
                  color: status === opt.key ? text.primary : text.secondary,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {view === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ordered.map((p) => {
            const isMe = p.tag === currentUserTag;
            return (
            <Link
              key={p.tag}
              href="#"
              className="block rounded-2xl border p-4 transition-transform"
              style={{
                background: surface.card,
                borderColor: isMe ? 'var(--ring-user)' : surface.border,
                boxShadow: isMe
                  ? '0 0 0 2px var(--ring-user), var(--shadow-md)'
                  : 'var(--shadow-md)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    {assetsOn ? (
                      <div className="flex items-center gap-3">
                        <TownHallIcon level={p.th} size="sm" className="-ml-1" />
                        <LeagueIcon
                          league={p.league}
                          ranked
                          size="xs"
                          className="-ml-0.5"
                          showBadge
                          badgeText={leagueBadgeText(p.league)}
                        />
                      </div>
                    ) : null}

                    <div>
                      <div className="text-[22px] font-black leading-tight" style={{ color: text.primary, fontFamily: 'var(--font-display)' }}>
                        {p.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 items-center">
                        {!assetsOn ? <Chip label={`TH${p.th}`} /> : null}
                        {!assetsOn ? <Chip label={p.league} /> : null}
                        <Tooltip
                          content={<span><b>SRS</b> (Spec Roster Score): placeholder 0–100 score for roster strength/engagement. Higher is better.</span>}
                          maxWidthPx={tooltipMaxWidth}
                          minWidthPx={tooltipMinWidth}
                          offsetPx={tooltipOffset}
                          theme={tooltipTheme}
                        >
                          <span className="inline-flex"><Chip label={`SRS ${p.srs}`} tone="info" /></span>
                        </Tooltip>
                        <Tooltip
                          content={<span><b>VIP</b> score: 0–100 overall contribution rating (war + support + progression). Higher is better.</span>}
                          maxWidthPx={tooltipMaxWidth}
                          minWidthPx={tooltipMinWidth}
                          offsetPx={tooltipOffset}
                          theme={tooltipTheme}
                        >
                          <span className="inline-flex"><Chip label={`VIP ${p.vip.toFixed(1)}`} tone="vip" /></span>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-11 w-11 inline-flex items-center justify-center rounded-xl border"
                  style={{
                    background: mode === 'light' ? 'rgba(30,58,138,0.04)' : 'rgba(255,255,255,0.04)',
                    borderColor: surface.border,
                    color: text.secondary,
                  }}
                  aria-label="More"
                >
                  <Ellipsis size={18} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-10 gap-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>Trophies</span>
                  <span className="text-xl font-black tabular-nums" style={{ color: text.primary }}>{p.trophies}</span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>Donated</span>
                  <span
                    className="text-xl font-black tabular-nums"
                    style={{ color: p.donated === 0 ? text.muted : text.primary }}
                  >
                    {p.donated}
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                <Progress
                  label="Base"
                  value={p.basePct}
                  detail={p.baseDetail}
                  tone="primary"
                  tooltipTheme={tooltipTheme}
                  tooltipMaxWidth={tooltipMaxWidth}
                  tooltipMinWidth={tooltipMinWidth}
                  tooltipOffset={tooltipTightOffset}
                />
                <Progress
                  label="Heroes"
                  value={p.heroesPct}
                  detail={p.heroesDetail}
                  tone="secondary"
                  tooltipTheme={tooltipTheme}
                  tooltipMaxWidth={tooltipMaxWidth}
                  tooltipMinWidth={tooltipMinWidth}
                  tooltipOffset={tooltipTightOffset}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {p.heroes.map((h) => {
                  const key = h.key.toLowerCase();
                  const src = (heroIconMap as any)[key];

                  return (
                    <Tooltip
                      key={`${p.tag}-${h.key}`}
                      content={
                        <span>
                          <b>
                            {h.key === 'BK'
                              ? 'Barbarian King'
                              : h.key === 'AQ'
                                ? 'Archer Queen'
                                : h.key === 'GW'
                                  ? 'Grand Warden'
                                  : h.key === 'RC'
                                    ? 'Royal Champion'
                                    : h.key === 'MP'
                                      ? 'Minion Prince'
                                      : h.key}
                          </b>{' '}
                          {h.level}
                        </span>
                      }
                      maxWidthPx={tooltipMaxWidth}
                      offsetPx={tooltipTightOffset}
                      theme={tooltipTheme}
                    >
                      <div
                        className="relative h-12 w-12 shrink-0 rounded-xl border"
                        style={{ borderColor: surface.border, background: surface.panel }}
                      >
                        {assetsOn && src ? (
                          <>
                            <Image
                              src={src}
                              alt={h.key}
                              fill
                              className="object-contain p-[7px]"
                              sizes="48px"
                            />
                            <div
                              className="absolute bottom-0.5 right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums"
                              style={{
                                background: 'var(--badge-bg, rgba(0,0,0,0.70))',
                                color: 'var(--badge-fg, rgba(255,255,255,0.92))',
                                border: '1px solid var(--border-subtle, rgba(255,255,255,0.16))',
                              }}
                            >
                              {h.level}
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none" style={{ color: text.primary }}>
                            <div className="text-xs font-black">{h.key}</div>
                            <div className="mt-0.5 text-[10px] font-bold tabular-nums" style={{ color: text.secondary }}>
                              {h.level}
                            </div>
                          </div>
                        )}
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ background: surface.card, borderColor: surface.border }}>
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: surface.border, background: mode === 'light' ? 'rgba(30,58,138,0.04)' : 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {tablePresets.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setTablePreset(preset.key)}
                  className="h-9 rounded-lg border px-3 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors"
                  style={{
                    borderColor: tablePreset === preset.key ? 'var(--ring-user)' : surface.border,
                    background: tablePreset === preset.key
                      ? (mode === 'light' ? 'rgba(14,116,144,0.12)' : 'rgba(34,211,238,0.18)')
                      : 'transparent',
                    color: tablePreset === preset.key ? text.primary : tableToolbarMuted,
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Tooltip content={<span>Column picker (placeholder)</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
                <button
                  type="button"
                  className="h-9 rounded-lg border px-3 text-[11px] font-semibold uppercase tracking-[0.16em]"
                  style={{ borderColor: surface.border, color: tableToolbarMuted }}
                >
                  Columns
                  <ChevronDown size={12} className="ml-1 inline-block opacity-60" />
                </button>
              </Tooltip>

              <Tooltip content={<span>Saved table views (placeholder)</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
                <button
                  type="button"
                  className="h-9 rounded-lg border px-3 text-[11px] font-semibold uppercase tracking-[0.16em]"
                  style={{ borderColor: surface.border, color: tableToolbarMuted }}
                >
                  Views
                  <ChevronDown size={12} className="ml-1 inline-block opacity-60" />
                </button>
              </Tooltip>

              <div
                className="inline-flex overflow-hidden rounded-lg border"
                style={{ borderColor: surface.border, background: mode === 'light' ? 'rgba(30,58,138,0.06)' : 'rgba(0,0,0,0.2)' }}
              >
                {(['comfortable', 'compact'] as const).map((density) => (
                  <button
                    key={density}
                    type="button"
                    onClick={() => setTableDensity(density)}
                    className="h-9 px-3 text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{
                      background: tableDensity === density
                        ? (mode === 'light' ? 'rgba(14,116,144,0.14)' : 'rgba(255,255,255,0.10)')
                        : 'transparent',
                      color: tableDensity === density ? text.primary : tableToolbarMuted,
                    }}
                  >
                    {density === 'comfortable' ? 'Cozy' : 'Compact'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-hidden">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col style={{ width: '36%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '10%' }} />
              </colgroup>
              <thead
                className="sticky top-0 z-10"
                style={{
                  background: mode === 'light' ? 'rgba(255,255,255,0.92)' : 'rgba(9,16,31,0.9)',
                  borderBottom: `1px solid ${surface.border}`,
                  backdropFilter: 'blur(10px)',
                }}
              >
                <tr className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: tableHeaderColor }}>
                  <th className={`px-4 ${tablePadY} text-left`}>Player</th>
                  <th
                    className={`px-4 ${tablePadY} text-right`}
                    aria-sort={sortMode === 'custom' && sort.key === 'vip' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <Tooltip content={<span>VIP score (0–100). Higher = stronger overall contribution.</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('vip')}>
                        <span>VIP</span>
                        {sortIcon('vip')}
                      </button>
                    </Tooltip>
                  </th>
                  <th
                    className={`px-4 ${tablePadY} text-right`}
                    aria-sort={sortMode === 'custom' && sort.key === 'trophies' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <Tooltip content={<span>Current ranked trophies (snapshot).</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('trophies')}>
                        <span>Trophies</span>
                        {sortIcon('trophies')}
                      </button>
                    </Tooltip>
                  </th>
                  <th
                    className={`px-4 ${tablePadY} text-right`}
                    aria-sort={sortMode === 'custom' && sort.key === 'base' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <Tooltip content={<span>Base readiness (rush/upgrade completeness).</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('base')}>
                        <span>Base</span>
                        {sortIcon('base')}
                      </button>
                    </Tooltip>
                  </th>
                  <th
                    className={`px-4 ${tablePadY} text-right`}
                    aria-sort={sortMode === 'custom' && sort.key === 'heroes' ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <Tooltip content={<span>Hero readiness (levels vs max).</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
                      <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort('heroes')}>
                        <span>Heroes</span>
                        {sortIcon('heroes')}
                      </button>
                    </Tooltip>
                  </th>
                  <th className={`px-4 ${tablePadY} text-right`}>
                    <Tooltip content={<span>Recent activity band (last 7 days).</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
                      <span className="inline-flex items-center gap-1">
                        Activity
                          <Info size={12} style={{ opacity: mode === 'light' ? 0.7 : 0.5 }} />
                      </span>
                    </Tooltip>
                  </th>
                  <th className={`px-4 ${tablePadY} text-right`}>
                    <Tooltip
                      content={<span>Default sort: VIP ↓, Trophies ↓, Heroes ↓, Name A→Z</span>}
                      maxWidthPx={tooltipMaxWidth}
                      offsetPx={tooltipOffset}
                      theme={tooltipTheme}
                    >
                      <button
                        type="button"
                        onClick={resetSort}
                        disabled={sortMode === 'default'}
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors disabled:opacity-40"
                        style={{
                          borderColor: surface.border,
                          color: sortMode === 'default' ? tableDefaultMuted : tableToolbarMuted,
                          background: sortMode === 'default'
                            ? (mode === 'light' ? 'rgba(30,58,138,0.10)' : 'rgba(255,255,255,0.06)')
                            : 'transparent',
                        }}
                        aria-label="Reset to default sort"
                      >
                        Default
                      </button>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((p, idx) => {
                  const isMe = p.tag === currentUserTag;
                  const rowBg = idx % 2 === 0
                    ? (mode === 'light' ? 'rgba(15,23,42,0.02)' : 'rgba(255,255,255,0.02)')
                    : 'transparent';
                  const baseRow = isMe ? 'rgba(14,116,144,0.08)' : rowBg;
                  const rowHover = isMe
                    ? 'rgba(14,116,144,0.16)'
                    : (mode === 'light' ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)');
                  const activityLabel = p.activity.replace('_', ' ');
                  return (
                    <tr
                      key={p.tag}
                      className="group cursor-pointer border-t bg-[var(--row-bg)] transition-colors hover:bg-[var(--row-hover)]"
                      style={{
                        borderColor: surface.border,
                        ['--row-bg' as any]: baseRow,
                        boxShadow: isMe ? 'inset 0 0 0 2px var(--ring-user)' : undefined,
                        ['--row-hover' as any]: rowHover,
                      }}
                      onClick={() => {
                        window.location.href = `/new/player/${p.tag.replace('#', '')}`;
                      }}
                      role="link"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          window.location.href = `/new/player/${p.tag.replace('#', '')}`;
                        }
                      }}
                    >
                      <td className={`px-4 ${tablePadY}`}>
                        <div className="flex items-center gap-3">
                          {assetsOn ? (
                            <div className={`flex items-center gap-3 ${tableDensity === 'compact' ? 'scale-90 origin-left' : ''}`}>
                              <TownHallIcon level={p.th} size="sm" className="-ml-1" />
                              <LeagueIcon
                                league={p.league}
                                ranked
                                size="xs"
                                className="-ml-0.5"
                                showBadge
                                badgeText={leagueBadgeText(p.league)}
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <Chip label={`TH${p.th}`} />
                              <Chip label={p.league} />
                            </div>
                          )}
                          <div>
                            <div
                              className="font-bold transition-colors group-hover:underline"
                              style={{
                                color: text.primary,
                                fontFamily: 'var(--font-display)',
                                textDecorationColor: mode === 'dark' ? tokens.colors.accentAlt : '#0E7490',
                              }}
                            >
                              {p.name}
                            </div>
                            {tableDensity !== 'compact' ? (
                              <div className="text-[11px]" style={{ color: text.muted }}>
                                {p.tag} · {p.role}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 ${tablePadY} text-right`}>
                        <div className="font-bold tabular-nums" style={{ color: 'var(--accent-vip)' }}>{p.vip.toFixed(1)}</div>
                      </td>
                      <td className={`px-4 ${tablePadY} text-right`}>
                        <div className="font-bold tabular-nums" style={{ color: text.primary }}>{p.trophies}</div>
                      </td>
                      <td className={`px-4 ${tablePadY} text-right`}>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold tabular-nums" style={{ color: text.primary }}>
                            {p.basePct == null ? '—' : `${p.basePct}%`}
                          </span>
                          {tableDensity !== 'compact' ? (
                            <div className="h-1.5 w-20 rounded-full" style={{ background: 'var(--progress-track)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: p.basePct == null ? '0%' : `${p.basePct}%`,
                                  background: tokens.colors.accentAlt,
                                  opacity: p.basePct == null ? 0 : 1,
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className={`px-4 ${tablePadY} text-right`}>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold tabular-nums" style={{ color: text.primary }}>
                            {p.heroesPct == null ? '—' : `${p.heroesPct}%`}
                          </span>
                          {tableDensity !== 'compact' ? (
                            <div className="h-1.5 w-20 rounded-full" style={{ background: 'var(--progress-track)' }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: p.heroesPct == null ? '0%' : `${p.heroesPct}%`,
                                  background: 'var(--progress-secondary)',
                                  opacity: p.heroesPct == null ? 0 : 1,
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className={`px-4 ${tablePadY} text-right`}>
                        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: text.muted }}>
                          <span className="h-2 w-2 rounded-full" style={{ background: activityAccent(p.activity) }} />
                          {activityLabel}
                        </span>
                      </td>
                      <td className={`px-4 ${tablePadY} text-right`}>
                        <Tooltip content={<span>Row actions (placeholder)</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border opacity-0 transition-opacity group-hover:opacity-100"
                            style={{
                              background: mode === 'light' ? 'rgba(30,58,138,0.06)' : 'rgba(255,255,255,0.04)',
                              borderColor: surface.border,
                              color: text.secondary,
                            }}
                            aria-label="Row actions"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary (demoted so the roster is the hero) */}
      <details className="rounded-2xl border p-4" style={{ background: surface.card, borderColor: surface.border }}>
        <summary className="cursor-pointer select-none text-sm font-semibold" style={{ color: text.primary }}>
          Summary
          <span className="ml-2 text-xs font-semibold" style={{ color: text.muted }}>
            (KPIs + roster health)
          </span>
        </summary>

        <div className="mt-4 space-y-3">
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollSnapType: 'x mandatory' }}>
            <div style={{ scrollSnapAlign: 'start' }}><Tile label="Avg VIP" value="58" sub="+4.2 vs last 7d" tone="vip" /></div>
            <div style={{ scrollSnapAlign: 'start' }}><Tile label="Avg Power" value="221" sub="+7 vs last 7d" tone="primary" /></div>
            <div style={{ scrollSnapAlign: 'start' }}><Tile label="Total Donated" value="233" sub="+31 vs last 7d" tone="secondary" /></div>
            <div style={{ scrollSnapAlign: 'start' }}><Tile label="Active" value="14%" sub="last 7d" /></div>
            <div style={{ scrollSnapAlign: 'start' }}><Tile label="Top VIP" value="80.4" sub="God Of LOYINs" tone="vip" /></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {([
              { label: 'Very Active', value: 1, bucket: 'very_active' },
              { label: 'Active', value: 3, bucket: 'active' },
              { label: 'Moderate', value: 10, bucket: 'moderate' },
              { label: 'Low', value: 4, bucket: 'low' },
              { label: 'Inactive', value: 3, bucket: 'inactive' },
            ] as const).map((b) => (
              <div
                key={b.label}
                className="rounded-xl px-4 py-3"
                style={{
                  background: surface.panel,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 h-12 w-[3px] rounded-full"
                    style={{ background: activityAccent(b.bucket as any), opacity: mode === 'light' ? 0.7 : 0.9 }}
                    aria-hidden
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: text.muted }}>
                      <span>{b.label}</span>
                      <Tooltip content={<span>Definition: last 7d</span>} maxWidthPx={tooltipMaxWidth} offsetPx={tooltipOffset} theme={tooltipTheme}>
                        <button
                          type="button"
                          className="h-4 w-4 inline-flex items-center justify-center"
                          style={{
                            background: 'transparent',
                            color: text.muted,
                            opacity: 0.7,
                          }}
                          aria-label={`${b.label} definition`}
                        >
                          <Info size={14} />
                        </button>
                      </Tooltip>
                    </div>
                    <div className="mt-2 text-2xl font-black tabular-nums" style={{ color: text.primary }}>{b.value}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </details>

      <div className="text-sm" style={{ color: text.muted }}>
        This page is intentionally <span style={{ color: text.primary }}>fake data</span> + <span style={{ color: text.primary }}>token-driven primitives</span>, so we can iterate on the system safely.
      </div>
    </div>
  );
}
