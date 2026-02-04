"use client";

import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { tokens } from '@/lib/tokens';
import TownHallIcon from '@/components/new-ui/icons/TownHallIcon';
import LeagueIcon from '@/components/new-ui/icons/LeagueIcon';
import Image from 'next/image';
import { heroIconMap } from '@/components/new-ui/icons/maps';
import { Info, LayoutGrid, Table2 } from 'lucide-react';

type View = 'cards' | 'table';

type ActivityBucket = 'very_active' | 'active' | 'moderate' | 'low' | 'inactive';

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
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold"
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
}: {
  children: React.ReactNode;
  tone?: 'primary' | 'secondary' | 'ghost';
  onClick?: () => void;
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
      className="h-11 rounded-xl px-4 text-sm font-semibold transition-colors"
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
}: {
  value: View;
  onChange: (v: View) => void;
  mode: 'dark' | 'light';
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
        <button
          key={opt.key}
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
          title={opt.label}
        >
          <opt.Icon size={18} />
        </button>
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
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: text.muted }}>
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

function Tooltip({
  content,
  children,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [align, setAlign] = useState<'center' | 'left' | 'right'>('center');

  const isCoarsePointer = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  }, []);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click / escape (for touch + keyboard)
  useEffect(() => {
    if (!open) return;

    const onDocClick = (e: MouseEvent) => {
      const root = wrapperRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      close();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [close, open]);

  // Smart-ish placement: if tooltip overflows viewport, pin left/right.
  useLayoutEffect(() => {
    if (!open) return;
    const tip = tipRef.current;
    if (!tip) return;

    // Reset
    setAlign('center');
    // Wait a tick for layout
    requestAnimationFrame(() => {
      const rect = tip.getBoundingClientRect();
      const pad = 12;
      if (rect.left < pad) setAlign('left');
      else if (rect.right > window.innerWidth - pad) setAlign('right');
      else setAlign('center');
    });
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => {
        if (!isCoarsePointer) setOpen(true);
      }}
      onMouseLeave={() => {
        if (!isCoarsePointer) setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => {
        if (!isCoarsePointer) setOpen(false);
      }}
    >
      <span
        className="inline-flex"
        onClick={() => {
          if (isCoarsePointer) setOpen((v) => !v);
        }}
      >
        {children}
      </span>

      <span
        ref={tipRef}
        className={(open ? 'block' : 'hidden') +
          ' pointer-events-none absolute top-0 z-50 w-[min(260px,calc(100vw-24px))] rounded-xl border px-3 py-2 text-xs leading-relaxed'}
        style={{
          background: surface.card,
          borderColor: surface.border,
          color: text.primary,
          boxShadow: 'var(--shadow-md)',
          transform: 'translateY(calc(-100% - 10px))',
          left: align === 'left' ? 0 : align === 'right' ? 'auto' : '50%',
          right: align === 'right' ? 0 : 'auto',
          translate: align === 'center' ? '-50% 0' : '0 0',
        } as any}
      >
        {content}
      </span>
    </span>
  );
}

function Progress({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null;
  detail?: string;
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

  const trackBg = 'rgba(255,255,255,0.10)';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold" style={{ color: text.secondary }}>
        <span className="inline-flex items-center gap-2">
          <span className="uppercase tracking-[0.16em]">{label}</span>
          {tooltip ? (
            <Tooltip content={tooltip}>
              <button
                type="button"
                className="h-4 w-4 inline-flex items-center justify-center"
                style={{
                  background: 'transparent',
                  color: text.muted,
                  opacity: 0.7,
                }}
                aria-label={`${label} info`}
                title={`${label} info`}
              >
                <Info size={14} />
              </button>
            </Tooltip>
          ) : null}
        </span>
        <span className="tabular-nums" style={{ color: text.primary }}>{pct == null ? '—' : `${pct}%`}</span>
      </div>

      <div className="h-2 rounded-full" style={{ background: trackBg }}>
        <div
          className="h-full rounded-full"
          style={{ width: pct == null ? '0%' : `${pct}%`, background: tokens.colors.accentAlt, opacity: pct == null ? 0 : 1 }}
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
  const [view, setView] = useState<View>('cards');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'current' | 'former' | 'new'>('all');

  useEffect(() => {
    try {
      window.localStorage.setItem('ui.rosterSpec.mode', mode);
    } catch {
      // ignore
    }
  }, [mode]);

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

      background: 'var(--bg)',
      color: 'var(--text-primary)',
    };
  }, [mode]);

  const players: Player[] = useMemo(
    () => [
      {
        tag: '#WARFROGGY',
        name: 'warfroggy',
        role: 'member',
        th: 15,
        league: 'Titan',
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
        league: 'Crystal',
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
        league: 'Legend',
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
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.name.toLowerCase().includes(q) || p.tag.toLowerCase().includes(q));
  }, [players, query]);

  return (
    <div
      className="space-y-6 rounded-3xl p-6"
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
            Roster Dashboard (Spec Playground)
          </h1>
          <div className="flex flex-wrap gap-2 items-center">
            <Chip label="#2PR8R8V8P" />
            <Chip label="21 Members" />
            <Chip label="TH17×1" />
            <Chip label="Viewing as: Guest" tone="muted" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button tone="primary">Generate Insights</Button>
          <Button tone="secondary">Refresh</Button>
          <Button tone="ghost">More</Button>
          <Button tone="ghost" onClick={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}>
            {mode === 'dark' ? 'Light mode' : 'Dark mode'}
          </Button>
          <Button tone="ghost" onClick={() => setAssetsOn((v) => !v)}>
            {assetsOn ? 'Assets: On' : 'Assets: Off'}
          </Button>
          <Segmented value={view} onChange={setView} mode={mode} />
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollSnapType: 'x mandatory' }}>
        <div style={{ scrollSnapAlign: 'start' }}><Tile label="Avg VIP" value="58" tone="vip" /></div>
        <div style={{ scrollSnapAlign: 'start' }}><Tile label="Avg Power" value="221" tone="primary" /></div>
        <div style={{ scrollSnapAlign: 'start' }}><Tile label="Total Donated" value="233" tone="secondary" /></div>
        <div style={{ scrollSnapAlign: 'start' }}><Tile label="Active" value="14%" /></div>
        <div style={{ scrollSnapAlign: 'start' }}><Tile label="Top VIP" value="80.4" sub="God Of LOYINs" tone="vip" /></div>
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

        <div className="rounded-2xl border p-3" style={{ background: surface.card, borderColor: surface.border }}>
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
                  borderColor: surface.border,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 h-12 w-[3px] rounded-full"
                    style={{ background: activityAccent(b.bucket as any), opacity: mode === 'light' ? 0.7 : 0.9 }}
                    aria-hidden
                  />
                  <div className="flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: text.muted }}>{b.label}</div>
                    <div className="mt-2 text-2xl font-black" style={{ color: text.primary }}>{b.value}</div>
                    <div className="mt-2 text-xs" style={{ color: text.secondary }}>
                      <span style={{ color: text.muted }}>Definition:</span> last 7d
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {view === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
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
                  ? '0 0 0 2px var(--ring-user), 0 0 22px var(--glow-user), 0 0 64px var(--glow-user), var(--shadow-md)'
                  : 'var(--shadow-md)',
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3">
                    {assetsOn ? (
                      <div className="flex items-center gap-2">
                        <TownHallIcon level={p.th} size="sm" className="-ml-1" />
                        <LeagueIcon league={p.league} ranked size="xs" className="-ml-2" />
                      </div>
                    ) : null}

                    <div>
                      <div className="text-[22px] font-black leading-tight" style={{ color: text.primary, fontFamily: 'var(--font-display)' }}>
                        {p.name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 items-center">
                        {!assetsOn ? <Chip label={`TH${p.th}`} /> : null}
                        {!assetsOn ? <Chip label={p.league} /> : null}
                        <Chip label={`SRS ${p.srs}`} tone="info" />
                        <Chip label={`VIP ${p.vip.toFixed(1)}`} tone="vip" />
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="h-11 w-11 rounded-xl"
                  style={{
                    color: text.muted,
                    background: 'transparent',
                    border: 'none',
                  }}
                  aria-label="More"
                  title="More"
                >
                  <span style={{ fontSize: 20, lineHeight: '44px', display: 'inline-block' }}>⋯</span>
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: text.muted }}>Trophies</span>
                  <span className="text-xl font-black tabular-nums min-w-[64px] text-right" style={{ color: text.primary }}>{p.trophies}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: text.muted }}>Donated</span>
                  <span
                    className="text-xl font-black tabular-nums min-w-[64px] text-right"
                    style={{ color: p.donated === 0 ? text.muted : text.primary }}
                    title={p.donated === 0 ? 'No donations recorded.' : undefined}
                  >
                    {p.donated}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <Progress label="Base" value={p.basePct} detail={p.baseDetail} />
                <Progress label="Heroes" value={p.heroesPct} detail={p.heroesDetail} />
              </div>

              <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
                {p.heroes.map((h) => {
                  const key = h.key.toLowerCase();
                  const src = (heroIconMap as any)[key];

                  return (
                    <div
                      key={`${p.tag}-${h.key}`}
                      className="relative h-12 w-12 shrink-0 rounded-xl border"
                      style={{ borderColor: surface.border, background: surface.panel }}
                    >
                      {assetsOn && src ? (
                        <Image
                          src={src}
                          alt={h.key}
                          fill
                          className="object-contain p-1"
                          sizes="48px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-black" style={{ color: text.primary }}>
                          {h.key}
                        </div>
                      )}

                      <div
                        className="absolute -bottom-1 -right-1 rounded-full px-2 py-0.5 text-[10px] font-black"
                        style={{ background: 'var(--badge-bg)', color: 'var(--badge-fg)', border: `1px solid ${surface.border}` }}
                      >
                        {h.level}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ background: surface.card, borderColor: surface.border }}>
          <div className="grid grid-cols-6 gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: text.muted, background: 'rgba(0,0,0,0.2)' }}>
            <div className="col-span-2">Player</div>
            <div className="text-right">VIP</div>
            <div className="text-right">Trophies</div>
            <div className="text-right">Base</div>
            <div className="text-right">Heroes</div>
          </div>
          {filtered.map((p) => {
            const isMe = p.tag === currentUserTag;
            return (
              <div
                key={p.tag}
                className="grid grid-cols-6 gap-2 px-4 py-3 border-t"
                style={{
                  borderColor: surface.border,
                  background: isMe ? 'rgba(14,116,144,0.10)' : 'transparent',
                  boxShadow: isMe ? 'inset 3px 0 0 0 var(--ring-user)' : undefined,
                }}
              >
                <div className="col-span-2">
                  <div className="font-bold" style={{ color: text.primary, fontFamily: 'var(--font-display)' }}>{p.name}</div>
                  <div className="text-[11px]" style={{ color: text.muted }}>{p.tag}</div>
                </div>
                <div className="text-right font-bold tabular-nums" style={{ color: 'var(--accent-vip)' }}>{p.vip.toFixed(1)}</div>
                <div className="text-right font-bold tabular-nums" style={{ color: text.primary }}>{p.trophies}</div>
                <div className="text-right font-bold tabular-nums" style={{ color: text.primary }}>{p.basePct == null ? '—' : `${p.basePct}%`}</div>
                <div className="text-right font-bold tabular-nums" style={{ color: text.primary }}>{p.heroesPct == null ? '—' : `${p.heroesPct}%`}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-sm" style={{ color: text.muted }}>
        This page is intentionally <span style={{ color: text.primary }}>fake data</span> + <span style={{ color: text.primary }}>token-driven primitives</span>, so we can iterate on the system safely.
      </div>
    </div>
  );
}
