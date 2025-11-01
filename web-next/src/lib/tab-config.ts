import type { TabType } from '@/types';
import type { RolePermissions, LeadershipCheck } from '@/lib/leadership';

export interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
  description: string;
  requires?: (context: TabVisibilityContext) => boolean;
}

export interface TabVisibilityContext {
  permissions: RolePermissions;
  check: LeadershipCheck;
}

export const TAB_CONFIGS: TabConfig[] = [
  {
    id: 'roster',
    label: 'Dashboard',
    icon: '🛡️',
    description: 'Daily overview and roster',
  },
  // HIDDEN: These tabs use Zustand store and haven't been migrated yet
  // {
  //   id: 'changes',
  //   label: 'History',
  //   icon: '📜',
  //   description: 'Track roster changes and departures',
  //   requires: ({ permissions }) => permissions.canManageChangeDashboard,
  // },
  // {
  //   id: 'coaching',
  //   label: 'Command Center',
  //   icon: '🎯',
  //   description: 'Real-time intelligence and actionable alerts',
  //   requires: ({ permissions }) => permissions.canViewLeadershipFeatures,
  // },
  // {
  //   id: 'database',
  //   label: 'Player DB',
  //   icon: '🗄️',
  //   description: 'Player notes and archives',
  //   requires: ({ permissions }) => permissions.canViewLeadershipFeatures,
  // },
  {
    id: 'warplanning',
    label: 'War Planning',
    icon: '⚔️',
    description: 'Select lineups and analyze upcoming wars',
    requires: ({ permissions }) => permissions.canViewLeadershipFeatures,
  },
  {
    id: 'database',
    label: 'Player Database',
    icon: '🗄️',
    description: 'Player notes, warnings, and tenure records',
    requires: ({ permissions }) => permissions.canViewLeadershipFeatures,
  },
  {
    id: 'leadership',
    label: 'Leadership',
    icon: '👑',
    description: 'Leadership dashboards and initiatives',
    requires: ({ permissions }) => permissions.canViewLeadershipFeatures,
  },
  // {
  //   id: 'applicants',
  //   label: 'Applicants',
  //   icon: '🎯',
  //   description: 'Evaluate potential clan members',
  //   requires: ({ permissions }) => permissions.canViewLeadershipFeatures,
  // },
  // {
  //   id: 'discord',
  //   label: 'Discord',
  //   icon: '📢',
  //   description: 'Publish reports to Discord',
  //   requires: ({ permissions }) => permissions.canAccessDiscordPublisher,
  // },
];

export function getVisibleTabs(context: TabVisibilityContext): TabConfig[] {
  return TAB_CONFIGS.filter((tab) => !tab.requires || tab.requires(context));
}

export function tabIsVisible(tabId: TabType, context: TabVisibilityContext): boolean {
  return getVisibleTabs(context).some((tab) => tab.id === tabId);
}
