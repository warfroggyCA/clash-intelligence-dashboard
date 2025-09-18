"use client";

import { useMemo } from 'react';
import { useDashboardStore, selectors } from '@/lib/stores/dashboard-store';
import { safeLocaleDateString, safeLocaleTimeString } from '@/lib/date';

interface RosterStatsPanelProps {
  className?: string;
}

export const RosterStatsPanel: React.FC<RosterStatsPanelProps> = ({ className = '' }) => {
  const roster = useDashboardStore((state) => state.roster);
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const dataAgeHours = useDashboardStore(selectors.dataAge);
  const dataFetchedAt = useDashboardStore((state) => state.dataFetchedAt) || snapshotMetadata?.fetchedAt || null;

  const stats = useMemo(() => {
    if (!roster || !roster.members?.length) {
      return null;
    }

    const memberCount = roster.members.length;
    const averageTownHall = Math.round(
      roster.members.reduce((sum, member) => sum + (member.townHallLevel || member.th || 0), 0) /
        memberCount
    );
    const totalDonations = roster.members.reduce((sum, member) => sum + (member.donations || 0), 0);
    const averageTrophies = Math.round(
      roster.members.reduce((sum, member) => sum + (member.trophies || 0), 0) /
        memberCount
    );

    return {
      memberCount,
      averageTownHall,
      totalDonations,
      averageTrophies,
    };
  }, [roster]);

  if (!roster) {
    return null;
  }

  return (
    <aside className={`rounded-xl border border-slate-200 bg-white/90 backdrop-blur p-5 shadow-sm space-y-4 ${className}`}>
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-800">Roster Snapshot</div>
        <div className="text-xs text-slate-500">
          {snapshotMetadata?.snapshotDate ? (
            <>
              Snapshot {safeLocaleDateString(snapshotMetadata.snapshotDate, {
                fallback: snapshotMetadata.snapshotDate,
                context: 'RosterStatsPanel snapshotDate',
              })}
            </>
          ) : (
            <>{roster.source === 'live' ? 'Live data' : 'Snapshot data'}</>
          )}
        </div>
        {dataFetchedAt && (
          <div className="text-xs text-slate-400">
            Updated {safeLocaleTimeString(dataFetchedAt, { fallback: dataFetchedAt, context: 'RosterStatsPanel fetchedAt' })}
          </div>
        )}
        {typeof dataAgeHours === 'number' && (
          <span
            className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
              dataAgeHours <= 24
                ? 'bg-emerald-100 text-emerald-700'
                : dataAgeHours <= 48
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-700'
            }`}
          >
            {dataAgeHours <= 24
              ? 'Fresh data'
              : dataAgeHours <= 48
                ? 'Stale data'
                : 'Outdated data'}
          </span>
        )}
      </div>

      {stats ? (
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Members</div>
            <div className="text-lg font-semibold text-slate-900">{stats.memberCount}</div>
          </div>
          <div className="flex justify-between items-center rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-indigo-500">Avg Town Hall</div>
            <div className="text-lg font-semibold text-indigo-900">{stats.averageTownHall}</div>
          </div>
          <div className="flex justify-between items-center rounded-lg border border-purple-100 bg-purple-50 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-purple-500">Avg Trophies</div>
            <div className="text-lg font-semibold text-purple-900">{stats.averageTrophies}</div>
          </div>
          <div className="flex justify-between items-center rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-amber-600">Total Donations</div>
            <div className="text-lg font-semibold text-amber-700">
              {stats.totalDonations.toLocaleString()}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
          No roster metrics available yet.
        </div>
      )}
    </aside>
  );
};

export default RosterStatsPanel;
