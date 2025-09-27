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
  {
    id: 'changes',
    label: 'History',
    icon: '📜',
    description: 'Track roster changes and departures',
    requires: ({ permissions }) => permissions.canManageChangeDashboard,
  },
  {
    id: 'coaching',
    label: 'Insights',
    icon: '💡',
    description: 'Recommendations, spotlights, and coaching',
    requires: ({ check }) => check.isLeader,
  },
  {
    id: 'database',
    label: 'Player DB',
    icon: '🗄️',
    description: 'Player notes and archives',
    requires: ({ permissions }) => permissions.canViewLeadershipFeatures,
  },
  {
    id: 'applicants',
    label: 'Applicants',
    icon: '🎯',
    description: 'Evaluate potential clan members',
    requires: ({ permissions }) => permissions.canViewLeadershipFeatures,
  },
  {
    id: 'discord',
    label: 'Discord',
    icon: '📢',
    description: 'Publish reports to Discord',
    requires: ({ permissions }) => permissions.canAccessDiscordPublisher,
  },
];

export function getVisibleTabs(context: TabVisibilityContext): TabConfig[] {
  return TAB_CONFIGS.filter((tab) => !tab.requires || tab.requires(context));
}

export function tabIsVisible(tabId: TabType, context: TabVisibilityContext): boolean {
  return getVisibleTabs(context).some((tab) => tab.id === tabId);
}
