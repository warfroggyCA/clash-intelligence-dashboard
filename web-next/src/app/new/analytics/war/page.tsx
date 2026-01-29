"use client";

import LeadershipGuard from '@/components/LeadershipGuard';
import Card from '@/components/new-ui/Card';
import WarIntelligenceDashboard from '@/components/war/WarIntelligenceDashboard';

export default function WarAnalyticsPage() {
  return (
    <LeadershipGuard requiredPermission="canViewLeadershipFeatures">
      <div className="space-y-6">
        <Card>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
              War Performance
            </h1>
            <p className="text-sm text-slate-400">
              War intelligence and coaching signals built from the latest SSOT war history.
            </p>
          </div>
        </Card>

        <WarIntelligenceDashboard />
      </div>
    </LeadershipGuard>
  );
}
