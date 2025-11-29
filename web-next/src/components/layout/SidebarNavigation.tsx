"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navConfig, type NavItem } from '@/lib/nav-config';
import { cn } from '@/lib/utils';

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
}> = ({ item, depth, pathname, onNavigate, collapsed = false }) => {
  const Icon = item.icon;
  const isActive = matchesPath(pathname, item.href);
  const hasChildren = Boolean(item.children?.length);

  return (
    <div className="space-y-1">
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
        title={item.description || item.title}
      >
        {Icon && <Icon className="h-4 w-4 flex-shrink-0" aria-hidden />}
        <span className={cn('truncate', collapsed && 'hidden')}>{item.title}</span>
      </Link>

      {hasChildren && !collapsed && (
        <div className="space-y-1 border-l border-white/5 pl-3">
          {item.children?.map((child) => (
            <NavNode
              key={child.href}
              item={child}
              depth={depth + 1}
              pathname={pathname}
              onNavigate={onNavigate}
              collapsed={collapsed}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({ items = navConfig, onNavigate, collapsed = false }) => {
  const pathname = usePathname();

  return (
    <nav className="space-y-2" data-testid="sidebar-navigation">
      {items
        .filter((item) => !item.href.includes('['))
        .map((item) => (
          <NavNode key={item.href} item={item} depth={0} pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
        ))}
    </nav>
  );
};

export default SidebarNavigation;
