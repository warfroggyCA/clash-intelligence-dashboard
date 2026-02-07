"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, MoreHorizontal, RefreshCw, Settings, Sun } from 'lucide-react';
import { Spec2IconButton } from '@/components/ui/Spec2Controls';
import { Tooltip } from '@/components/ui/Tooltip';
import { useTheme } from '@/lib/contexts/theme-context';

export default function NewHeaderActions() {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        setMenuOpen(false);
        return;
      }
      if (!menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 700);
  };

  return (
    <div className="flex items-center gap-2" data-testid="new-header-actions">
      <Tooltip content={<span>Refresh</span>}>
        <Spec2IconButton ariaLabel="Refresh page data" onClick={handleRefresh}>
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </Spec2IconButton>
      </Tooltip>

      <Tooltip content={<span>{resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>}>
        <Spec2IconButton
          ariaLabel={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        >
          {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </Spec2IconButton>
      </Tooltip>

      <div className="relative" ref={menuRef}>
        <Tooltip content={<span>More</span>}>
          <Spec2IconButton ariaLabel="Open global actions" onClick={() => setMenuOpen((v) => !v)} active={menuOpen}>
            <MoreHorizontal size={18} />
          </Spec2IconButton>
        </Tooltip>

        {menuOpen ? (
          <div
            className="absolute right-0 mt-2 min-w-[180px] rounded-xl border p-1.5 shadow-xl"
            style={{ background: 'var(--panel)', borderColor: 'var(--border-subtle)' }}
            role="menu"
            aria-label="Global actions"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                router.push('/new/settings');
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-primary)' }}
            >
              <Settings size={14} />
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                handleRefresh();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-primary)' }}
            >
              <RefreshCw size={14} />
              Refresh now
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
