"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GlobalSearchProps {
  placeholder?: string;
}

export function GlobalSearch({ placeholder = 'Search players, wars, analytics…' }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      const isEscape = event.key === 'Escape';

      if (isCmdK) {
        event.preventDefault();
        openPalette();
      }

      if (isEscape) {
        closePalette();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closePalette, openPalette]);

  const shortcuts = useMemo(
    () => [
      { label: 'Assess new member', href: '/players/assess' },
      { label: 'Open roster', href: '/players/roster' },
      { label: 'Start war plan', href: '/war/planning' },
      { label: 'View war analytics', href: '/war/analytics' },
    ],
    []
  );

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
        aria-label="Open global search"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-slate-200">⌘K</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-10">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl">
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={closePalette}
                className="rounded-full p-1 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Close search"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-3 text-sm text-slate-300">
              <p className="font-semibold text-slate-200">Coming soon</p>
              <p className="mt-1 text-slate-400">
                Global search will surface players, wars, analytics, and pages. Hook this shell to the backend search API in Phase 4.
              </p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {shortcuts.map((shortcut) => (
                <a
                  key={shortcut.href}
                  href={shortcut.href}
                  onClick={closePalette}
                  className={cn(
                    'flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-clash-gold/40 hover:bg-clash-gold/10'
                  )}
                >
                  <span>{shortcut.label}</span>
                  <span className="text-xs text-slate-400">{shortcut.href}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default GlobalSearch;
