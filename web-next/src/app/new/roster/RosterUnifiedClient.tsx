"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RosterData } from './types';
import RosterClient from './RosterClient';
import TableClient from './table/TableClient';
import { useRouter, useSearchParams } from 'next/navigation';

type ViewMode = 'cards' | 'table';
type UiMode = 'dark' | 'light';

const MODE_KEY = 'ui.mode';

function computeSpec2ThemeVars(mode: UiMode): React.CSSProperties {
  if (mode === 'light') {
    return {
      ['--bg' as any]: '#F6F8FC',
      ['--panel' as any]: '#EEF4FF',
      ['--card' as any]: '#FBFDFF',
      ['--input' as any]: '#FFFFFF',
      ['--border-subtle' as any]: 'rgba(15,23,42,0.10)',

      ['--text-primary' as any]: 'rgba(30,58,138,0.92)',
      ['--text-secondary' as any]: 'rgba(30,58,138,0.76)',
      ['--text-muted' as any]: 'rgba(30,58,138,0.62)',

      ['--badge-bg' as any]: 'rgba(255,255,255,0.95)',
      ['--badge-fg' as any]: 'var(--text-primary)',

      ['--accent-vip' as any]: '#6D28D9',
      ['--ring-user' as any]: 'rgba(14,116,144,0.60)',
      ['--glow-user' as any]: 'rgba(14,116,144,0.22)',

      ['--shadow-md' as any]: '0 10px 26px rgba(15,23,42,0.10)',

      ['--progress-track' as any]: 'rgba(15,23,42,0.10)',
      ['--progress-secondary' as any]: 'rgba(34,211,238,0.55)',

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

    ['--badge-bg' as any]: 'rgba(0,0,0,0.85)',
    ['--badge-fg' as any]: 'rgba(255,255,255,0.92)',

    ['--accent-vip' as any]: '#A78BFA',
    ['--ring-user' as any]: 'rgba(34,211,238,0.55)',
    ['--glow-user' as any]: 'rgba(34,211,238,0.38)',

    ['--shadow-md' as any]: 'none',

    ['--progress-track' as any]: 'rgba(255,255,255,0.10)',
    ['--progress-secondary' as any]: 'rgba(34,211,238,0.55)',

    ['--tooltip-border' as any]: 'rgba(255,255,255,0.14)',
    ['--tooltip-shadow' as any]: '0 0 0 1px rgba(255,255,255,0.06)',

    background: 'var(--bg)',
    color: 'var(--text-primary)',
  };
}

export default function RosterUnifiedClient({
  initialRoster,
  initialView = 'auto',
}: {
  initialRoster?: RosterData | null;
  initialView?: ViewMode | 'auto';
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ViewMode>(() => (initialView === 'table' ? 'table' : 'cards'));
  const [mode, setMode] = useState<UiMode>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(MODE_KEY) : null;
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Load saved view on mount (unless URL explicitly set cards/table).
  useEffect(() => {
    if (initialView !== 'auto') return;
    try {
      const saved = window.localStorage.getItem('roster.view');
      if (saved === 'cards' || saved === 'table') {
        setView(saved);
      }
    } catch {
      // ignore
    }
  }, [initialView]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  const onViewChange = useCallback(
    (next: ViewMode) => {
      setView(next);
      try {
        window.localStorage.setItem('roster.view', next);
      } catch {
        // ignore
      }

      // Persist in URL so refresh/deep-link keeps the chosen view.
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('view', next);
      const query = params.toString();
      router.replace(query ? `/new/roster?${query}` : '/new/roster');
    },
    [router, searchParams]
  );

  const themeVars = useMemo(() => computeSpec2ThemeVars(mode), [mode]);

  const toggleMode = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), []);

  return (
    <div
      className="rounded-3xl border overflow-hidden"
      style={{ ...themeVars, background: 'var(--card)', borderColor: 'var(--border-subtle)' }}
    >
      <div className={view === 'cards' ? 'block' : 'hidden'}>
        <RosterClient initialRoster={initialRoster} onViewChange={onViewChange} mode={mode} onToggleMode={toggleMode} />
      </div>
      <div className={view === 'table' ? 'block' : 'hidden'}>
        <TableClient initialRoster={initialRoster} onViewChange={onViewChange} mode={mode} onToggleMode={toggleMode} />
      </div>
    </div>
  );
}
