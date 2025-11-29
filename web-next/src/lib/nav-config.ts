import {
  ActivitySquare,
  BarChart2,
  LayoutDashboard,
  ListChecks,
  Search,
  Settings,
  Shield,
  Swords,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavCategory = 'primary' | 'admin';

export interface NavItem {
  title: string;
  href: string;
  icon?: LucideIcon;
  description?: string;
  category?: NavCategory;
  permission?: 'leader' | 'member';
  children?: NavItem[];
}

export interface NavItemWithMeta extends NavItem {
  parents: string[];
  depth: number;
}

export const navConfig: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/app',
    icon: LayoutDashboard,
    description: 'At-a-glance roster status and key actions.',
    category: 'primary',
  },
  {
    title: 'Players',
    href: '/players',
    icon: Users,
    description: 'Roster, assessments, database, and global search.',
    category: 'primary',
    children: [
      { title: 'Roster', href: '/players/roster', icon: Users, description: 'Current clan members with filters.' },
      { title: 'Assess', href: '/players/assess', icon: ListChecks, description: 'Evaluate new applicants.' },
      { title: 'Database', href: '/players/database', icon: ActivitySquare, description: 'History, notes, warnings.' },
      { title: 'Search', href: '/players/search', icon: Search, description: 'Global player search across tags.' },
    ],
  },
  {
    title: 'War',
    href: '/war',
    icon: Swords,
    description: 'Planning, active war monitoring, analytics, results.',
    category: 'primary',
    children: [
      { title: 'Planning', href: '/war/planning', icon: ListChecks, description: 'Create and manage war plans.' },
      { title: 'Active War', href: '/war/active', icon: Shield, description: 'Live war status and calls.' },
      { title: 'Analytics', href: '/war/analytics', icon: BarChart2, description: 'War performance insights.' },
      { title: 'Results', href: '/war/results', icon: Shield, description: 'Post-war review and publishing.' },
    ],
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: BarChart2,
    description: 'Unified dashboards for war, capital, and members.',
    category: 'primary',
    children: [
      { title: 'War Performance', href: '/analytics/war', icon: BarChart2, description: 'Clan-wide war trends.' },
      { title: 'Capital Raids', href: '/analytics/capital', icon: BarChart2, description: 'Capital contributions and raids.' },
      { title: 'Member Performance', href: '/analytics/player', icon: ActivitySquare, description: 'Individual performance comparisons.' },
    ],
  },
  {
    title: 'Leadership',
    href: '/leadership',
    icon: Shield,
    description: 'Permission-gated administrative tools.',
    category: 'admin',
    permission: 'leader',
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Clan configuration, preferences, and access control.',
    category: 'admin',
  },
];

export const legacyRedirects: Record<string, string> = {
  '/simple-roster': '/app',
  '/simple-player/[tag]': '/players/[tag]',
  '/player/[tag]': '/players/[tag]',
  '/player-database': '/players/database',
  '/war-analytics': '/war/analytics',
  '/capital-analytics': '/analytics/capital',
};

export function flattenNav(items: NavItem[] = navConfig, parents: string[] = []): NavItemWithMeta[] {
  return items.flatMap((item) => {
    const current: NavItemWithMeta = {
      ...item,
      parents,
      depth: parents.length,
    };
    const childParents = [...parents, item.href];
    const children = item.children ? flattenNav(item.children, childParents) : [];
    return [current, ...children];
  });
}
