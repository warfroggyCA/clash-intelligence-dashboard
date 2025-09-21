"use client";

import React, { useMemo } from "react";
import { useDashboardStore, selectors } from "@/lib/stores/dashboard-store";
import { safeLocaleString } from '@/lib/date';

const sectionClass =
  "bg-white/90 backdrop-blur-sm border border-white/40 rounded-2xl shadow-lg p-6 flex flex-col gap-4";

const titleClass = "text-xl font-semibold text-gray-800";
const subtitleClass = "text-sm text-gray-500";

export default function ClanAnalytics() {
  const snapshotMetadata = useDashboardStore(selectors.snapshotMetadata);
  const snapshotDetails = useDashboardStore(selectors.snapshotDetails);
  const roster = useDashboardStore((state) => state.roster);
  const snapshotAgeHours = useDashboardStore(selectors.dataAge);

  const memberCount = snapshotMetadata?.memberCount ?? roster?.members?.length ?? 0;

  const warLog = useMemo(() => snapshotDetails?.warLog ?? [], [snapshotDetails?.warLog]);
  const capitalSeasons = useMemo(
    () => snapshotDetails?.capitalRaidSeasons ?? [],
    [snapshotDetails?.capitalRaidSeasons]
  );

  const { winRate, lastWars } = useMemo(() => {
    if (!warLog.length) {
      return { winRate: null as number | null, lastWars: [] as typeof warLog };
    }
    const wins = warLog.filter((w) => w.result === "WIN").length;
    const rate = Math.round((wins / warLog.length) * 100);
    return {
      winRate: rate,
      lastWars: warLog.slice(0, 5),
    };
  }, [warLog]);

  const capitalTotals = useMemo(() => {
    if (!capitalSeasons.length) {
      return {
        offensive: 0,
        defensive: 0,
        latest: [] as typeof capitalSeasons,
      };
    }
    const offensive = capitalSeasons.reduce((sum, season) => sum + (season.offensiveLoot || 0), 0);
    const defensive = capitalSeasons.reduce((sum, season) => sum + (season.defensiveLoot || 0), 0);
    return {
      offensive,
      defensive,
      latest: capitalSeasons.slice(0, 3),
    };
  }, [capitalSeasons]);

  const freshnessLabel = useMemo(() => {
    if (!snapshotMetadata?.fetchedAt) return "Unknown";
    if (snapshotAgeHours == null) return "Unknown";
    if (snapshotAgeHours <= 24) return "Fresh (≤24h)";
    if (snapshotAgeHours <= 48) return "Stale (24-48h)";
    return "Outdated (>48h)";
  }, [snapshotMetadata?.fetchedAt, snapshotAgeHours]);

  return (
    <div className="space-y-8">
      {/* Snapshot Overview */}
      <section className={sectionClass}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className={titleClass}>Snapshot Overview</h2>
            <p className={subtitleClass}>Data captured nightly from the Clash of Clans API</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-600">Freshness</p>
            <p className="text-lg font-semibold text-indigo-600">{freshnessLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <MetricCard label="Snapshot Date" value={snapshotMetadata?.snapshotDate || 'Unknown'} />
          <MetricCard label="Fetched At" value={safeLocaleString(snapshotMetadata?.fetchedAt, {
            fallback: 'Unknown',
            context: 'ClanAnalytics snapshotMetadata.fetchedAt'
          })} />
          <MetricCard label="Members" value={memberCount.toString()} />
          <MetricCard label="Version" value={snapshotMetadata?.version || 'N/A'} />
        </div>
      </section>

      {/* Current War + Recent Wars */}
      <section className={sectionClass}>
        <h2 className={titleClass}>War Performance</h2>
        {snapshotDetails?.currentWar ? (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">Current War</p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm text-gray-700">
              <div>
                <p className="text-xs text-gray-500">State</p>
                <p className="font-semibold text-gray-800">{snapshotDetails.currentWar.state || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Team Size</p>
                <p className="font-semibold text-gray-800">{snapshotDetails.currentWar.teamSize ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Opponent</p>
                <p className="font-semibold text-gray-800">
                  {snapshotDetails.currentWar.opponent ? `${snapshotDetails.currentWar.opponent.name} (${snapshotDetails.currentWar.opponent.tag})` : 'Unknown'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Ends</p>
                <p className="font-semibold text-gray-800">
                  {safeLocaleString(snapshotDetails.currentWar.endTime, {
                    fallback: 'Unknown',
                    context: 'ClanAnalytics currentWar.endTime'
                  })}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No current war data available.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MetricCard
            label="War Win Rate"
            value={winRate != null ? `${winRate}%` : 'N/A'}
            description={warLog.length ? `${warLog.length} wars analyzed` : 'No war history recorded'}
          />
          <MetricCard
            label="Recent War Performance"
            value={warLog.length ? `${lastWars.filter(w => w.result === 'WIN').length} wins / ${lastWars.length}` : 'N/A'}
            description="Last 5 wars"
          />
        </div>

        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recent War Log</h3>
          {lastWars.length ? (
            <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 overflow-hidden">
              {lastWars.map((war, index) => (
                <div key={`${war.endTime}-${index}`} className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white">
                  <div className="flex items-center gap-3">
                    <span className={`text-lg ${war.result === 'WIN' ? 'text-green-600' : war.result === 'LOSE' ? 'text-red-600' : 'text-gray-500'}`}>
                      {war.result === 'WIN' ? '✅' : war.result === 'LOSE' ? '❌' : '❓'}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-800">{war.opponent?.name || 'Unknown Opponent'}</p>
                      <p className="text-xs text-gray-500">{war.endTime ? (() => {
                        try {
                          if (typeof war.endTime !== 'string' || war.endTime.includes('U') || war.endTime.includes('u')) {
                            console.error('Invalid date string contains U character:', war.endTime);
                            return 'Invalid Date';
                          }
                          const date = new Date(war.endTime);
                          if (isNaN(date.getTime())) {
                            console.error('Invalid date object created from:', war.endTime);
                            return 'Invalid Date';
                          }
                          return date.toLocaleDateString();
                        } catch (error) {
                          console.error('Date formatting error:', error, 'Input:', war.endTime);
                          return 'Invalid Date';
                        }
                      })() : 'Unknown Date'} • Team Size {war.teamSize}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {war.attacksPerMember ? `${war.attacksPerMember} attacks per member` : 'Attacks data unavailable'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No war history available.</p>
          )}
        </div>
      </section>

      {/* Capital Raid Summary */}
      <section className={sectionClass}>
        <h2 className={titleClass}>Capital Raid Performance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Total Offensive Loot"
            value={capitalTotals.offensive.toLocaleString()}
            description="Across recorded seasons"
          />
          <MetricCard
            label="Total Defensive Reward"
            value={capitalTotals.defensive.toLocaleString()}
            description="Across recorded seasons"
          />
          <MetricCard
            label="Seasons Tracked"
            value={capitalSeasons.length.toString()}
            description="Capital raid history"
          />
        </div>

        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recent Seasons</h3>
          {capitalTotals.latest.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {capitalTotals.latest.map((season, index) => (
                <div key={`${season.endTime}-${index}`} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Season End</p>
                  <p className="text-sm font-semibold text-slate-800">{season.endTime ? (() => {
                    try {
                      if (typeof season.endTime !== 'string' || season.endTime.includes('U') || season.endTime.includes('u')) {
                        console.error('Invalid date string contains U character:', season.endTime);
                        return 'Invalid Date';
                      }
                      const date = new Date(season.endTime);
                      if (isNaN(date.getTime())) {
                        console.error('Invalid date object created from:', season.endTime);
                        return 'Invalid Date';
                      }
                      return date.toLocaleDateString();
                    } catch (error) {
                      console.error('Date formatting error:', error, 'Input:', season.endTime);
                      return 'Invalid Date';
                    }
                  })() : 'Unknown Date'}</p>
                  <div className="mt-2 text-xs text-slate-600 space-y-1">
                    <p>Hall Level {season.capitalHallLevel}</p>
                    <p>State: {season.state || 'Unknown'}</p>
                    <p>Off: {season.offensiveLoot?.toLocaleString() ?? '0'}</p>
                    <p>Def: {season.defensiveLoot?.toLocaleString() ?? '0'}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No capital raid data available.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, description }: { label: string; value: string; description?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-800">{value}</p>
      {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
    </div>
  );
}
