"use client";

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { LeadershipOnly } from '@/components/LeadershipGuard';
import { QuickActions } from '@/components/layout/QuickActions';
import IngestionMonitor from '@/components/layout/IngestionMonitor';
import { Button } from '@/components/ui';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';

export default function LeadershipDashboard() {
  const roster = useDashboardStore((state) => state.roster);
  const loadRoster = useDashboardStore((state) => state.loadRoster);
  const clanTag = useDashboardStore((state) => state.clanTag || state.homeClan || cfg.homeClanTag);
  const clanDisplayName = roster?.clanName || roster?.meta?.clanName || '...Heck Yeah...';
  const [showIngestionMonitor, setShowIngestionMonitor] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (roster || !clanTag) return;
    loadRoster(normalizeTag(clanTag)).catch((err) => {
      console.error('[LeadershipDashboard] Failed to load clan roster', err);
    });
  }, [roster, clanTag, loadRoster]);

  const leadershipSummary = useMemo(() => {
    if (!roster) return null;
    return {
      memberCount: roster.members.length,
      updatedAt: roster.date,
      clanTag: roster.clanTag,
    };
  }, [roster]);

  return (
    <LeadershipOnly className="min-h-screen w-full">
      <DashboardLayout clanName={clanDisplayName} hideNavigation>
        <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 py-8 space-y-8">
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 backdrop-blur-sm rounded-2xl p-8 border border-blue-500/20 shadow-2xl">
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-8">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl shadow-lg">
                  ⚙️
                </div>
                <div>
                  <h1
                    className="text-4xl sm:text-5xl font-bold text-white mb-2"
                    style={{ fontFamily: "'Clash Display', sans-serif" }}
                  >
                    Leadership Dashboard
                  </h1>
                  <div className="flex flex-wrap items-center gap-2 text-blue-200 font-mono text-sm">
                    <span>{clanDisplayName}</span>
                    <span className="text-blue-400">•</span>
                    <span>{leadershipSummary?.clanTag || normalizeTag(clanTag || '')}</span>
                  </div>
                  <p className="mt-3 text-sm text-blue-100/80 max-w-2xl">
                    Manual utilities for keepers of the roster. Use these controls for spot refreshes, exports, and
                    ingestion checks while the public dashboard stays lightweight.
                  </p>
                </div>
              </div>
              {leadershipSummary && (
                <div className="grid grid-cols-1 gap-3 text-sm text-blue-100/80 sm:grid-cols-3 xl:text-right">
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-xs uppercase tracking-wider text-blue-200/70">Members</div>
                    <div className="text-2xl font-semibold text-white">
                      {leadershipSummary.memberCount}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-xs uppercase tracking-wider text-blue-200/70">Last Snapshot</div>
                    <div className="text-base text-white">
                      {new Date(leadershipSummary.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-xs uppercase tracking-wider text-blue-200/70">Manual Jobs</div>
                    <div className="text-base text-white">
                      {activeJobId ? `Monitoring ${activeJobId}` : 'None active'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 bg-gray-900/60 border border-gray-700/60 rounded-2xl p-6 shadow-inner">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
                  <p className="text-sm text-blue-100/70">
                    Trigger on-demand refreshes, exports, or insights when the automated cadence needs a nudge.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <QuickActions className="!border-transparent !bg-gray-900/80 !text-slate-100 shadow-[0_12px_30px_-20px_rgba(8,15,31,0.6)]" />
              </div>
            </div>

            <div className="bg-gray-900/60 border border-gray-700/60 rounded-2xl p-6 shadow-inner">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Ingestion Monitor</h2>
                  <p className="text-sm text-blue-100/70">
                    Inspect job history or launch a manual ingestion run when data looks stale.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {showIngestionMonitor ? (
                    <Button variant="ghost" onClick={() => setShowIngestionMonitor(false)}>
                      Close
                    </Button>
                  ) : (
                    <Button onClick={() => setShowIngestionMonitor(true)}>Open</Button>
                  )}
                </div>
              </div>
              <div className="mt-4">
                {showIngestionMonitor ? (
                  <IngestionMonitor
                    jobId={activeJobId}
                    onClose={() => setShowIngestionMonitor(false)}
                    onJobIdChange={setActiveJobId}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-600/60 bg-gray-800/60 px-4 py-6 text-sm text-blue-100/70">
                    Monitor is idle. Open it to view job history or kick off a refresh.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-900/60 border border-gray-700/60 rounded-2xl p-6 shadow-inner">
            <h2 className="text-xl font-semibold text-white">Coming Soon</h2>
            <p className="text-sm text-blue-100/70">
              Additional leadership tooling will migrate here so the everyday roster view stays simple.
            </p>
            <div className="mt-4 grid gap-3 text-sm text-blue-100/80 md:grid-cols-2 xl:grid-cols-4">
              {[
                '⏳ Departure manager & roster change review',
                '⏳ Access management console',
                '⏳ Discord publishing & insights summaries',
                '⏳ War prep scheduling & alerts',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </LeadershipOnly>
  );
}
