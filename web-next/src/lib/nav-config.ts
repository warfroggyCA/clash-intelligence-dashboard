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
    description: 'At-a-glance roster status, Command Center, and key actions.',
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
      { title: 'Assess', href: '/new/assess', icon: ListChecks, description: 'Evaluate new applicants.' },
      { title: 'Database', href: '/new/player-database', icon: ActivitySquare, description: 'History, notes, warnings.' },
      { title: 'Search', href: '/new/search', icon: Search, description: 'Search site features and shortcuts.' },
    ],
  },
  {
    title: 'War',
    href: '#',
    icon: Swords,
    description: 'Planning, active war monitoring, analytics, results.',
    category: 'primary',
    children: [
      {
        title: 'CWL',
        href: '/new/war/cwl/setup',
        icon: Swords,
        description: 'Season setup, roster, and daily planners.',
        children: [
          { title: 'Setup', href: '/new/war/cwl/setup', icon: ListChecks, description: 'Set war size and opponents.' },
          { title: 'Season Roster', href: '/new/war/cwl/roster', icon: Users, description: 'Pick weekly eligible players.' },
          { title: 'Day Planner', href: '/new/war/cwl/day/1', icon: Swords, description: 'Plan daily lineups and matchups.' },
        ],
      },
      {
        title: 'Clan War',
        href: '#',
        icon: Swords,
        description: 'Classic war planning and results.',
        children: [
          { title: 'Planning', href: '#', icon: ListChecks, description: 'Create and manage war plans.' },
          { title: 'Active War', href: '#', icon: Shield, description: 'Live war status and calls.' },
          { title: 'Results', href: '#', icon: Shield, description: 'Post-war review and publishing.' },
        ],
      },
    ],
  },
  {
    title: 'Analytics',
    href: '#',
    icon: BarChart2,
    description: 'Unified dashboards for war, capital, and members.',
    category: 'primary',
    children: [
      { title: 'War Performance', href: '/new/analytics/war', icon: BarChart2, description: 'Clan-wide war trends.' },
      { title: 'Capital Raids', href: '/new/capital-raids', icon: BarChart2, description: 'Capital contributions, raids, and gold analytics.' },
      { title: 'Member Performance', href: '/new/member-performance', icon: ActivitySquare, description: 'Individual performance comparisons and donation balance.' },
    ],
  },
  {
    title: 'Leadership',
    href: '/new/leadership',
    icon: Shield,
    description: 'Permission-gated administrative tools.',
    category: 'admin',
    permission: 'leader',
    children: [
      { title: 'Overview', href: '/new/leadership', icon: Shield, description: 'Leadership tool map.' },
      { title: 'Dashboard', href: '/new/leadership/dashboard', icon: Shield, description: 'Briefing, approvals, and ops.' },
      { title: 'Assessment', href: '/new/leadership/assessment', icon: ActivitySquare, description: 'Promotion and risk scoring.' },
      { title: 'Access & Permissions', href: '/new/leadership/access', icon: Shield, description: 'Manage access levels and permissions.' },
    ],
  },
  {
    title: 'War',
    href: '/new/war',
    icon: Swords,
    description: 'Active war planning and matchup analysis.',
    category: 'primary',
    children: [
      { title: 'Active War', href: '/new/war/active', icon: Swords, description: 'Live war planning board.' },
      { title: 'Planning', href: '/new/war/planning', icon: Swords, description: 'Opponent scouting + plan drafting.' },
      { title: 'Results', href: '/new/war/results', icon: BarChart2, description: 'War outcomes and performance.' },
    ],
  },
  {
    title: 'Settings',
    href: '/new/settings',
    icon: Settings,
    description: 'Clan configuration, alert thresholds, and personal preferences.',
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
