"use client";

import { useMemo, useState } from 'react';
import LeadershipGuard from '@/components/LeadershipGuard';
import Card from '@/components/new-ui/Card';
import { Button } from '@/components/new-ui/Button';
import PermissionManager from '@/components/settings/PermissionManager';
import AccessManager from '@/components/AccessManager';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';
import { useLeadership } from '@/hooks/useLeadership';
import { useRosterData } from '@/app/new/roster/useRosterData';

export default function LeadershipAccessPage() {
  const { permissions } = useLeadership();
  const { data } = useRosterData();
  const [showAccessManager, setShowAccessManager] = useState(false);

  const clanTag = useMemo(() => {
    const fallback = cfg.homeClanTag || '';
    return normalizeTag(fallback) || fallback;
  }, []);

  const clanName =
    data?.clanName ||
    data?.meta?.clanName ||
    clanTag ||
    'Clan';

  return (
    <LeadershipGuard requiredPermission="canViewLeadershipFeatures">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                Access & Permissions
              </h1>
              <p className="text-sm text-slate-400">
                Control who can access sensitive features and customize per-role permissions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                tone="primary"
                onClick={() => setShowAccessManager(true)}
                disabled={!permissions.canManageAccess || !clanTag}
              >
                Manage Access
              </Button>
            </div>
          </div>
          {!clanTag && (
            <div className="mt-4 text-sm text-rose-300">
              Missing clan tag. Set a home clan before managing access.
            </div>
          )}
        </Card>

        {clanTag ? (
          <PermissionManager clanTag={clanTag} />
        ) : (
          <Card>
            <div className="text-sm text-slate-400">
              Set a home clan to manage access permissions.
            </div>
          </Card>
        )}

        {showAccessManager && clanTag && (
          <AccessManager
            clanTag={clanTag}
            clanName={clanName}
            onClose={() => setShowAccessManager(false)}
          />
        )}
      </div>
    </LeadershipGuard>
  );
}
