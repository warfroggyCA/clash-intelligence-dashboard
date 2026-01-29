"use client";

import LeadershipGuard from '@/components/LeadershipGuard';
import WarIntelligenceDashboard from '@/components/war/WarIntelligenceDashboard';

export default function WarResultsClient() {
  return (
    <LeadershipGuard requiredPermission="canViewLeadershipFeatures">
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-6 py-5">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400">War Results</div>
          <div className="text-2xl font-semibold text-white">Recent War Performance</div>
          <p className="mt-2 text-sm text-slate-400">
            Clan-wide war results and performance signals built from the SSOT war history.
          </p>
        </div>
        <WarIntelligenceDashboard />
      </div>
    </LeadershipGuard>
  );
}
