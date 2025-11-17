"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Save, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AccessLevel, ACCESS_LEVEL_PERMISSIONS, getAccessLevelDisplayName } from '@/lib/access-management';
import GlassCard from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/lib/toast';
import { cfg } from '@/lib/config';
import { useLeadership } from '@/hooks/useLeadership';
import type { PermissionKey, PermissionSet, CustomPermissions } from '@/lib/access/permission-types';

const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  canViewRoster: 'View clan roster and member list',
  canViewBasicStats: 'View basic player statistics',
  canAccessDiscordPublisher: 'Access Discord webhook publishing',
  canGenerateCoachingInsights: 'Generate coaching insights',
  canManageChangeDashboard: 'Manage change dashboard (joiner/departure alerts)',
  canModifyClanData: 'Modify clan data (notes, warnings, tenure)',
  canManageAccess: 'Manage user access and permissions',
  canViewSensitiveData: 'View sensitive data (notes, warnings, departure reasons)',
  canViewLeadershipFeatures: 'View leadership-only features',
  canViewAuditLog: 'View audit log of all changes made by leadership',
  canViewWarPrep: 'Access the War Prep workspace and read saved plans',
  canManageWarPlans: 'Modify war plans (select rosters, save or delete plans)',
  canRunWarAnalysis: 'Run matchup analysis and queue AI briefings',
};

const PERMISSION_GROUPS: Array<{ label: string; permissions: PermissionKey[] }> = [
  {
    label: 'Basic Access',
    permissions: ['canViewRoster', 'canViewBasicStats'],
  },
  {
    label: 'Leadership Features',
    permissions: ['canViewLeadershipFeatures', 'canViewSensitiveData', 'canManageChangeDashboard'],
  },
  {
    label: 'Data Management',
    permissions: ['canModifyClanData', 'canManageAccess', 'canViewAuditLog'],
  },
  {
    label: 'Advanced Features',
    permissions: ['canAccessDiscordPublisher', 'canGenerateCoachingInsights'],
  },
  {
    label: 'War Planning',
    permissions: ['canViewWarPrep', 'canManageWarPlans', 'canRunWarAnalysis'],
  },
];

interface PermissionManagerProps {
  clanTag: string;
  className?: string;
}

export default function PermissionManager({ clanTag, className }: PermissionManagerProps) {
  const { permissions, check } = useLeadership();
  const [customPermissions, setCustomPermissions] = useState<CustomPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const loadCustomPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/access/permissions?clanTag=${encodeURIComponent(clanTag)}`, {
        credentials: 'same-origin',
      });
      
      if (!response.ok) {
        // Handle HTTP errors (403, 404, 500, etc.)
        let errorMessage = `Server error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response isn't JSON, use status text
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (data.success && data.data?.customPermissions) {
        setCustomPermissions(data.data.customPermissions);
      } else {
        setCustomPermissions(null);
      }
    } catch (error: any) {
      console.error('Failed to load custom permissions:', error);
      const errorMessage = error.message || 'Failed to load permissions';
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [clanTag]);

  // Load custom permissions on mount when access is available
  useEffect(() => {
    if (permissions.canManageAccess && check.isLeader) {
      void loadCustomPermissions();
    }
  }, [permissions.canManageAccess, check.isLeader, loadCustomPermissions]);

  // Only Leaders can access this
  if (!permissions.canManageAccess || !check.isLeader) {
    return (
      <GlassCard
        title="Permission Manager"
        subtitle="Access Denied"
        className={className}
      >
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-brand-text-secondary">
            Only clan Leaders can manage permissions. Co-Leaders and other roles cannot modify permission settings.
          </p>
        </div>
      </GlassCard>
    );
  }

  const getEffectivePermissions = (level: AccessLevel): PermissionSet => {
    const defaults = ACCESS_LEVEL_PERMISSIONS[level];
    const custom = customPermissions?.[level];
    
    if (!custom) {
      return defaults;
    }
    
    // Merge custom overrides with defaults
    return { ...defaults, ...custom };
  };

  const togglePermission = (level: AccessLevel, permission: PermissionKey) => {
    const current = getEffectivePermissions(level);
    const newValue = !current[permission];
    
    setCustomPermissions((prev) => {
      const updated = { ...prev };
      if (!updated[level]) {
        updated[level] = {};
      }
      updated[level] = { ...updated[level], [permission]: newValue };
      return updated;
    });
    
    setHasChanges(true);
    setSaveStatus('idle');
  };

  const resetToDefaults = () => {
    if (confirm('Reset all permissions to defaults? This will discard all custom changes.')) {
      setCustomPermissions(null);
      setHasChanges(false);
      setSaveStatus('idle');
    }
  };

  const savePermissions = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/access/permissions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clanTag,
          customPermissions: customPermissions || {},
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Handle HTTP errors (403, 404, 500, etc.)
        const errorMessage = data.error || `Server error: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      if (data.success) {
        setHasChanges(false);
        setSaveStatus('success');
        showToast('Permissions saved successfully', 'success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        throw new Error(data.error || 'Failed to save permissions');
      }
    } catch (error: any) {
      console.error('Failed to save permissions:', error);
      setSaveStatus('error');
      const errorMessage = error.message || 'Failed to save permissions. Please check the console for details.';
      showToast(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <GlassCard
        title="Permission Manager"
        subtitle="Loading permissions..."
        className={className}
      >
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-brand-text-secondary" />
        </div>
      </GlassCard>
    );
  }

  const allLevels: AccessLevel[] = ['viewer', 'member', 'elder', 'coleader', 'leader'];
  const isUsingDefaults = customPermissions === null || Object.keys(customPermissions).length === 0;

  return (
    <GlassCard
      title="Permission Manager"
      subtitle="Customize permissions for each access level. Changes apply immediately."
      className={className}
      actions={
        <div className="flex items-center gap-2">
          {isUsingDefaults && (
            <span className="text-xs text-brand-text-tertiary flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Using defaults
            </span>
          )}
          {hasChanges && (
            <span className="text-xs text-amber-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Unsaved changes
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={resetToDefaults}
            disabled={isUsingDefaults || saving}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={savePermissions}
            disabled={!hasChanges || saving}
            className="flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      }
    >
      {saveStatus === 'success' && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
          ✅ Permissions saved successfully
        </div>
      )}

      {saveStatus === 'error' && (
        <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-100">
          ❌ Failed to save permissions. Please try again.
        </div>
      )}

      <div className="space-y-6">
        {/* Permission Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-text-secondary uppercase tracking-wider">
                  Permission
                </th>
                {allLevels.map((level) => (
                  <th
                    key={level}
                    className="px-4 py-3 text-center text-xs font-semibold text-brand-text-secondary uppercase tracking-wider min-w-[100px]"
                  >
                    {getAccessLevelDisplayName(level)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50">
              {PERMISSION_GROUPS.map((group) => (
                <React.Fragment key={group.label}>
                  <tr className="bg-brand-surfaceSubtle/70">
                    <td
                      colSpan={allLevels.length + 1}
                      className="px-4 py-2 text-[11px] font-semibold text-brand-text-secondary uppercase tracking-[0.4em] border-y border-brand-border/60"
                    >
                      {group.label}
                    </td>
                  </tr>
                  {group.permissions.map((permission) => {
                    const description = PERMISSION_DESCRIPTIONS[permission];
                    return (
                      <tr key={permission} className="hover:bg-brand-surface-hover/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col border-l border-brand-border/40 pl-4">
                            <span className="text-sm font-semibold text-brand-text-primary">
                              {permission.replace(/can([A-Z])/g, '$1').replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <span className="text-xs text-brand-text-tertiary mt-0.5">{description}</span>
                          </div>
                        </td>
                        {allLevels.map((level) => {
                          const effective = getEffectivePermissions(level);
                          const isCustom = customPermissions?.[level]?.[permission] !== undefined;
                          const isEnabled = effective[permission];
                          
                          return (
                            <td key={level} className="px-4 py-3 text-center">
                              <button
                                onClick={() => togglePermission(level, permission)}
                                className={`
                                  relative inline-flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all
                                  ${isEnabled
                                    ? isCustom
                                      ? 'border-blue-500/70 bg-blue-500/25 text-blue-300 hover:bg-blue-500/35 ring-2 ring-blue-400/40'
                                      : 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                    : isCustom
                                      ? 'border-orange-500/70 bg-orange-500/25 text-orange-300 hover:bg-orange-500/35 ring-2 ring-orange-400/40'
                                      : 'border-red-500/50 bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  }
                                `}
                                title={`${isEnabled ? 'Disable' : 'Enable'} for ${getAccessLevelDisplayName(level)}${isCustom ? ' (custom override)' : ' (default)'}`}
                              >
                                {isEnabled ? '✓' : '✗'}
                                {isCustom && (
                                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-900" title="Custom override" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="rounded-lg border border-brand-border bg-brand-surface-secondary/50 p-4">
          <h4 className="text-sm font-semibold text-brand-text-primary mb-3">Legend</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6 rounded border-2 border-emerald-500/50 bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                ✓
              </div>
              <span className="text-brand-text-secondary">Enabled (default)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6 rounded border-2 border-red-500/50 bg-red-500/20 flex items-center justify-center text-red-400">
                ✗
              </div>
              <span className="text-brand-text-secondary">Disabled (default)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6 rounded border-2 border-blue-500/70 bg-blue-500/25 ring-2 ring-blue-400/40 flex items-center justify-center text-blue-300">
                ✓
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-slate-900" />
              </div>
              <span className="text-brand-text-secondary">Custom override (enabled)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6 rounded border-2 border-orange-500/70 bg-orange-500/25 ring-2 ring-orange-400/40 flex items-center justify-center text-orange-300">
                ✗
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-slate-900" />
              </div>
              <span className="text-brand-text-secondary">Custom override (disabled)</span>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">Important Notes:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Changes take effect immediately after saving</li>
                <li>Custom permissions override defaults for that access level</li>
                <li>Some permissions may be required for certain features to work</li>
                <li>Leaders always have full access regardless of custom permissions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
