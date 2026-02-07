"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Tooltip } from '@/components/ui/Tooltip';
import { LayoutGrid, Table2 } from 'lucide-react';

type ClanStats = {
  memberCount: number;
  thDistribution: Record<number, number>;
  avgVipScore?: number | null;
  avgHeroPower?: number | null;
  totalDonations?: number | null;
};

const TH_COLORS: Record<number, string> = {
  17: '#f43f5e',
  16: '#f97316',
  15: '#eab308',
  14: '#22c55e',
  13: '#3b82f5',
  12: '#8b5cf6',
  11: '#ec4899',
  10: '#6366f1',
  9: '#06b6d4',
  8: '#84cc16',
  7: '#f59e0b',
  6: '#78716c',
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

function Chip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold"
      style={{ border: `1px solid ${surface.border}`, color: text.secondary }}
    >
      {label}
    </span>
  );
}

function THDistributionBar({ distribution }: { distribution: Record<number, number> }) {
  const entries = Object.entries(distribution)
    .map(([th, count]) => ({ th: parseInt(th, 10), count }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.th - a.th);

  const total = entries.reduce((acc, e) => acc + e.count, 0) || 1;

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: surface.panel }}>
      {entries.map((e) => (
        <Tooltip key={e.th} content={<span>{`TH${e.th}: ${e.count} members`}</span>}>
          <span
            className="h-full"
            style={{
              width: `${(e.count / total) * 100}%`,
              background: TH_COLORS[e.th] || 'rgba(255,255,255,0.25)',
            }}
            aria-label={`TH${e.th}: ${e.count} members`}
          />
        </Tooltip>
      ))}
    </div>
  );
}

export function MiniStat({ label, value, color, suffix }: { label: string; value: string; color: string; suffix?: string }) {
  return (
    <div className="text-center px-3 py-1.5 rounded-lg" style={{ background: surface.panel }}>
      <div className="uppercase tracking-widest text-[9px]" style={{ color: text.muted }}>{label}</div>
      <div className="font-bold text-lg" style={{ color }}>
        {value}
        {suffix ? <span className="text-xs ml-1" style={{ color: text.muted }}>{suffix}</span> : null}
      </div>
    </div>
  );
}

function THDistributionSummary({ distribution, extra }: { distribution: Record<number, number>; extra?: React.ReactNode }) {
  const entries = Object.entries(distribution)
    .map(([th, count]) => ({ th: parseInt(th, 10), count }))
    .filter((e) => e.count > 0)
    .sort((a, b) => b.th - a.th);

  if (entries.length === 0) return null;

  const top = entries.slice(0, 3);
  const remaining = entries.slice(3);

  return (
    <details className="hidden lg:block">
      <summary className="list-none cursor-pointer select-none">
        <Tooltip content={<span>Town Hall distribution</span>}>
          <div className="flex items-center gap-2">
            <div className="text-[9px] uppercase tracking-widest" style={{ color: text.muted }}>TH mix</div>
            <div className="flex items-center gap-1.5">
              {top.map((e) => (
                <span
                  key={e.th}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    borderColor: surface.border,
                    background: surface.panel,
                    color: text.primary,
                  }}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: TH_COLORS[e.th] || 'rgba(255,255,255,0.25)' }}
                  />
                  <span className="font-mono">TH{e.th}</span>
                  <span className="text-slate-400">×</span>
                  <span className="tabular-nums">{e.count}</span>
                </span>
              ))}
              {remaining.length ? (
                <span className="text-[11px]" style={{ color: text.muted }}>+{remaining.length} more</span>
              ) : null}
            </div>
          </div>
        </Tooltip>
      </summary>

      <div className="mt-2 rounded-xl border p-3" style={{ borderColor: surface.border, background: surface.panel }}>
        <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: text.muted }}>Town Hall distribution</div>
        <THDistributionBar distribution={distribution} />
        <div className="mt-2 grid grid-cols-4 gap-2">
          {entries.map((e) => (
            <div key={e.th} className="flex items-center gap-2 text-xs" style={{ color: text.primary }}>
              <span className="h-2 w-2 rounded-full" style={{ background: TH_COLORS[e.th] || 'rgba(255,255,255,0.25)' }} />
              <span className="font-mono">TH{e.th}</span>
              <span style={{ color: text.muted }}>·</span>
              <span className="tabular-nums">{e.count}</span>
            </div>
          ))}
        </div>

        {extra ? (
          <div className="mt-3 border-t pt-3" style={{ borderColor: surface.border }}>
            {extra}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ViewToggle({
  view,
  onViewChange,
  mode,
}: {
  view: 'cards' | 'table';
  onViewChange?: (view: 'cards' | 'table') => void;
  mode: 'dark' | 'light';
}) {
  const router = useRouter();

  useEffect(() => {
    // Warm the other route's JS as a fallback.
    router.prefetch(view === 'cards' ? '/new/roster?view=table' : '/new/roster?view=cards');
  }, [router, view]);

  const ButtonOrLink = ({
    target,
    label,
  }: {
    target: 'cards' | 'table';
    label: string;
  }) => {
    const active = view === target;
    const className = "h-11 w-11 inline-flex items-center justify-center transition-colors";
    const style = {
      background:
        active
          ? mode === 'dark'
            ? 'rgba(34,211,238,0.18)'
            : '#0E7490'
          : 'transparent',
      color:
        active
          ? mode === 'dark'
            ? 'var(--accent-alt)'
            : '#ffffff'
          : text.secondary,
      boxShadow:
        active
          ? mode === 'dark'
            ? 'inset 0 0 0 1px rgba(34,211,238,0.35)'
            : 'inset 0 0 0 1px rgba(14,116,144,0.65)'
          : undefined,
    };

    if (onViewChange) {
      return (
        <button
          type="button"
          onClick={() => onViewChange(target)}
          className={className}
          style={style}
          aria-current={active ? 'page' : undefined}
          aria-label={label}
        >
          {target === 'cards' ? <LayoutGrid size={18} /> : <Table2 size={18} />}
        </button>
      );
    }

    const href = target === 'cards' ? '/new/roster?view=cards' : '/new/roster?view=table';
    return (
      <Link href={href} prefetch scroll={false} className={className} style={style} aria-current={active ? 'page' : undefined}>
        {target === 'cards' ? <LayoutGrid size={18} /> : <Table2 size={18} />}
        <span className="sr-only">{label}</span>
      </Link>
    );
  };

  return (
    <div
      className="inline-flex rounded-xl border overflow-hidden"
      style={{
        borderColor: surface.border,
        background: 'rgba(0,0,0,0.2)',
      }}
      role="group"
      aria-label="View"
    >
      <Tooltip content={<span>Cards view</span>}>
        <div>
          <ButtonOrLink target="cards" label="Cards" />
        </div>
      </Tooltip>
      <Tooltip content={<span>Table view</span>}>
        <div>
          <ButtonOrLink target="table" label="Table" />
        </div>
      </Tooltip>
    </div>
  );
}

export function RosterHeader({
  clanName,
  clanTag,
  lastUpdated,
  subtitle,
  clanStats,
  rightActions,
  view,
  onViewChange,
  mode,
  detailsExtra,
  eyebrow,
  viewingChipLabel,
}: {
  clanName: string;
  clanTag?: string | null;
  lastUpdated?: Date | null;
  subtitle?: React.ReactNode;
  clanStats?: ClanStats | null;
  rightActions: React.ReactNode;
  view: 'cards' | 'table';
  onViewChange?: (view: 'cards' | 'table') => void;
  mode: 'dark' | 'light';
  detailsExtra?: React.ReactNode;
  eyebrow?: React.ReactNode;
  viewingChipLabel?: string;
}) {
  const updatedLabel = lastUpdated ? `Snapshot updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}` : 'Snapshot update time unknown';
  const subtitleNode = subtitle ?? updatedLabel;
  const thEntries = clanStats
    ? Object.entries(clanStats.thDistribution || {})
        .map(([th, count]) => ({ th: parseInt(th, 10), count }))
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.th - a.th)
    : [];
  const maxTh = thEntries[0]?.th ?? null;
  const maxThCount = thEntries[0]?.count ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-5 flex-wrap">
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: text.muted }}>
            {eyebrow ?? 'Roster'}
          </div>
          <h1 className="text-[36px] leading-tight font-extrabold tracking-[0.01em] sm:text-[42px]" style={{ color: text.primary, fontFamily: 'var(--font-display)' }}>
            {clanName}
          </h1>
          <div className="mt-1 flex flex-wrap gap-2 items-center">
            {clanTag ? <Chip label={clanTag} /> : null}
            {clanStats ? <Chip label={`${clanStats.memberCount} Members`} /> : null}
            {maxTh ? <Chip label={`TH${maxTh}×${maxThCount ?? 0}`} /> : null}
            {viewingChipLabel ? <Chip label={viewingChipLabel} /> : null}
          </div>
          <div className="text-xs" style={{ color: text.muted }}>
            {subtitleNode}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {rightActions}

          <ViewToggle view={view} onViewChange={onViewChange} mode={mode} />
        </div>
      </div>

      {clanStats ? (
        <div className="mt-4">
          <THDistributionSummary distribution={clanStats.thDistribution} extra={detailsExtra} />
        </div>
      ) : null}
    </div>
  );
}
