"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { LeadershipOnly } from '@/components/LeadershipGuard';
import { QuickActions } from '@/components/layout/QuickActions';
import IngestionMonitor from '@/components/layout/IngestionMonitor';
import ApplicantsPanel from '@/components/ApplicantsPanel';
import { Button } from '@/components/ui';
import { useDashboardStore } from '@/lib/stores/dashboard-store';
import { cfg } from '@/lib/config';
import { normalizeTag } from '@/lib/tags';

interface JoinerRecord {
  id: string;
  clan_tag: string;
  player_tag: string;
  detected_at: string;
  status: 'pending' | 'reviewed';
  metadata: Record<string, any>;
  history: any | null;
  notes: any[];
  warnings: any[];
}

interface HighlightItem {
  key: string;
  label: string;
  value: string;
  detail?: string | null;
  badge?: string | null;
}

function InsightList({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: HighlightItem[];
}) {
  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-800/50 p-4">
      <div className="text-xs uppercase tracking-wider text-blue-200/70">{title}</div>
      <p className="mt-1 text-xs text-blue-100/70">{subtitle}</p>
      {items.length ? (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1 text-sm text-blue-100">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-200">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                {item.detail ? (
                  <span className="text-xs text-blue-200/70">{item.detail}</span>
                ) : null}
              </div>
              <span className="whitespace-nowrap font-mono text-sm text-blue-200">{item.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-lg border border-dashed border-gray-600/60 bg-gray-900/40 px-3 py-4 text-sm text-blue-200/70">
          Enriched snapshot fields are still populating.
        </div>
      )}
    </div>
  );
}

function JoinerReviewCard({ clanTag }: { clanTag: string | null }) {
  const [loading, setLoading] = useState(false);
  const [joiners, setJoiners] = useState<JoinerRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadJoiners = useCallback(async () => {
    if (!clanTag) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/joiners?clanTag=${encodeURIComponent(clanTag)}&status=pending&days=7`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Failed to load joiners (${res.status})`);
      }
      setJoiners(data.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load joiner events');
    } finally {
      setLoading(false);
    }
  }, [clanTag]);

  useEffect(() => {
    void loadJoiners();
  }, [loadJoiners]);

  const handleMarkReviewed = async (id: string) => {
    try {
      const res = await fetch('/api/joiners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'reviewed' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to update joiner (${res.status})`);
      }
      setJoiners((existing) => existing.filter((joiner) => joiner.id !== id));
    } catch (err: any) {
      setError(err?.message || 'Failed to update joiner event');
    }
  };

  if (!clanTag) {
    return null;
  }

  return (
    <div className="bg-gray-900/60 border border-gray-700/60 rounded-2xl p-6 shadow-inner">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Recent Joiners
          </h2>
          <p className="text-sm text-blue-100/70">
            Review new members detected in the last 7 days.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => void loadJoiners()}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-200 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-blue-100/70">Loading joiners…</div>
      ) : joiners.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-700/70 bg-gray-800/60 px-4 py-6 text-sm text-blue-100/70">
          No pending joiners in the last week.
        </div>
      ) : (
        <div className="space-y-4">
          {joiners.map((joiner) => {
            const joinDate = new Date(joiner.detected_at).toLocaleString();
            const history = joiner.history;
            const lastDeparture = history?.movements?.filter((m: any) => m.type === 'departed')?.slice(-1)[0];
            const hasWarnings = (joiner.warnings || []).length > 0;
            const latestNote = joiner.notes?.[0];
            return (
              <div
                key={joiner.id}
                className="rounded-xl border border-gray-700/60 bg-gray-800/60 px-4 py-4 text-sm text-blue-100/80"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-white text-base font-semibold">
                      <span>{joiner.player_tag}</span>
                      {history?.primary_name && (
                        <span className="text-blue-300 font-normal">({history.primary_name})</span>
                      )}
                    </div>
                    <div className="text-xs text-blue-200/80">
                      Joined: {joinDate}
                    </div>
                    {history && (
                      <div className="text-xs text-blue-200/70 mt-1">
                        Status: {history.status}{' '}
                        {history.total_tenure ? `• Total tenure ${history.total_tenure} days` : ''}
                        {lastDeparture ? ` • Last departed ${new Date(lastDeparture.date).toLocaleDateString()}` : ''}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleMarkReviewed(joiner.id)}
                    >
                      Mark Reviewed
                    </Button>
                  </div>
                </div>
                {hasWarnings && (
                  <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    {joiner.warnings.length} active warning{joiner.warnings.length > 1 ? 's' : ''} on record.
                  </div>
                )}
                {latestNote && (
                  <div className="mt-3 rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-100/90">
                    <div className="font-semibold text-blue-200">Latest Note</div>
                    <div className="text-[11px] text-blue-100/80">{new Date(latestNote.created_at).toLocaleString()}</div>
                    <div className="mt-1 text-blue-100">{latestNote.note}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);

  const leadershipSummary = useMemo(() => {
    if (!roster) return null;
    return {
      memberCount: roster.members.length,
      updatedAt: roster.date,
      clanTag: roster.clanTag,
    };
  }, [roster]);

  const enrichmentInsights = useMemo(() => {
    if (!roster?.members?.length) return null;

    const members = roster.members;
    type MemberType = typeof members[number];

    const formatName = (member: MemberType) => member.name || member.tag || 'Unknown';

    const activityCandidates = members
      .map((member) => {
        const rawScore =
          typeof member.activityScore === 'number'
            ? member.activityScore
            : typeof member.activity?.score === 'number'
              ? member.activity.score
              : null;
        if (rawScore == null) return null;
        return {
          member,
          score: Math.round(rawScore),
          ranked:
            typeof member.rankedTrophies === 'number'
              ? Math.round(member.rankedTrophies)
              : null,
        };
      })
      .filter((entry): entry is { member: MemberType; score: number; ranked: number | null } => entry !== null);

    const averageActivity = activityCandidates.length
      ? Math.round(activityCandidates.reduce((sum, entry) => sum + entry.score, 0) / activityCandidates.length)
      : null;

    const topActivity: HighlightItem[] = [...activityCandidates]
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((entry, index) => ({
        key: `${entry.member.tag || entry.member.name || index}-activity`,
        label: formatName(entry.member),
        value: `${entry.score}/100`,
        detail: entry.ranked != null ? `${numberFormatter.format(entry.ranked)} ranked trophies` : null,
        badge: index === 0 ? 'Top Pulse' : null,
      }));

    const rankedCandidates = members
      .map((member) => {
        const ranked =
          typeof member.rankedTrophies === 'number'
            ? Math.round(member.rankedTrophies)
            : null;
        if (ranked == null) return null;
        return {
          member,
          ranked,
          league: member.rankedLeagueName ?? member.leagueName ?? null,
        };
      })
      .filter((entry): entry is { member: MemberType; ranked: number; league: string | null } => entry !== null);

    const topRanked: HighlightItem[] = [...rankedCandidates]
      .sort((a, b) => b.ranked - a.ranked)
      .slice(0, 4)
      .map((entry, index) => ({
        key: `${entry.member.tag || entry.member.name || index}-ranked`,
        label: formatName(entry.member),
        value: numberFormatter.format(entry.ranked),
        detail: entry.league,
        badge: index === 0 ? 'League Lead' : null,
      }));

    const rankedLeader = rankedCandidates.length ? rankedCandidates[0].ranked : null;

    const bestChaserCandidates = members
      .map((member) => {
        const best =
          typeof member.enriched?.bestTrophies === 'number'
            ? Math.round(member.enriched.bestTrophies)
            : null;
        const current =
          typeof member.rankedTrophies === 'number'
            ? Math.round(member.rankedTrophies)
            : typeof member.trophies === 'number'
              ? Math.round(member.trophies)
              : null;
        if (best == null || current == null) return null;
        const gapRaw = best - current;
        return {
          member,
          best,
          current,
          gap: gapRaw > 0 ? gapRaw : 0,
          atBest: gapRaw <= 0,
        };
      })
      .filter((entry): entry is { member: MemberType; best: number; current: number; gap: number; atBest: boolean } => entry !== null);

    const bestChasers: HighlightItem[] = [...bestChaserCandidates]
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 4)
      .map((entry, index) => ({
        key: `${entry.member.tag || entry.member.name || index}-personal-best`,
        label: formatName(entry.member),
        value: entry.atBest ? 'New personal best' : `${numberFormatter.format(entry.gap)} to record`,
        detail: `Peak ${numberFormatter.format(entry.best)}`,
        badge: entry.atBest ? 'Record' : null,
      }));

    if (!topActivity.length && !topRanked.length && !bestChasers.length) {
      return null;
    }

    return {
      topActivity,
      topRanked,
      bestChasers,
      averageActivity,
      rankedLeader,
    };
  }, [numberFormatter, roster]);

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
                      {leadershipSummary.updatedAt ? new Date(leadershipSummary.updatedAt).toLocaleString() : 'Never'}
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

          {enrichmentInsights && (
            <div className="bg-gray-900/60 border border-gray-700/60 rounded-2xl p-6 shadow-inner">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Roster Intelligence Pulse</h2>
                  <p className="text-sm text-blue-100/70">
                    Fresh signals surfaced from the enriched snapshot feed. Use this at-a-glance pulse before diving into player detail.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {enrichmentInsights.averageActivity != null && (
                    <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-mono text-blue-200">
                      Avg activity {enrichmentInsights.averageActivity}/100
                    </span>
                  )}
                  {enrichmentInsights.rankedLeader != null && (
                    <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-mono text-purple-200">
                      Top ranked {numberFormatter.format(enrichmentInsights.rankedLeader)}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <InsightList
                  title="Activity Pulse Leaders"
                  subtitle="Highest weighted activity scores across the roster."
                  items={enrichmentInsights.topActivity}
                />
                <InsightList
                  title="Ranked Surge"
                  subtitle="Current ranked trophies since the most recent ingestion run."
                  items={enrichmentInsights.topRanked}
                />
                <InsightList
                  title="Personal Best Chase"
                  subtitle="Players closest to matching their all-time trophy peak."
                  items={enrichmentInsights.bestChasers}
                />
              </div>
            </div>
          )}

          <div className="bg-gray-900/60 border border-gray-700/60 rounded-2xl p-6 shadow-inner">
            <h2 className="text-xl font-semibold text-white mb-4">Applicant Evaluation System</h2>
            <p className="text-sm text-blue-100/70 mb-6">
              Evaluate potential clan members and manage your applicant shortlist.
            </p>
            <ApplicantsPanel defaultClanTag={normalizeTag(clanTag || cfg.homeClanTag)} />
          </div>

          <JoinerReviewCard clanTag={normalizeTag(clanTag || cfg.homeClanTag)} />
        </div>
      </DashboardLayout>
    </LeadershipOnly>
  );
}
