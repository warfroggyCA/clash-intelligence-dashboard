"use client";

import React, { useMemo } from 'react';
import { GlassCard } from '@/components/ui';
import { useDashboardStore } from '@/lib/stores/dashboard-store';

export default function TournamentCard() {
  const roster = useDashboardStore((s) => s.roster);
  const snapshot = useDashboardStore((s) => s.snapshotMetadata);

  const seasonId = roster?.seasonId || snapshot?.seasonId || null;
  const defenseSnapshotAt = (snapshot as any)?.defenseSnapshotTimestamp || null;

  const avgRanked = useMemo(() => {
    const members = roster?.members || [];
    if (!members.length) return null;
    const sum = members.reduce((acc, m: any) => acc + (m.rankedTrophies ?? m.trophies ?? 0), 0);
    return Math.round(sum / members.length);
  }, [roster]);

  // Show only when we can at least identify season or avg trophies
  if (!seasonId && avgRanked == null) {
    return null;
  }

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-400">Weekly Tournament</p>
          <div className="mt-1 text-slate-100">
            {seasonId ? <div className="text-sm">Season: <span className="font-semibold">{seasonId}</span></div> : null}
            {avgRanked != null ? <div className="text-sm">Avg Ranked Trophies: <span className="font-semibold">{avgRanked.toLocaleString()}</span></div> : null}
            {defenseSnapshotAt ? (
              <div className="text-xs text-slate-400">Defense snapshot: {new Date(defenseSnapshotAt).toLocaleString()}</div>
            ) : null}
          </div>
        </div>
        <div className="text-xs text-slate-400">
          <div>Attacks Remaining: <span className="text-slate-200">—</span></div>
          <div>Group Rank: <span className="text-slate-200">—</span></div>
        </div>
      </div>
    </GlassCard>
  );
}

