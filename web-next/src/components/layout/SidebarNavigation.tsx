"use client";

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navConfig, type NavItem } from '@/lib/nav-config';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import useSWR from 'swr';
import { apiFetcher } from '@/lib/api/swr-fetcher';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { showToast } from '@/lib/toast';

function matchesPath(pathname: string, href: string) {
  const normalized = href.replace(/\[.*?\]/g, '');
  return pathname === href || pathname.startsWith(`${normalized}/`) || pathname === normalized;
}

interface SidebarNavigationProps {
  items?: NavItem[];
  onNavigate?: () => void;
  collapsed?: boolean;
}

const NavNode: React.FC<{
  item: NavItem;
  depth: number;
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  badgeCount?: number;
}> = ({ item, depth, pathname, onNavigate, collapsed = false, badgeCount = 0 }) => {
  const Icon = item.icon;
  const isActive = matchesPath(pathname, item.href);
  const hasChildren = Boolean(item.children?.length);
  const showBadge = item.href === '/new/assess' && badgeCount > 0;
  const badgeValue = badgeCount > 99 ? '99+' : String(badgeCount);

  return (
    <div className="space-y-1">
      {collapsed && depth === 0 ? (
        <Tooltip
          content={
            <span>
              <span className="font-semibold">{item.title}</span>
              {item.description ? <span className="block opacity-80">{item.description}</span> : null}
            </span>
          }
        >
          <Link
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-clash-gold/20 text-white shadow-[0_0_25px_rgba(255,204,112,0.2)]'
                : 'text-slate-300 hover:text-white hover:bg-white/5',
              depth > 0 && !collapsed && 'ml-3',
              collapsed && depth === 0 && 'justify-center px-2'
            )}
            aria-label={item.title}
          >
            {Icon && (
              <span className="relative flex h-4 w-4 flex-shrink-0 items-center justify-center">
                <Icon className="h-4 w-4" aria-hidden />
                {showBadge && collapsed && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
                )}
              </span>
            )}
            <span className={cn('truncate', collapsed && 'hidden')}>{item.title}</span>
            {showBadge && !collapsed && (
              <span className="ml-auto inline-flex items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-100">
                {badgeValue}
              </span>
            )}
          </Link>
        </Tooltip>
      ) : (
        <Link
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-clash-gold/20 text-white shadow-[0_0_25px_rgba(255,204,112,0.2)]'
              : 'text-slate-300 hover:text-white hover:bg-white/5',
            depth > 0 && !collapsed && 'ml-3',
            collapsed && depth === 0 && 'justify-center px-2'
          )}
        >
        {Icon && (
          <span className="relative flex h-4 w-4 flex-shrink-0 items-center justify-center">
            <Icon className="h-4 w-4" aria-hidden />
            {showBadge && collapsed && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
            )}
          </span>
        )}
        <span className={cn('truncate', collapsed && 'hidden')}>{item.title}</span>
        {showBadge && !collapsed && (
          <span className="ml-auto inline-flex items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-100">
            {badgeValue}
          </span>
        )}
      </Link>
      )}

      {hasChildren && !collapsed && (
        <div className="space-y-1 border-l border-white/5 pl-3">
          {item.children?.map((child, index) => (
            <NavNode
              key={`${child.href}-${child.title}-${index}`}
              item={child}
              depth={depth + 1}
              pathname={pathname}
              onNavigate={onNavigate}
              collapsed={collapsed}
              badgeCount={badgeCount}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({ items = navConfig, onNavigate, collapsed = false }) => {
  const pathname = usePathname();
  const clanTag = useMemo(() => normalizeTag(cfg.homeClanTag || '') || cfg.homeClanTag || '', []);
  const joinerKey = clanTag
    ? `/api/joiners?clanTag=${encodeURIComponent(clanTag)}&status=pending`
    : null;

  const { data: pendingJoiners } = useSWR<any[]>(joinerKey, apiFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: 60000,
  });

  const pendingAssessCount = Array.isArray(pendingJoiners) ? pendingJoiners.length : 0;

  useEffect(() => {
    if (!clanTag) return;
    const storageKey = `assess:pending:${clanTag}`;
    const stored = sessionStorage.getItem(storageKey);
    if (stored !== null) {
      const previous = Number(stored);
      if (Number.isFinite(previous) && pendingAssessCount > previous) {
        const label = pendingAssessCount === 1 ? 'joiner' : 'joiners';
        showToast(`${pendingAssessCount} new ${label} need review.`, 'info');
      }
    }
    sessionStorage.setItem(storageKey, String(pendingAssessCount));
  }, [pendingAssessCount, clanTag]);

  return (
    <nav className="space-y-2" data-testid="sidebar-navigation">
      {items
        .filter((item) => !item.href.includes('['))
        .map((item, index) => (
          <NavNode
            key={`${item.href}-${item.title}-${index}`}
            item={item}
            depth={0}
            pathname={pathname}
            onNavigate={onNavigate}
            collapsed={collapsed}
            badgeCount={pendingAssessCount}
          />
        ))}
    </nav>
  );
};

export default SidebarNavigation;
