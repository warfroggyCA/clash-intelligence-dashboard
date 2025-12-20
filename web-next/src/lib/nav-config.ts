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
    href: '/new',
    icon: LayoutDashboard,
    description: 'At-a-glance roster status and key actions.',
    category: 'primary',
  },
  {
    title: 'Players',
    href: '/new/roster',
    icon: Users,
    description: 'Roster, assessments, database, and global search.',
    category: 'primary',
    children: [
      { title: 'Roster', href: '/new/roster', icon: Users, description: 'Current clan members with filters.' },
      { title: 'Assess', href: '#', icon: ListChecks, description: 'Evaluate new applicants.' },
      { title: 'Database', href: '/new/player-database', icon: ActivitySquare, description: 'History, notes, warnings.' },
      { title: 'Search', href: '#', icon: Search, description: 'Global player search across tags.' },
    ],
  },
  {
    title: 'War',
    href: '#',
    icon: Swords,
    description: 'Planning, active war monitoring, analytics, results.',
    category: 'primary',
    children: [
      { title: 'CWL', href: '/new/war/cwl', icon: Swords, description: 'Season overview, roster, and daily planners.' },
      { title: 'Planning', href: '#', icon: ListChecks, description: 'Create and manage war plans.' },
      { title: 'Active War', href: '#', icon: Shield, description: 'Live war status and calls.' },
      { title: 'Analytics', href: '#', icon: BarChart2, description: 'War performance insights.' },
      { title: 'Results', href: '#', icon: Shield, description: 'Post-war review and publishing.' },
    ],
  },
  {
    title: 'Analytics',
    href: '#',
    icon: BarChart2,
    description: 'Unified dashboards for war, capital, and members.',
    category: 'primary',
    children: [
      { title: 'War Performance', href: '#', icon: BarChart2, description: 'Clan-wide war trends.' },
      { title: 'Capital Raids', href: '#', icon: BarChart2, description: 'Capital contributions and raids.' },
      { title: 'Member Performance', href: '/new/member-performance', icon: ActivitySquare, description: 'Individual performance comparisons.' },
    ],
  },
  {
    title: 'Leadership',
    href: '#',
    icon: Shield,
    description: 'Permission-gated administrative tools.',
    category: 'admin',
    permission: 'leader',
  },
  {
    title: 'Settings',
    href: '#',
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
